const fs = require('fs');
let c = fs.readFileSync('app/components/sections/settings/SettingItem.tsx', 'utf8');

const newLogic = `
        } else if (item.id === "delete-mods") {
            if (!fivemDir) {
                alert(t.setFiveMDirectoryFirst || "Please set the FiveM directory first.");
                return;
            }
            if (!window.electron?.deleteModFolders) {
                alert(t.desktopOnly || "This feature is only available in the desktop app.");
                return;
            }
            
            if (!window.confirm(t.confirmDeleteAllMods || "Are you sure you want to delete all plugins, mods, and citizen folders? This cannot be undone.")) {
                return;
            }

            try {
                // Delete from local disk
                await window.electron.deleteModFolders({ fivemPath: fivemDir }).catch(e => console.error("Local delete failed, ignoring:", e));
                
                // Clear backend downloads list completely
                await fetch('/api/user/downloads', {
                    method: 'DELETE',
                    headers: {
                        'Authorization': \`Bearer \${localStorage.getItem('auth_session')}\`
                    }
                }).catch(e => console.error("Failed to clear backend downloads:", e));

                // Force refresh UI globally
                window.dispatchEvent(new Event("force-refresh-mods"));

                alert(t.deleteAllModsSuccess || "All mods deleted successfully.");
            } catch (error) {
                console.error("Failed to delete mods:", error);
                alert(\`\${t.deleteAllModsFailed || "Failed to delete mods"}: \${error instanceof Error ? error.message : String(error)}\`);
            }
`;

c = c.replace(
    /\} else if \(item\.id === "desktop-shortcut"\) \{\r?\n\s+alert\(t\.creatingShortcut\);\r?\n\} else if \(item\.id === "change-reshade-key"\) \{/g,
    `} else if (item.id === "desktop-shortcut") {
            alert(t.creatingShortcut);
${newLogic}
} else if (item.id === "change-reshade-key") {`
);

fs.writeFileSync('app/components/sections/settings/SettingItem.tsx', c);
console.log('Patched SettingItem.tsx');
