const fs = require('fs');
let c = fs.readFileSync('app/hooks/useTranslation.ts', 'utf8');

c = c.replace(
    /deleteModsFailed: "Failed to delete mods from the selected FiveM path",/g,
    `deleteModsFailed: "Failed to delete mods from the selected FiveM path",
        confirmDeleteAllMods: "Are you sure you want to delete all plugins, mods, and citizen folders? This cannot be undone.",
        deleteAllModsSuccess: "All mods deleted successfully.",
        deleteAllModsFailed: "Failed to delete mods",`
);

c = c.replace(
    /deleteModsFailed: "فشل مسح المودات من مسار FiveM المحدد",/g,
    `deleteModsFailed: "فشل مسح المودات من مسار FiveM المحدد",
        confirmDeleteAllMods: "هل أنت متأكد أنك تريد حذف جميع مجلدات plugins و mods و citizen؟ لا يمكن التراجع عن هذا.",
        deleteAllModsSuccess: "تم حذف جميع المودات بنجاح.",
        deleteAllModsFailed: "فشل في حذف المودات",`
);

fs.writeFileSync('app/hooks/useTranslation.ts', c);
console.log('Patched useTranslation.ts');
