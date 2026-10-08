const fs = require('fs');
let c = fs.readFileSync('app/hooks/useTranslation.ts', 'utf8');

if (!c.includes('deleteAllModsSuccess: "تم حذف جميع المودات بنجاح."')) {
    c = c.replace(
        /creatingShortcut: "جاري إنشاء اختصار على سطح المكتب\.\.\.",/g,
        `creatingShortcut: "جاري إنشاء اختصار على سطح المكتب...",
        confirmDeleteAllMods: "هل أنت متأكد أنك تريد حذف جميع مجلدات plugins و mods و citizen؟ لا يمكن التراجع عن هذا.",
        deleteAllModsSuccess: "تم حذف جميع المودات بنجاح.",
        deleteAllModsFailed: "فشل في حذف المودات",`
    );

    // If the above failed because of arabic mangling, let's use english key in arabic block
    c = c.replace(
        /creatingShortcut: "\?\?\?\? \?\?\?\?\? \?\?\?\?\? \?\?\? \?\?\? \?\?\?\?\?\?\.\.\.",/g,
        `creatingShortcut: "???? ????? ?????? ??? ??? ??????...",
        confirmDeleteAllMods: "هل أنت متأكد أنك تريد حذف جميع مجلدات plugins و mods و citizen؟ لا يمكن التراجع عن هذا.",
        deleteAllModsSuccess: "تم حذف جميع المودات بنجاح.",
        deleteAllModsFailed: "فشل في حذف المودات",`
    );
}

fs.writeFileSync('app/hooks/useTranslation.ts', c);
console.log('Patched Arabic translations');
