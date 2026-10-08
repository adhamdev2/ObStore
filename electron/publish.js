const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const FormData = require('form-data');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Load fetch - try native (Node 18+) then node-fetch v2
let fetch;
try {
    fetch = require('node-fetch');
} catch (e) {
    // Node 18+ has global fetch
    if (typeof global.fetch === 'function') {
        fetch = global.fetch.bind(global);
    } else {
        throw new Error('fetch not available. Need Node 18+ or install node-fetch@2');
    }
} 

const API_BASE = 'http://127.0.0.1:3004';
const API_TOKEN = process.env.API_TOKEN;

function compareVersions(left, right) {
    const leftParts = left.split('.').map(Number);
    const rightParts = right.split('.').map(Number);
    for (let index = 0; index < 3; index++) {
        if (leftParts[index] !== rightParts[index]) {
            return leftParts[index] > rightParts[index] ? 1 : -1;
        }
    }
    return 0;
}

async function getLatestPublishedVersion(apiBase) {
    const response = await fetch(`${apiBase}/api/update/update/manifest`, {
        headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) {
        throw new Error(`Could not read published versions from API: ${response.status} ${response.statusText}`);
    }

    const manifest = await response.json();
    const versions = [manifest.current?.version, ...(manifest.history || []).map(release => release.version)]
        .filter(version => typeof version === 'string' && /^\d+\.\d+\.\d+$/.test(version));
    return versions.reduce((highest, version) =>
        !highest || compareVersions(version, highest) > 0 ? version : highest, null);
}

async function bumpVersion(type = 'patch', latestPublishedVersion = null) {
    const packageJsonPath = path.resolve(__dirname, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const currentVersion = packageJson.version;
    if (!/^\d+\.\d+\.\d+$/.test(currentVersion)) {
        throw new Error(`Invalid app version in package.json: ${currentVersion}`);
    }
    const baseVersion = latestPublishedVersion && compareVersions(latestPublishedVersion, currentVersion) > 0
        ? latestPublishedVersion
        : currentVersion;
    const [major, minor, patch] = baseVersion.split('.').map(Number);
    
    let newVersion;
    switch (type) {
        case 'major':
            newVersion = `${major + 1}.0.0`;
            break;
        case 'minor':
            newVersion = `${major}.${minor + 1}.0`;
            break;
        case 'patch':
        default:
            newVersion = `${major}.${minor}.${patch + 1}`;
            break;
    }
    
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    
    const baseNote = baseVersion !== currentVersion ? ` (latest published: ${baseVersion})` : '';
    console.log(`[Version] Bumped ${type}: ${currentVersion} -> ${newVersion}${baseNote}`);
    return newVersion;
}

async function findInstaller() {
    const makeDir = path.resolve(__dirname, 'out/make/squirrel.windows/x64');
    const installerPath = path.join(makeDir, 'OB_Setup.exe');
    
    if (fs.existsSync(installerPath)) {
        return installerPath;
    }
    
    // Search in out directory
    const outDir = path.resolve(__dirname, 'out');
    if (fs.existsSync(outDir)) {
        const entries = fs.readdirSync(outDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const squirrelDir = path.join(outDir, entry.name, 'make', 'squirrel.windows', 'x64');
                const installer = path.join(squirrelDir, 'OB_Setup.exe');
                if (fs.existsSync(installer)) {
                    return installer;
                }
            }
        }
    }
    
    return null;
}

async function findSquirrelRelease(installerPath) {
    const releaseDirectory = path.dirname(installerPath);
    const releasesPath = path.join(releaseDirectory, 'RELEASES');
    if (!fs.existsSync(releasesPath)) {
        throw new Error(`Squirrel RELEASES file not found: ${releasesPath}`);
    }

    const releases = fs.readFileSync(releasesPath, 'utf8');
    const packageNames = releases
        .split(/\r?\n/)
        .map(line => line.trim().split(/\s+/)[1])
        .filter(name => name && name.endsWith('.nupkg'));

    if (!packageNames.some(name => name.endsWith('-full.nupkg'))) {
        throw new Error('The RELEASES file does not contain a full Squirrel package');
    }

    const packages = packageNames.map(packageName => {
        const packagePath = path.join(releaseDirectory, path.basename(packageName));
        if (!fs.existsSync(packagePath)) {
            throw new Error(`Squirrel package referenced by RELEASES was not found: ${packagePath}`);
        }
        return { packageName: path.basename(packageName), packagePath };
    });

    return { releasesPath, releases, packages };
}

async function uploadToApi(installerPath, squirrelRelease, version, apiToken, apiBase) {
    if (!apiToken) {
        throw new Error('API_TOKEN is required');
    }

    // Verify the token before opening large file streams. The upload route
    // rejects unauthorized requests before parsing their multipart body, which
    // otherwise surfaces as a low-level EPIPE while the client keeps writing.
    const authCheck = await fetch(`${apiBase}/api/update/update/ws-stats`, {
        headers: { 'Authorization': `Bearer ${apiToken}` }
    });
    if (!authCheck.ok) {
        const errorText = await authCheck.text();
        throw new Error(`API upload authentication failed: ${authCheck.status} ${authCheck.statusText} - ${errorText}`);
    }
    
    const stats = fs.statSync(installerPath);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
    
    console.log(`[Upload] Uploading installer (${fileSizeMB} MB) and Squirrel feed to ${apiBase}/api/update/data/app.exe`);
    console.log(`[Upload] Version: ${version}`);
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(installerPath), {
        filename: 'app.exe',
        contentType: 'application/octet-stream'
    });
    for (const squirrelPackage of squirrelRelease.packages) {
        formData.append('package', fs.createReadStream(squirrelPackage.packagePath), {
            filename: squirrelPackage.packageName,
            contentType: 'application/octet-stream'
        });
    }
    formData.append('releases', squirrelRelease.releases);
    formData.append('version', version);

    const contentLength = await new Promise((resolve, reject) => {
        formData.getLength((err, length) => err ? reject(err) : resolve(length));
    });
    console.log(`[Upload] Total multipart request: ${(contentLength / 1024 / 1024).toFixed(2)} MiB`);
    
    const response = await fetch(`${apiBase}/api/update/data/app.exe`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Length': contentLength,
            ...formData.getHeaders()
        },
        body: formData
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`[Upload] Success!`, result);
    return result;
}

async function main() {
    console.log('=== OB Launcher Publish Script ===\n');
    console.log(`[Config] API_BASE: ${API_BASE}`);
    console.log(`[Config] API_TOKEN: ${API_TOKEN ? 'SET' : 'NOT SET'}`);
    
    const args = process.argv.slice(2);

    if (args.includes('--retry-upload')) {
        const packageJsonPath = path.resolve(__dirname, 'package.json');
        const version = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version;
        const latestPublishedVersion = await getLatestPublishedVersion(API_BASE);
        if (latestPublishedVersion && compareVersions(version, latestPublishedVersion) <= 0) {
            throw new Error(`Cannot retry ${version}: latest published version is ${latestPublishedVersion}`);
        }

        const installerPath = await findInstaller();
        if (!installerPath) {
            throw new Error('Existing installer not found. Run a normal publish first.');
        }
        const squirrelRelease = await findSquirrelRelease(installerPath);
        console.log(`[Upload] Retrying existing build v${version}; version will not be bumped or rebuilt.`);
        await uploadToApi(installerPath, squirrelRelease, version, API_TOKEN, API_BASE);
        console.log(`\n=== Publish Complete ===\nVersion: ${version}\nInstaller: ${installerPath}`);
        return;
    }

    const bumpType = args[0] || 'patch';
    const skipUpload = args.includes('--skip-upload') || args.includes('--local');
    const latestPublishedVersion = skipUpload ? null : await getLatestPublishedVersion(API_BASE);
    
    // 1. Bump version
    const newVersion = await bumpVersion(bumpType, latestPublishedVersion);
    
    // 2. Build
    console.log('\n[Build] Building application...');
    // Pass env to child process
    execSync('npm run make', { 
        cwd: __dirname, 
        stdio: 'inherit',
        env: { ...process.env, API_TOKEN, API_BASE }
    });
    
    // 3. Find installer
    console.log('\n[Build] Finding installer...');
    const installerPath = await findInstaller();
    if (!installerPath) {
        throw new Error('Installer not found! Build may have failed.');
    }
    console.log(`[Build] Found: ${installerPath}`);

    const squirrelRelease = await findSquirrelRelease(installerPath);
    console.log(`[Build] Found ${squirrelRelease.packages.length} Squirrel feed package(s)`);
    
    // 4. Copy to api/data (local)
    const apiDataDir = path.resolve(__dirname, '../api/data');
    const localFeedDir = path.join(apiDataDir, 'updates', 'win32');
    fs.mkdirSync(localFeedDir, { recursive: true });
    const localAppExe = path.join(apiDataDir, 'app.exe');
    fs.copyFileSync(installerPath, localAppExe);
    fs.copyFileSync(squirrelRelease.releasesPath, path.join(localFeedDir, 'RELEASES'));
    for (const squirrelPackage of squirrelRelease.packages) {
        fs.copyFileSync(squirrelPackage.packagePath, path.join(localFeedDir, squirrelPackage.packageName));
    }
    console.log(`[Local] Copied to ${localAppExe}`);
    
    // 5. Upload to API
    if (!skipUpload) {
        console.log('\n[Upload] Uploading to API...');
        await uploadToApi(installerPath, squirrelRelease, newVersion, API_TOKEN, API_BASE);
    } else {
        console.log('\n[Upload] Skipped (--skip-upload / --local)');
    }
    
    console.log('\n=== Publish Complete ===');
    console.log(`Version: ${newVersion}`);
    console.log(`Installer: ${installerPath}`);
    console.log(`Squirrel feed: ${path.join(localFeedDir, 'RELEASES')}`);
    console.log(`Local copy: ${localAppExe}`);
}

main().catch(err => {
    console.error('\n[Error]', err.message);
    process.exit(1);
});
