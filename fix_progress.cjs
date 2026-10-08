const fs = require('fs');
const file = 'd:/AW-PROJECTS/fivemModes/electron/ipc/index.ts';
let content = fs.readFileSync(file, 'utf8');

const badReportProgress = `            const reportProgress = () => {\r\nconst now = Date.now();\r\n                    speedWindow.push({ time: now, bytes: downloadedBytes });\r\n                    if (speedWindow.length > 20) speedWindow.shift();\r\n\r\n                    let speed = 0;\r\n                    if (speedWindow.length >= 2) {\r\n                        const first = speedWindow[0];\r\n                        const last = speedWindow[speedWindow.length - 1];\r\n                        const timeDiff = (last.time - first.time) / 1000;\r\n                        if (timeDiff > 0) speed = (last.bytes - first.bytes) / timeDiff;\r\n                    }\r\n\r\nif (now - lastReportTime > 100 || downloadedBytes === totalBytes) {\r\n                        lastReportTime = now;\r\n                        const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : Math.min(100, downloadedBytes / 1024 / 1024 * 10);\r\n                        event.sender.send("download-progress", {\r\n                        downloadId,\r\n                        progress,\r\n                        modName: payload?.modName,\r\n                        downloadedBytes,\r\n                        totalBytes,\r\n                        speed,\r\n                        chunks: CHUNK_COUNT,\r\n                        status: "downloading"\r\n                    });\r\n                }\r\n            };`;

const goodReportProgress = `            const reportProgress = () => {\r\n                const now = Date.now();\r\n                speedWindow.push({ time: now, bytes: downloadedBytes });\r\n                if (speedWindow.length > 20) speedWindow.shift();\r\n\r\n                let speed = 0;\r\n                if (speedWindow.length >= 2) {\r\n                    const first = speedWindow[0];\r\n                    const last = speedWindow[speedWindow.length - 1];\r\n                    const timeDiff = (last.time - first.time) / 1000;\r\n                    if (timeDiff > 0) speed = (last.bytes - first.bytes) / timeDiff;\r\n                }\r\n\r\n                if (now - lastReportTime > 100 || downloadedBytes === totalBytes) {\r\n                    lastReportTime = now;\r\n                    const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;\r\n                    event.sender.send("download-progress", {\r\n                        downloadId,\r\n                        progress,\r\n                        modName: payload?.modName,\r\n                        downloadedBytes,\r\n                        totalBytes,\r\n                        speed,\r\n                        chunks: CHUNK_COUNT,\r\n                        status: "downloading"\r\n                    });\r\n                }\r\n            };`;

if (content.includes(badReportProgress)) {
    content = content.replace(badReportProgress, goodReportProgress);
    fs.writeFileSync(file, content);
    console.log('Replaced reportProgress successfully');
} else {
    console.log('Pattern not found - trying regex...');
    // Try regex approach
    const fixed = content.replace(
        /const reportProgress = \(\) => \{\r?\nconst now = Date\.now\(\);/,
        'const reportProgress = () => {\r\n                const now = Date.now();'
    ).replace(
        /\r?\nif \(now - lastReportTime > 100/,
        '\r\n                if (now - lastReportTime > 100'
    ).replace(
        /Math\.min\(100, downloadedBytes \/ 1024 \/ 1024 \* 10\)/,
        '0'
    ).replace(
        /event\.sender\.send\("download-progress", \{\r?\n                        downloadId,\r?\n                        progress,\r?\n                        modName: payload\?\.modName,\r?\n                        downloadedBytes,\r?\n                        totalBytes,\r?\n                        speed,\r?\n                        chunks: CHUNK_COUNT,\r?\n                        status: "downloading"\r?\n                    \}\);\r?\n                \}/,
        `event.sender.send("download-progress", {\r\n                        downloadId,\r\n                        progress,\r\n                        modName: payload?.modName,\r\n                        downloadedBytes,\r\n                        totalBytes,\r\n                        speed,\r\n                        chunks: CHUNK_COUNT,\r\n                        status: "downloading"\r\n                    });\r\n                }`
    );
    fs.writeFileSync(file, fixed);
    console.log('Applied regex fix');
}
