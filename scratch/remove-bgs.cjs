const fs = require('fs');

function removeBg(filePath, pattern, replacement) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(pattern, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Removed background from ${filePath}`);
}

removeBg(
    'app/download/page.tsx', 
    /className="min-h-screen bg-\[image:var\(--app-bg\)\] bg-cover bg-center bg-no-repeat"/, 
    'className="min-h-screen"'
);

removeBg(
    'app/mods/page.tsx',
    /className="flex flex-col items-center bg-\[url\('\/bg\.png'\)\] bg-cover bg-fixed bg-center bg-no-repeat min-h-screen pt-\[220px\] pb-12"/,
    'className="flex flex-col items-center min-h-screen pt-[220px] pb-12"'
);

removeBg(
    'app/page.tsx',
    /className="relative min-h-screen bg-\[url\('\/background\.png'\)\] bg-no-repeat bg-cover bg-center w-full overflow-hidden"/,
    'className="relative min-h-screen w-full overflow-hidden"'
);
