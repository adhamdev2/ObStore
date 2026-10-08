import { execSync } from 'child_process';
import path from 'path';

const PROTOCOL = 'fivem-launcher';
const electronPath = path.resolve('node_modules/electron/dist/electron.exe');
const appPath = path.resolve('./main.ts'); // مسار ملف الـ main.js بتاعك

const command = `"${electronPath}" "${appPath}" --register-protocol`;

try {
    console.log("Attempting to register protocol...");
    // تنفيذ الأمر بصلاحيات مسؤل
    execSync(`powershell Start-Process "${electronPath}" -ArgumentList '"${appPath}"', '--register-protocol' -Verb RunAs`);
    console.log("Done! Check your protocol now.");
} catch (e) {
    console.error("Failed to register:", e);
}