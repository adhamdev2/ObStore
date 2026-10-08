const path = require('path');
const fs = require('fs');
const iconPath = path.resolve(__dirname, './app.ico');

function findAndCopyExe(outputPaths) {
  const apiDataDir = path.resolve(__dirname, '../api/data');
  
  // Search for exe in all output paths
  let sourceExe = null;
  let sourceInstaller = null;
  
  if (outputPaths && outputPaths.length > 0) {
    for (const outPath of outputPaths) {
      // Check for unpacked app exe
      const directExe = path.join(outPath, 'ob.exe');
      if (fs.existsSync(directExe)) {
        sourceExe = directExe;
      }
      
      // Check in subdirectories (win32-x64, linux-x64, etc.)
      try {
        const entries = fs.readdirSync(outPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const subExe = path.join(outPath, entry.name, 'ob.exe');
            if (fs.existsSync(subExe)) {
              sourceExe = subExe;
            }
            
            // Also check for squirrel installer
            const squirrelInstaller = path.join(outPath, 'make', 'squirrel.windows', 'x64', 'OB_Setup.exe');
            if (fs.existsSync(squirrelInstaller)) {
              sourceInstaller = squirrelInstaller;
            }
          }
        }
        if (sourceExe && sourceInstaller) break;
      } catch (e) {}
    }
  }
  
  // Fallback: search common locations
  if (!sourceExe || !sourceInstaller) {
    const fallbackPaths = [
      { exe: path.resolve(__dirname, './out/ob-win32-x64/ob.exe'), installer: null },
      { exe: path.resolve(__dirname, './out/ob-linux-x64/ob.exe'), installer: null },
      { exe: path.resolve(__dirname, './out/ob-linux-arm64/ob.exe'), installer: null },
      { exe: path.resolve(__dirname, './out/make/squirrel.windows/x64/ob.exe'), installer: path.resolve(__dirname, './out/make/squirrel.windows/x64/OB_Setup.exe') },
    ];
    
    for (const p of fallbackPaths) {
      if (!sourceExe && p.exe && fs.existsSync(p.exe)) sourceExe = p.exe;
      if (!sourceInstaller && p.installer && fs.existsSync(p.installer)) sourceInstaller = p.installer;
      if (sourceExe && sourceInstaller) break;
    }
  }
  
  // Ensure api/data directory exists
  if (!fs.existsSync(apiDataDir)) {
    fs.mkdirSync(apiDataDir, { recursive: true });
  }
  
  // Copy installer (OB_Setup.exe) as app.exe - this is what users should download and run
  if (sourceInstaller) {
    const destInstaller = path.join(apiDataDir, 'app.exe');
    fs.copyFileSync(sourceInstaller, destInstaller);
    console.log(`[PostBuild] SUCCESS: Copied INSTALLER ${sourceInstaller} -> ${destInstaller}`);
    console.log(`[PostBuild] Installer size: ${(fs.statSync(destInstaller).size / 1024 / 1024).toFixed(2)} MB`);
  } else if (sourceExe) {
    // Fallback to raw exe if no installer found
    const destExe = path.join(apiDataDir, 'app.exe');
    fs.copyFileSync(sourceExe, destExe);
    console.log(`[PostBuild] WARNING: No installer found, copied raw exe ${sourceExe} -> ${destExe}`);
    console.log(`[PostBuild] Raw exe size: ${(fs.statSync(destExe).size / 1024 / 1024).toFixed(2)} MB`);
  } else {
    console.log('[PostBuild] ERROR: Could not find any exe or installer. Searched paths:');
    if (outputPaths) {
      outputPaths.forEach(p => console.log('  -', p));
    }
  }
}

module.exports = {
  packagerConfig: {
    asar: true,
    icon: iconPath,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'ob_launcher',
        authors: 'www.adham.business',
        description: 'OB Store Launcher',
        exe: 'ob.exe',
        setupIcon: iconPath,
        setupExe: 'OB_Setup.exe',
        noMsi: true,
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
  ],
  hooks: {
    postPackage: async (forgeConfig, options) => {
      findAndCopyExe(options.outputPaths);
    },
    postMake: async (forgeConfig, options) => {
      findAndCopyExe(options.outputPaths);
    },
  },
};
