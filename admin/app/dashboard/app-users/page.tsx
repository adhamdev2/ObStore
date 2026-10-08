"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  RefreshCw,
  Trash2,
  Ban,
  CheckCircle2,
  Unlink,
  Wifi,
  WifiOff,
  ChevronDown,
  ExternalLink,
  AlertTriangle,
  X,
  MonitorSmartphone,
  Laptop,
  MoreHorizontal,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface AppUser {
  id: string;
  name: string;
  username: string;
  email: string;
  discordId: string;
  discordAvatar: string;
  online: boolean;
  hardwareId: string | null;
  suspended: boolean;
  version: string;
  created_at: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const ADMIN_SECRET = "sk_admin_2f8a9c3e7d1b4f6a";

const API_BASE = process.env.NEXT_PUBLIC_APP_API_URL ?? "";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function timeAgo(dateStr: string) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "الآن";
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
  return `منذ ${Math.floor(diff / 86400)} يوم`;
}

function discordAvatarUrl(discordId: string, avatar: string) {
  if (!avatar) return `https://cdn.discordapp.com/embed/avatars/${parseInt(discordId) % 5}.png`;
  const ext = avatar.startsWith("a_") ? "gif" : "webp";
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.${ext}?size=128`;
}

/* ------------------------------------------------------------------ */
/*  Confirmation Modal                                                */
/* ------------------------------------------------------------------ */


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
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-accent rounded-lg transition-colors">إلغاء</button>
          <button onClick={() => onConfirm(value)} disabled={!value.trim()} className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${danger ? "bg-destructive/10" : "bg-primary/10"}`}>
              <AlertTriangle className={`w-5 h-5 ${danger ? "text-destructive" : "text-primary"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-semibold text-foreground mb-1">{title}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{message}</p>
            </div>
          </div>
        </div>
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-accent rounded-lg transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              danger
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  User Row Action Menu                                              */
/* ------------------------------------------------------------------ */

function ActionMenu({
  user,
  onSuspend,
  onUnbind,
  onDelete,
  onChangeHardware,
}: {
  user: AppUser;
  onSuspend: () => void;
  onUnbind: () => void;
  onDelete: () => void;
  onChangeHardware: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-xl shadow-xl z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
          <button
            onClick={() => { onSuspend(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {user.suspended ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>تفعيل الحساب</span>
              </>
            ) : (
              <>
                <Ban className="w-4 h-4 text-amber-500" />
                <span>تعليق الحساب</span>
              </>
            )}
          </button>
          <button
            onClick={() => { onUnbind(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Unlink className="w-4 h-4" />
            <span>إلغاء ربط الجهاز</span>
          </button>
          <div className="mx-2 my-1 border-t border-border" />
          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-destructive hover:bg-destructive/5 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>حذف نهائي</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                         */
/* ------------------------------------------------------------------ */

export default function AppUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "online" | "suspended">("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [promptModal, setPromptModal] = useState({ open: false, title: "", message: "", placeholder: "", confirmLabel: "", onConfirm: (val: string) => {} });

  // Confirmation modal state
  const [confirm, setConfirm] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", confirmLabel: "", onConfirm: () => {} });

  const wsRef = useRef<WebSocket | null>(null);

  /* ---- Fetch users ---- */
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/app/users", {
        headers: { "x-admin-secret": ADMIN_SECRET },
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      console.error("Failed to fetch app users");
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- WebSocket for online status with HTTP Fallback ---- */
  useEffect(() => {
    fetchUsers();

    let wsUrl = process.env.NEXT_PUBLIC_WS_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'ws://localhost:3006' : 'wss://api.ob1.store');
    if (wsUrl && !wsUrl.endsWith('/ws/updates')) { wsUrl = wsUrl.replace(/\/$/, '') + '/ws/updates'; }
    if (!wsUrl) return;

    let pollInterval: NodeJS.Timeout;

    const fetchOnlineStatusFallback = async () => {
      try {
        const res = await fetch('/api/app/online', { headers: { 'x-admin-secret': ADMIN_SECRET } });
        if (res.ok) {
          const data = await res.json();
          const onlineHwids = new Set(data.online || []);
          setUsers((prev) =>
            prev.map((u) => ({ ...u, online: onlineHwids.has(u.hardwareId) }))
          );
        }
      } catch {}
    };

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'status') {
              setUsers((prev) =>
                prev.map((u) =>
                  u.hardwareId === msg.hwid ? { ...u, online: msg.online } : u
                )
              );
            } else if (msg.type === 'initial_status') {
              const onlineHwids = new Set(msg.payload || []);
              setUsers((prev) =>
                prev.map((u) => ({
                  ...u,
                  online: onlineHwids.has(u.hardwareId)
                }))
              );
            }
          } catch {}
        };
        
        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'admin_auth', payload: { secret: 'ob-admin' } }));
        };

        ws.onclose = () => {
        setTimeout(connect, 3000);
      };
      ws.onerror = () => { fetchOnlineStatusFallback(); };
    };

    connect();

    pollInterval = setInterval(() => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        fetchOnlineStatusFallback();
      }
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      if (wsRef.current) wsRef.current.close();
    };
  }, [fetchUsers]);

  /* ---- Actions ---- */
  const handleSuspend = async (user: AppUser) => {
    const willSuspend = !user.suspended;
    setConfirm({
      open: true,
      title: willSuspend ? "تعليق الحساب" : "تفعيل الحساب",
      message: willSuspend
        ? `سيتم تعليق حساب "${user.username}" وسيظهر له رسالة التعليق عند فتح التطبيق.`
        : `سيتم إعادة تفعيل حساب "${user.username}" وسيتمكن من استخدام التطبيق مجدداً.`,
      confirmLabel: willSuspend ? "تعليق" : "تفعيل",
      danger: willSuspend,
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, open: false }));
        setActionLoading(user.id);
        try {
          const res = await fetch(`/api/app/users/${user.id}/suspend`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-admin-secret": ADMIN_SECRET,
            },
            body: JSON.stringify({ suspend: willSuspend }),
          });
          if (res.ok) {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === user.id ? { ...u, suspended: willSuspend } : u
              )
            );
          }
        } catch {} finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleChangeHardware = (user: AppUser) => {
    setPromptModal({
      open: true,
      title: "تغيير الجهاز",
      message: `أحدخ Hardware ID الجديد للمستخدم "${user.username}".`,
      placeholder: "Hardware ID...",
      confirmLabel: "تغيير",
      onConfirm: async (val) => {
        setPromptModal((p) => ({ ...p, open: false }));
        setActionLoading(user.id);
        try {
          const res = await fetch(`/api/app/users/${user.id}/hardware/update`, {
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

  const handleUnbind = async (user: AppUser) => {
    setConfirm({
      open: true,
      title: "إلغاء ربط الجهاز",
      message: `سيتم إلغاء ربط الجهاز الحالي لـ "${user.username}". عند دخوله من أي جهاز جديد سيتم ربطه تلقائياً.`,
      confirmLabel: "إلغاء الربط",
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, open: false }));
        setActionLoading(user.id);
        try {
          await fetch(`/api/app/users/${user.id}/hardware/unbind`, {
            method: "POST",
            headers: { "x-admin-secret": ADMIN_SECRET },
          });
          setUsers((prev) =>
            prev.map((u) =>
              u.id === user.id ? { ...u, hardwareId: null } : u
            )
          );
        } catch {} finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleDelete = async (user: AppUser) => {
    setConfirm({
      open: true,
      title: "حذف المستخدم نهائياً",
      message: `سيتم حذف "${user.username}" من الموقع ومن Discord نهائياً. هذا الإجراء لا يمكن التراجع عنه.`,
      confirmLabel: "حذف نهائي",
      danger: true,
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, open: false }));
        setActionLoading(user.id);
        try {
          const res = await fetch(`/api/app/users/${user.id}`, {
            method: "DELETE",
            headers: { "x-admin-secret": ADMIN_SECRET },
          });
          if (res.ok) {
            setUsers((prev) => prev.filter((u) => u.id !== user.id));
          }
        } catch {} finally {
          setActionLoading(null);
        }
      },
    });
  };

  /* ---- Filtering ---- */
  const filtered = users.filter((u) => {
    const matchSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.discordId.includes(search) || (u.hardwareId && u.hardwareId.toLowerCase().includes(search.toLowerCase()));

    if (filter === "online") return matchSearch && u.online;
    if (filter === "suspended") return matchSearch && u.suspended;
    return matchSearch;
  });

  const onlineCount = users.filter((u) => u.online).length;
  const suspendedCount = users.filter((u) => u.suspended).length;

  /* ---- Render ---- */
  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginatedUsers = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter]);

  return (
    <div className="p-6 lg:p-8 max-w-[1400px]">
      {/* Confirmation Modal */}
      <ConfirmModal
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.confirmLabel}
        danger={confirm.danger}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm((c) => ({ ...c, open: false }))}
      />
        <PromptModal open={promptModal.open} title={promptModal.title} message={promptModal.message} placeholder={promptModal.placeholder} confirmLabel={promptModal.confirmLabel} onConfirm={promptModal.onConfirm} onCancel={() => setPromptModal((p) => ({ ...p, open: false }))} />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">المستخدمين</h1>
        <p className="text-sm text-muted-foreground">إدارة مستخدمي التطبيق والتحكم في حساباتهم</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-xl px-5 py-4">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">إجمالي المستخدمين</p>
          <p className="text-2xl font-bold text-foreground">{users.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">متصل الآن</p>
          </div>
          <p className="text-2xl font-bold text-emerald-500">{onlineCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-5 py-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">معلق</p>
          </div>
          <p className="text-2xl font-bold text-amber-500">{suspendedCount}</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="بحث بالاسم أو اليوزرنيم أو Discord ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-lg pr-10 pl-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          {(["all", "online", "suspended"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                filter === f
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {f === "all" ? "الكل" : f === "online" ? "متصل" : "معلق"}
            </button>
          ))}
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-card border border-border rounded-xl overflow-visible">
        {loading && users.length === 0 ? (
          <div className="p-16 text-center">
            <RefreshCw className="w-8 h-8 text-muted-foreground animate-spin mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">جاري تحميل المستخدمين...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <MonitorSmartphone className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              {search ? "لا توجد نتائج مطابقة" : "لا يوجد مستخدمين حالياً"}
            </p>
          </div>
        ) : (
          <div className="w-full">
          {/* Mobile View (Cards) */}
          <div className="block lg:hidden divide-y divide-border">
            {paginatedUsers.map((user) => (
              <div key={user.id} className="p-4 flex flex-col gap-3 relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative shrink-0">
                      <img src={discordAvatarUrl(user.discordId, user.discordAvatar)} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-border" />
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${user.online ? "bg-emerald-500" : "bg-zinc-500"}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-foreground truncate">{user.name}</p>
                      <p className="text-[12px] text-muted-foreground truncate">@{user.username}</p>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <ActionMenu user={user} onSuspend={() => handleSuspend(user)} onUnbind={() => handleUnbind(user)} onDelete={() => handleDelete(user)} onChangeHardware={() => handleChangeHardware(user)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12px] mt-1">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground/70">Discord</span>
                    <span className="font-mono text-muted-foreground truncate" dir="ltr">{user.discordId}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground/70">الجهاز</span>
                    <span className="font-mono text-muted-foreground truncate">{user.hardwareId ? user.hardwareId.slice(0,10)+"..." : "غير مربوط"}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground/70">الحالة</span>
                    <span>
                      {user.suspended ? (
                        <span className="text-amber-500 font-medium">معلق</span>
                      ) : user.online ? (
                        <span className="text-emerald-500 font-medium">متصل</span>
                      ) : (
                        <span className="text-muted-foreground font-medium">غير متصل</span>
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground/70">الإصدار</span>
                    <span className="text-muted-foreground">{user.version || "—"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View (Table) */}
          <div className="hidden lg:block w-full">
            <table className="w-full text-right whitespace-nowrap lg:whitespace-normal">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">المستخدم</th>
                  <th className="px-3 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Discord</th>
                  <th className="px-3 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">الجهاز</th>
                  <th className="px-3 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">الحالة</th>
                  <th className="px-3 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">الإصدار</th>
                  <th className="px-3 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">التسجيل</th>
                  <th className="px-3 py-3.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-14"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedUsers.map((user) => (
                  <tr
                    key={user.id}
                    className={`group transition-colors ${
                      actionLoading === user.id
                        ? "opacity-50 pointer-events-none"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    {/* User Info */}
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={discordAvatarUrl(user.discordId, user.discordAvatar)}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover ring-2 ring-border"
                          />
                          {/* Online indicator */}
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${
                              user.online ? "bg-emerald-500" : "bg-zinc-500"
                            }`}
                          />
                        </div>
                        <div className="min-w-0 max-w-[120px] sm:max-w-[150px]">
                          <p className="text-[13px] font-medium text-foreground truncate">{user.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">@{user.username}</p>
                        </div>
                      </div>
                    </td>

                    {/* Discord */}
                    <td className="px-3 py-3.5">
                      <p className="text-[12px] text-muted-foreground font-mono truncate max-w-[100px] sm:max-w-[140px]" dir="ltr">{user.discordId}</p>
                    </td>

                    {/* Hardware */}
                    <td className="px-3 py-3.5">
                      {user.hardwareId ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted rounded-md px-2 py-1 font-mono">
                          {user.hardwareId.slice(0, 10)}...
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground/50">غير مربوط</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3.5">
                      {user.suspended ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-amber-500 bg-amber-500/10 rounded-full px-2.5 py-1">
                          <Ban className="w-3 h-3" />
                          معلق
                        </span>
                      ) : user.online ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-500 bg-emerald-500/10 rounded-full px-2.5 py-1">
                          <Wifi className="w-3 h-3" />
                          متصل
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground bg-muted rounded-full px-2.5 py-1">
                          <WifiOff className="w-3 h-3" />
                          غير متصل
                        </span>
                      )}
                    </td>

                    {/* Version */}
                    <td className="px-3 py-3.5">
                      <span className="text-[12px] text-muted-foreground">{user.version || "—"}</span>
                    </td>

                    {/* Created */}
                    <td className="px-3 py-3.5">
                      <span className="text-[12px] text-muted-foreground">{timeAgo(user.created_at)}</span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-3.5 relative">
                      <ActionMenu
                        user={user}
                        onSuspend={() => handleSuspend(user)}
                        onUnbind={() => handleUnbind(user)}
                        onDelete={() => handleDelete(user)} onChangeHardware={() => handleChangeHardware(user)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}

        {/* Responsive Pagination Footer */}
        {filtered.length > 0 && (
          <div className="px-5 py-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-[12px] text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>عرض {paginatedUsers.length} من {filtered.length} مستخدم</span>
              <span className="hidden sm:inline-block">{onlineCount} متصل الآن</span>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 rounded-md hover:bg-muted disabled:opacity-50 transition-colors">السابق</button>
                <span className="font-medium text-foreground px-2">{currentPage} / {totalPages}</span>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1.5 rounded-md hover:bg-muted disabled:opacity-50 transition-colors">التالي</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}





