"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, ShieldCheck, Mail, Key, Users, Edit2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface User {
  id: string;
  email: string;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Add user state
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [twofaSecret, setTwofaSecret] = useState("");
  const [twofaCode, setTwofaCode] = useState(["", "", "", "", "", ""]);
  
  // Edit user state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  
  // Shared state
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const OWNER_EMAIL = "hi@adham.business";

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      
      const fetchedUsers: User[] = data.users || [];
      const hasOwner = fetchedUsers.some(u => u.email.toLowerCase() === OWNER_EMAIL.toLowerCase());
      
      if (!hasOwner) {
        fetchedUsers.unshift({
          id: "owner-id-static",
          email: OWNER_EMAIL,
          created_at: new Date().toISOString()
        });
      }
      
      setUsers(fetchedUsers);
    } catch {
      console.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  // --- ADD USER LOGIC ---
  
  const handleNextStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword) {
      setError("الرجاء إدخال البريد وكلمة المرور");
      return;
    }
    setError("");
    setIsSubmitting(true);
    
    try {
      const res = await fetch("/api/users/generate-2fa", { method: "POST" });
      const data = await res.json();
      setTwofaSecret(data.secret);
      setStep(2);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch {
      setError("حدث خطأ أثناء إنشاء كود 2FA");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...twofaCode];
    newCode[index] = value.slice(-1);
    setTwofaCode(newCode);
    setError("");

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    if (value && index === 5) {
      const fullCode = newCode.join("");
      if (fullCode.length === 6) handleCreateUser(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !twofaCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setTwofaCode(pasted.split(""));
      handleCreateUser(pasted);
    }
  };

  const handleCreateUser = async (fullCode?: string) => {
    const codeStr = fullCode || twofaCode.join("");
    if (codeStr.length !== 6) return;
    
    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          secret: twofaSecret,
          code: codeStr,
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error);
        setTwofaCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
        setIsSubmitting(false);
        return;
      }

      await fetchUsers();
      closeModal();
    } catch {
      setError("حدث خطأ في الاتصال");
      setIsSubmitting(false);
    }
  };

  // --- EDIT USER LOGIC ---
  
  const openEditModal = (user: User) => {
    if (user.email.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
      alert("لا يمكن تعديل حساب المالك الأساسي");
      return;
    }
    setEditingUser(user);
    setEditEmail(user.email);
    setEditPassword("");
    setError("");
    setShowEditModal(true);
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    if (!editEmail) {
      setError("الرجاء إدخال البريد الإلكتروني");
      return;
    }
    
    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: editEmail,
          password: editPassword || undefined, // Only send if changed
        }),
      });

      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error);
        setIsSubmitting(false);
        return;
      }

      await fetchUsers();
      closeModal();
    } catch {
      setError("حدث خطأ في الاتصال");
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (email.toLowerCase() === OWNER_EMAIL.toLowerCase()) {
      alert("لا يمكن حذف حساب المالك الأساسي");
      return;
    }
    
    if (!confirm("هل أنت متأكد من حذف هذا المستخدم؟")) return;
    
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (res.ok) fetchUsers();
    } catch {
      console.error("Failed to delete user");
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setStep(1);
    setNewEmail("");
    setNewPassword("");
    setTwofaSecret("");
    setTwofaCode(["", "", "", "", "", ""]);
    setEditingUser(null);
    setEditEmail("");
    setEditPassword("");
    setError("");
    setIsSubmitting(false);
  };

  const getTotpUri = () => {
    return `otpauth://totp/Admin:${newEmail}?secret=${twofaSecret}&issuer=OBAdmin`;
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">المتحكمين</h1>
          <p className="text-sm text-muted-foreground">إدارة مديري النظام وإنشاء حسابات المتحكمين</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 text-foreground px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          إضافة مدير
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">لا يوجد مدراء حالياً</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-muted border-b border-border">
                <tr>
                  <th className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase">المستخدم</th>
                  <th className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase">تاريخ الإضافة</th>
                  <th className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase w-28">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-accent transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {user.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-muted-foreground">
                          {user.email}
                          {user.email.toLowerCase() === OWNER_EMAIL.toLowerCase() && (
                            <span className="ml-2 inline-flex items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
                              مالك
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString("ar-SA")}
                    </td>
                    <td className="px-6 py-4">
                      {user.email.toLowerCase() !== OWNER_EMAIL.toLowerCase() && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-2 text-muted-foreground hover:text-primary hover:bg-blue-400/10 rounded-lg transition-colors"
                            title="تعديل"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ADD USER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">إضافة مدير جديد</h2>
            </div>
            
            <div className="p-6">
              {step === 1 ? (
                <form onSubmit={handleNextStep} className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Mail className="w-4 h-4" />
                      البريد الإلكتروني
                    </label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Key className="w-4 h-4" />
                      كلمة المرور
                    </label>
                    <input
                      type="text"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      dir="ltr"
                    />
                  </div>
                  
                  {error && <p className="text-destructive text-sm">{error}</p>}
                  
                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-accent rounded-lg transition-colors"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-foreground bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
                    >
                      التالي
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6 text-center">
                  <div>
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-4">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <h3 className="text-foreground font-medium mb-2">تفعيل التحقق بخطوتين</h3>
                    <p className="text-sm text-muted-foreground mb-6">امسح الكود باستخدام Google Authenticator</p>
                  </div>

                  <div className="bg-white p-4 rounded-xl inline-block mx-auto">
                    <QRCodeSVG value={getTotpUri()} size={160} />
                  </div>
                  
                  <p className="text-xs text-muted-foreground font-mono tracking-widest">{twofaSecret}</p>

                  <div className="pt-2 border-t border-border">
                    <p className="text-sm text-muted-foreground mb-4">أدخل كود التحقق لتأكيد الإضافة</p>
                    <div className="flex justify-center gap-2" dir="ltr">
                      {twofaCode.map((digit, index) => (
                        <input
                          key={index}
                          ref={(el) => { inputRefs.current[index] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleCodeChange(index, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          onPaste={index === 0 ? handlePaste : undefined}
                          className="w-10 h-12 text-center text-lg font-bold bg-muted border border-border rounded-lg text-foreground focus:outline-none focus:border-blue-500 transition-colors"
                        />
                      ))}
                    </div>
                  </div>

                  {error && <p className="text-destructive text-sm">{error}</p>}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-accent rounded-lg transition-colors"
                    >
                      رجوع
                    </button>
                    <button
                      onClick={() => handleCreateUser()}
                      disabled={isSubmitting || twofaCode.join("").length !== 6}
                      className="flex-1 px-4 py-2.5 text-sm font-medium text-foreground bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
                    >
                      تأكيد وحفظ
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">تعديل حساب المدير</h2>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleEditUser} className="space-y-4">
                <div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Mail className="w-4 h-4" />
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <Key className="w-4 h-4" />
                    كلمة المرور الجديدة <span className="text-xs text-muted-foreground">(اختياري)</span>
                  </label>
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="اتركه فارغاً لعدم التغيير"
                    className="w-full bg-muted border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder:text-muted-foreground"
                    dir="ltr"
                  />
                </div>
                
                {error && <p className="text-destructive text-sm">{error}</p>}
                
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-accent rounded-lg transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2.5 text-sm font-medium text-foreground bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50"
                  >
                    حفظ التعديلات
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
