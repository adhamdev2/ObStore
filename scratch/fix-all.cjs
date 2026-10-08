const fs = require('fs');

// 1. Fix admin route
let adminTs = fs.readFileSync('api/routes/admin.ts', 'utf8');
if (!adminTs.includes('/hardware/update')) {
    adminTs = adminTs.replace(/export default router;/, `
// Update hardware
router.post("/users/:id/hardware/update", async (req, res) => {
    try {
        const { id } = req.params;
        const { hardwareId } = req.body;
        if (!hardwareId || typeof hardwareId !== 'string' || hardwareId.trim().length === 0) {
            return res.status(400).json({ error: "Invalid hardware ID" });
        }
        const user = await UserDB.findById(id);
        if (!user) return res.status(404).json({ error: "User not found" });
        await UserDB.update(id, { hwid: hardwareId.trim(), updatedAt: new Date() });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to update hardware" });
    }
});

export default router;`);
    fs.writeFileSync('api/routes/admin.ts', adminTs);
}

// 2. Fix api route
const apiRouteContent = `import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = "http://localhost:3004/api/admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { hardwareId } = await request.json();
    
    const adminSecret = process.env.ADMIN_SECRET || "sk_admin_2f8a9c3e7d1b4f6a";

    const res = await fetch(\`\${API_URL}/users/\${id}/hardware/update\`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-secret": adminSecret,
      },
      body: JSON.stringify({ hardwareId }),
    });

    if (!res.ok) {
      throw new Error(\`API error: \${res.status}\`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Hardware update proxy error:", error);
    return NextResponse.json(
      { error: "Failed to update hardware" },
      { status: 500 }
    );
  }
}`;
fs.mkdirSync('admin/app/api/app/users/[id]/hardware/update', { recursive: true });
fs.writeFileSync('admin/app/api/app/users/[id]/hardware/update/route.ts', apiRouteContent);

// 3. Fix page.tsx
let c = fs.readFileSync('admin/app/dashboard/app-users/page.tsx', 'utf8');

const t = (b64) => Buffer.from(b64, 'base64').toString('utf8');
const TEXT_CANCEL = t("2KXZhNi62KfYoQ=="); // إلغاء
const TEXT_CHANGE = t("2KrYutmK2YrYsQ=="); // تغيير
const TEXT_DEVICE = t("2KrYutmK2YrYsSDYp9mE2KzZh9in2LI="); // تغيير الجهاز
const TEXT_MSG = t("2KPYrdiv2K4gSGFyZHdhcmUgSUQg2KfZhNis2K/ZitivINmE2YTZhdiz2KrYrtiv2YUgIg=="); // أدخل Hardware ID الجديد للمستخدم "

// Import Laptop
if (!c.includes('Laptop')) {
    c = c.replace(/MonitorSmartphone,/, 'MonitorSmartphone,\n  Laptop,');
}

// PromptModal
const promptModalCode = `
function PromptModal({
  open,
  title,
  message,
  placeholder,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  placeholder: string;
  confirmLabel: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  useEffect(() => { if (open) setValue(""); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-primary/10">
              <Laptop className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-semibold text-foreground mb-1">{title}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">{message}</p>
              <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" autoFocus />
            </div>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-accent rounded-lg transition-colors">${TEXT_CANCEL}</button>
          <button onClick={() => onConfirm(value)} disabled={!value.trim()} className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
`;
if (!c.includes('PromptModal(')) {
    c = c.replace(/function ConfirmModal/, promptModalCode + '\nfunction ConfirmModal');
}

// ActionMenu props
c = c.replace(/onDelete: \(\) => void;\n  \}\)/, 'onDelete: () => void;\n    onChangeHardware: () => void;\n  })');
c = c.replace(/onDelete,\n  \}: \{/, 'onDelete,\n    onChangeHardware,\n  }: {');
c = c.replace(/<button\n\s*onClick=\{\(\) => \{ onUnbind\(\); setOpen\(false\); \}\}/, 
`<button onClick={() => { onChangeHardware(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <Laptop className="w-4 h-4" />
              <span>${TEXT_DEVICE}</span>
            </button>
            <button
              onClick={() => { onUnbind(); setOpen(false); }}`);

// State
if (!c.includes('const [promptModal, setPromptModal]')) {
    c = c.replace(/const \[confirm, setConfirm\] = useState[^\n]+;/, `$&
  const [promptModal, setPromptModal] = useState({ open: false, title: "", message: "", placeholder: "", confirmLabel: "", onConfirm: (val: string) => {} });`);
}

// Handle change hardware
if (!c.includes('handleChangeHardware')) {
    c = c.replace(/const handleUnbind = [^\n]+/, `const handleChangeHardware = (user: AppUser) => {
    setPromptModal({
      open: true,
      title: "${TEXT_DEVICE}",
      message: \`${TEXT_MSG}\${user.username}".\`,
      placeholder: "Hardware ID...",
      confirmLabel: "${TEXT_CHANGE}",
      onConfirm: async (val) => {
        setPromptModal((p) => ({ ...p, open: false }));
        setActionLoading(user.id);
        try {
          const res = await fetch(\`/api/app/users/\${user.id}/hardware/update\`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hardwareId: val }),
          });
          if (res.ok) await fetchUsers();
        } catch (error) {
          console.error(error);
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  $&`);
}

// Render PromptModal
if (!c.includes('<PromptModal')) {
    c = c.replace(/<ConfirmModal[\s\S]*?\/>/, `$&
        <PromptModal open={promptModal.open} title={promptModal.title} message={promptModal.message} placeholder={promptModal.placeholder} confirmLabel={promptModal.confirmLabel} onConfirm={promptModal.onConfirm} onCancel={() => setPromptModal((p) => ({ ...p, open: false }))} />`);
}

// ActionMenu props passed
c = c.replace(/onDelete=\{\(\) => handleDelete\(user\)\}\s*\/>/g, 'onDelete={() => handleDelete(user)} onChangeHardware={() => handleChangeHardware(user)} />');

// Search filter
c = c.replace(/u\.discordId\.includes\(search\);/, 'u.discordId.includes(search) || (u.hardwareId && u.hardwareId.toLowerCase().includes(search.toLowerCase()));');

fs.writeFileSync('admin/app/dashboard/app-users/page.tsx', c);
