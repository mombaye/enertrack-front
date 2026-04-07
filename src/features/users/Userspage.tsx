// src/pages/UsersPage.tsx
import { useState, useMemo } from "react";
import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  UserPlus, Search, Shield, Eye, EyeOff, Pencil,
  Trash2, X, Check, Loader2, Users, Globe, Lock,
} from "lucide-react";
import { api } from "@/services/api";
import { useAuth } from "@/auth/AuthContext";

// ─── Types ───────────────────────────────────────────────────────────────────
interface AppUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "admin" | "manager" | "analyst";
  pays: string;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
}

// ─── API calls ───────────────────────────────────────────────────────────────
const usersApi = {
  list:         (params?: object) => api.get("/users/", { params }).then(r => r.data),
  create:       (d: object)       => api.post("/users/", d).then(r => r.data),
  update:       (id: number, d: object) => api.patch(`/users/${id}/`, d).then(r => r.data),
  remove:       (id: number)      => api.delete(`/users/${id}/`).then(r => r.data),
  toggleActive: (id: number)      => api.post(`/users/${id}/toggle-active/`).then(r => r.data),
};

// ─── Tokens ──────────────────────────────────────────────────────────────────
const T = {
  blue:   "#1e3a8a",
  blueMd: "#1e40af",
  orange: "#E8401C",
  white:  "#ffffff",
  off:    "#f0f4ff",
  offDk:  "#f8faff",
  border: "rgba(30,58,138,.09)",
  shadow: "0 1px 3px rgba(30,58,138,.04), 0 8px 28px rgba(30,58,138,.06)",
  sm:     "0 1px 3px rgba(30,58,138,.04)",
};

// ─── Config ──────────────────────────────────────────────────────────────────
const ROLES: { val: AppUser["role"]; label: string; color: string; bg: string; border: string }[] = [
  { val:"admin",   label:"Admin",    color:"#dc2626", bg:"#fef2f2", border:"#fecaca"  },
  { val:"manager", label:"Manager",  color:"#d97706", bg:"#fffbeb", border:"#fde68a"  },
  { val:"analyst", label:"Analyste", color:T.blue,    bg:T.off,     border:"#bfdbfe"  },
];
const PAYS_OPTIONS = [
  { val:"sen", label:"Sénégal"      },
  { val:"civ", label:"Côte d'Ivoire"},
  { val:"cam", label:"Cameroun"     },
  { val:"td",  label:"Tchad"        },
  { val:"bfa", label:"Burkina Faso" },
];

function roleCfg(role: string) {
  return ROLES.find(r => r.val === role) ?? ROLES[2];
}
function paysLabel(pays: string) {
  return PAYS_OPTIONS.find(p => p.val === pays)?.label ?? pays;
}
function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR", { day:"2-digit", month:"short", year:"numeric" });
}

// ─── Small shared ─────────────────────────────────────────────────────────────
function OrangeBar() {
  return <div style={{ position:"absolute",top:0,left:0,right:0,height:3, background:`linear-gradient(90deg,${T.orange},#ff7350,transparent)` }}/>;
}

const inputStyle: React.CSSProperties = {
  width:"100%", background:T.offDk,
  border:`1.5px solid ${T.border}`,
  borderRadius:9, padding:"9px 12px",
  fontSize:13, color:"#0f172a",
  fontFamily:"'DM Sans',sans-serif",
  outline:"none",
  transition:"border-color .15s, box-shadow .15s",
};

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase" as const,letterSpacing:".1em",marginBottom:5 }}>
      {children} {required && <span style={{color:T.orange}}>*</span>}
    </div>
  );
}

function RolePill({ role }: { role: string }) {
  const c = roleCfg(role);
  return (
    <span style={{
      fontSize:10.5, padding:"3px 10px", borderRadius:100, fontWeight:700,
      color:c.color, background:c.bg, border:`1px solid ${c.border}`,
    }}>{c.label}</span>
  );
}

function ActivePill({ active }: { active: boolean }) {
  return (
    <span style={{
      fontSize:10.5, padding:"3px 9px", borderRadius:100, fontWeight:700,
      color: active ? "#059669" : "#94a3b8",
      background: active ? "#f0fdf4" : "#f8fafc",
      border:`1px solid ${active ? "#a7f3d0" : "#e2e8f0"}`,
      display:"inline-flex", alignItems:"center", gap:4,
    }}>
      <div style={{ width:5,height:5,borderRadius:"50%",background: active ? "#10b981" : "#cbd5e1" }}/>
      {active ? "Actif" : "Inactif"}
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ user }: { user: AppUser }) {
  const colors = ["#1e3a8a","#0ea5e9","#10b981","#f59e0b","#E8401C","#8b5cf6"];
  const idx = user.username.charCodeAt(0) % colors.length;
  return (
    <div style={{
      width:34, height:34, borderRadius:10, flexShrink:0,
      background: colors[idx],
      display:"grid", placeItems:"center",
      fontFamily:"'Outfit',sans-serif", fontSize:13, fontWeight:800, color:"white",
    }}>
      {user.username[0].toUpperCase()}
    </div>
  );
}

// ─── Form modal ───────────────────────────────────────────────────────────────
type FormMode = "create" | "edit";
interface FormData {
  username: string; email: string;
  first_name: string; last_name: string;
  role: string; pays: string;
  is_active: boolean;
  password: string; password2: string;
}
const EMPTY_FORM: FormData = {
  username:"", email:"", first_name:"", last_name:"",
  role:"analyst", pays:"sen", is_active:true,
  password:"", password2:"",
};

function UserModal({ mode, initial, onClose, onSave, loading }: {
  mode: FormMode;
  initial: FormData;
  onClose: () => void;
  onSave: (data: FormData) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<FormData>(initial);
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string,string>>({});

  function set(k: keyof FormData, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => { const n = {...e}; delete n[k]; return n; });
  }

  function validate() {
    const e: Record<string,string> = {};
    if (!form.username.trim())      e.username = "Requis";
    if (!form.email.trim())         e.email    = "Requis";
    if (mode === "create") {
      if (!form.password)           e.password = "Requis";
      if (form.password !== form.password2) e.password2 = "Ne correspond pas";
    } else if (form.password || form.password2) {
      if (form.password !== form.password2) e.password2 = "Ne correspond pas";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:200,
      display:"flex", alignItems:"center", justifyContent:"center",
      background:"rgba(0,0,0,.45)", backdropFilter:"blur(4px)",
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background:T.white, borderRadius:20,
        border:`1px solid ${T.border}`, boxShadow:"0 24px 60px rgba(0,0,0,.18)",
        width:"100%", maxWidth:480, maxHeight:"92vh", overflowY:"auto",
        position:"relative",
        animation:"modal-in .25s cubic-bezier(.22,1,.36,1) both",
      }}>
        <OrangeBar/>

        {/* Header */}
        <div style={{ padding:"22px 24px 16px", borderBottom:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontFamily:"'Outfit',sans-serif",fontSize:16,fontWeight:800,color:"#0f172a" }}>
                {mode === "create" ? "Nouvel utilisateur" : "Modifier l'utilisateur"}
              </div>
              <div style={{ fontSize:11,color:"#94a3b8",marginTop:2 }}>
                {mode === "create" ? "Créer un compte EnerTrack" : `Modification de ${initial.username}`}
              </div>
            </div>
            <button onClick={onClose} style={{
              width:32,height:32,borderRadius:9,border:`1px solid ${T.border}`,
              background:"white",cursor:"pointer",display:"grid",placeItems:"center",color:"#94a3b8",
            }}>
              <X size={15}/>
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding:"20px 24px", display:"flex", flexDirection:"column", gap:14 }}>

          {/* Name row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <FieldLabel>Prénom</FieldLabel>
              <input value={form.first_name} onChange={e => set("first_name", e.target.value)} style={inputStyle} placeholder="Jean"/>
            </div>
            <div>
              <FieldLabel>Nom</FieldLabel>
              <input value={form.last_name} onChange={e => set("last_name", e.target.value)} style={inputStyle} placeholder="Dupont"/>
            </div>
          </div>

          {/* Username */}
          <div>
            <FieldLabel required>Nom d'utilisateur</FieldLabel>
            <input value={form.username} onChange={e => set("username", e.target.value)}
              style={{ ...inputStyle, borderColor: errors.username ? "#fecaca" : T.border }}
              placeholder="jean.dupont"
            />
            {errors.username && <div style={{fontSize:11,color:"#dc2626",marginTop:3}}>{errors.username}</div>}
          </div>

          {/* Email */}
          <div>
            <FieldLabel required>Email</FieldLabel>
            <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
              style={{ ...inputStyle, borderColor: errors.email ? "#fecaca" : T.border }}
              placeholder="jean.dupont@camusat.com"
            />
            {errors.email && <div style={{fontSize:11,color:"#dc2626",marginTop:3}}>{errors.email}</div>}
          </div>

          {/* Role + Pays */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div>
              <FieldLabel>Rôle</FieldLabel>
              <select value={form.role} onChange={e => set("role", e.target.value)} style={inputStyle}>
                {ROLES.map(r => <option key={r.val} value={r.val}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Pays</FieldLabel>
              <select value={form.pays} onChange={e => set("pays", e.target.value)} style={inputStyle}>
                {PAYS_OPTIONS.map(p => <option key={p.val} value={p.val}>{p.label}</option>)}
              </select>
            </div>
          </div>

          {/* Active toggle */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
            padding:"10px 14px", borderRadius:10, background:T.offDk, border:`1px solid ${T.border}` }}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"#0f172a"}}>Compte actif</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>L'utilisateur peut se connecter</div>
            </div>
            <button onClick={() => set("is_active", !form.is_active)} style={{
              width:44,height:24,borderRadius:100,border:"none",cursor:"pointer",
              background: form.is_active ? "#10b981" : "#e2e8f0",
              position:"relative", transition:"background .2s", flexShrink:0,
            }}>
              <div style={{
                position:"absolute", top:2, left: form.is_active ? "calc(100% - 22px)" : 2,
                width:20, height:20, borderRadius:"50%",
                background:"white", boxShadow:"0 1px 4px rgba(0,0,0,.2)",
                transition:"left .2s",
              }}/>
            </button>
          </div>

          {/* Password */}
          <div style={{
            padding:"14px", borderRadius:12,
            background:T.offDk, border:`1px solid ${T.border}`,
          }}>
            <div style={{fontSize:11,fontWeight:700,color:"#94a3b8",textTransform:"uppercase" as const,letterSpacing:".1em",marginBottom:12}}>
              {mode === "create" ? "Mot de passe *" : "Nouveau mot de passe (laisser vide = inchangé)"}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ position:"relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  value={form.password}
                  onChange={e => set("password", e.target.value)}
                  style={{ ...inputStyle, borderColor: errors.password ? "#fecaca" : T.border, paddingRight:40 }}
                  placeholder="••••••••"
                />
                <button onClick={() => setShowPw(v => !v)} style={{
                  position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
                  background:"none",border:"none",cursor:"pointer",color:"#94a3b8",
                  display:"grid",placeItems:"center",
                }}>
                  {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
                {errors.password && <div style={{fontSize:11,color:"#dc2626",marginTop:3}}>{errors.password}</div>}
              </div>
              <div style={{ position:"relative" }}>
                <input
                  type={showPw ? "text" : "password"}
                  value={form.password2}
                  onChange={e => set("password2", e.target.value)}
                  style={{ ...inputStyle, borderColor: errors.password2 ? "#fecaca" : T.border }}
                  placeholder="Confirmation ••••••••"
                />
                {errors.password2 && <div style={{fontSize:11,color:"#dc2626",marginTop:3}}>{errors.password2}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding:"14px 24px 20px",
          borderTop:`1px solid ${T.border}`,
          display:"flex", gap:10, justifyContent:"flex-end",
        }}>
          <button onClick={onClose} style={{
            padding:"9px 18px", borderRadius:9,
            border:`1px solid ${T.border}`, background:"white",
            fontSize:13, fontWeight:600, color:"#475569", cursor:"pointer",
            fontFamily:"'DM Sans',sans-serif",
          }}>
            Annuler
          </button>
          <button
            onClick={() => { if (validate()) onSave(form); }}
            disabled={loading}
            style={{
              display:"flex", alignItems:"center", gap:7,
              padding:"9px 20px", borderRadius:9,
              background: loading ? "#94a3b8" : T.blue,
              color:"white", border:"none", cursor: loading ? "not-allowed" : "pointer",
              fontSize:13, fontWeight:700,
              fontFamily:"'Outfit',sans-serif",
              boxShadow: loading ? "none" : "0 4px 14px rgba(30,58,138,.25)",
            }}
          >
            {loading ? <Loader2 size={14} style={{animation:"spin .8s linear infinite"}}/> : <Check size={14}/>}
            {mode === "create" ? "Créer l'utilisateur" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────
function DeleteModal({ user, onClose, onConfirm, loading }: {
  user: AppUser; onClose: () => void; onConfirm: () => void; loading: boolean;
}) {
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:200,
      display:"flex", alignItems:"center", justifyContent:"center",
      background:"rgba(0,0,0,.45)", backdropFilter:"blur(4px)",
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background:T.white, borderRadius:18, border:`1px solid ${T.border}`,
        boxShadow:"0 24px 60px rgba(0,0,0,.18)", width:380, padding:"24px",
        animation:"modal-in .25s cubic-bezier(.22,1,.36,1) both",
        position:"relative",
      }}>
        <div style={{ position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#dc2626,#f87171,transparent)",borderRadius:"18px 18px 0 0" }}/>
        <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:18 }}>
          <div style={{ width:40,height:40,borderRadius:11,background:"#fef2f2",border:"1px solid #fecaca",display:"grid",placeItems:"center",flexShrink:0 }}>
            <Trash2 size={18} style={{color:"#dc2626"}}/>
          </div>
          <div>
            <div style={{fontFamily:"'Outfit',sans-serif",fontSize:15,fontWeight:800,color:"#0f172a"}}>Supprimer l'utilisateur</div>
            <div style={{fontSize:12,color:"#94a3b8",marginTop:2}}>Cette action est irréversible.</div>
          </div>
        </div>
        <div style={{ padding:"12px 14px",borderRadius:10,background:"#fef2f2",border:"1px solid #fecaca",marginBottom:18,fontSize:13 }}>
          Vous allez supprimer le compte de <strong style={{color:"#991b1b"}}>{user.username}</strong> ({user.email}).
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{ padding:"8px 16px",borderRadius:9,border:`1px solid ${T.border}`,background:"white",fontSize:13,fontWeight:600,color:"#475569",cursor:"pointer",fontFamily:"'DM Sans',sans-serif" }}>
            Annuler
          </button>
          <button onClick={onConfirm} disabled={loading} style={{
            display:"flex",alignItems:"center",gap:6,
            padding:"8px 16px",borderRadius:9,border:"none",
            background:loading?"#94a3b8":"#dc2626",color:"white",
            fontSize:13,fontWeight:700,cursor:loading?"not-allowed":"pointer",
            fontFamily:"'Outfit',sans-serif",
          }}>
            {loading ? <Loader2 size={13} style={{animation:"spin .8s linear infinite"}}/> : <Trash2 size={13}/>}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();

  const [search,     setSearch]     = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [modal,      setModal]      = useState<{ mode: FormMode; user?: AppUser } | null>(null);
  const [delUser,    setDelUser]    = useState<AppUser | null>(null);

  // ── Query
  const { data, isLoading } = useQuery({
    queryKey: ["users", { search, role: roleFilter }],
    queryFn: () => usersApi.list({ search: search || undefined, role: roleFilter || undefined }),
    placeholderData: keepPreviousData,
  });
  const users: AppUser[] = Array.isArray(data) ? data : data?.results ?? [];

  // ── Mutations
  function inv() { qc.invalidateQueries({ queryKey: ["users"] }); }

  const createMut = useMutation({
    mutationFn: (d: FormData) => {
      const payload = { ...d };
      return usersApi.create(payload); // ne pas supprimer password2
    },
    onSuccess: () => {
      toast.success("Utilisateur créé");
      setModal(null);
      inv();
    },
    onError: (e: any) => {
      const data = e?.response?.data;
      const msg =
        data?.detail ||
        data?.password?.[0] ||
        data?.password2?.[0] ||
        data?.email?.[0] ||
        data?.username?.[0] ||
        "Erreur création";
      toast.error(msg);
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: FormData }) => {
      const payload: any = { ...d };
      if (!payload.password) { delete payload.password; delete payload.password2; }
      return usersApi.update(id, payload);
    },
    onSuccess: () => { toast.success("Utilisateur modifié"); setModal(null); inv(); },
    onError:   (e: any) => toast.error(e?.response?.data?.detail || "Erreur modification"),
  });
  const deleteMut = useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: () => { toast.success("Utilisateur supprimé"); setDelUser(null); inv(); },
    onError:   (e: any) => toast.error(e?.response?.data?.detail || "Erreur suppression"),
  });
  const toggleMut = useMutation({
    mutationFn: (id: number) => usersApi.toggleActive(id),
    onSuccess: (res) => { toast.success(res.detail); inv(); },
    onError:   (e: any) => toast.error(e?.response?.data?.detail || "Erreur"),
  });

  function openCreate() { setModal({ mode:"create" }); }
  function openEdit(u: AppUser) { setModal({ mode:"edit", user: u }); }

  const formInitial = useMemo(() => {
    if (!modal) return EMPTY_FORM;
    if (modal.mode === "create") return EMPTY_FORM;
    const u = modal.user!;
    return { ...EMPTY_FORM, username:u.username, email:u.email, first_name:u.first_name, last_name:u.last_name, role:u.role, pays:u.pays, is_active:u.is_active };
  }, [modal]);

  // Stats
  const stats = useMemo(() => ({
    total:   users.length,
    admins:  users.filter(u => u.role === "admin").length,
    actifs:  users.filter(u => u.is_active).length,
  }), [users]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');
        .up, .up * { font-family:'DM Sans',sans-serif; box-sizing:border-box; }
        .up .display { font-family:'Outfit',sans-serif; }

        @keyframes spin     { to { transform:rotate(360deg); } }
        @keyframes modal-in { from{opacity:0;transform:scale(.95) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes up-in    { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

        .up input:focus, .up select:focus {
          border-color:${T.blue} !important;
          box-shadow:0 0 0 3px rgba(30,58,138,.09) !important;
        }
        .up .user-row { transition:background .12s; }
        .up .user-row:hover { background:#f8faff !important; }
        .up .action-btn {
          width:30px;height:30px;border-radius:8px;
          border:1px solid rgba(30,58,138,.1);
          background:white;cursor:pointer;
          display:grid;place-items:center;
          transition:all .15s;
        }
        .up .action-btn:hover { background:${T.off}; border-color:rgba(30,58,138,.25); }
        .up .action-btn.danger:hover { background:#fef2f2; border-color:#fecaca; color:#dc2626; }
      `}</style>

      <div className="up" style={{ display:"flex", flexDirection:"column", gap:16 }}>

        {/* ══ Header ══════════════════════════════════════════════════════════ */}
        <div style={{
          background:T.white, borderRadius:20,
          border:`1px solid ${T.border}`, boxShadow:T.shadow,
          position:"relative", overflow:"hidden",
          animation:"up-in .35s cubic-bezier(.22,1,.36,1) both",
        }}>
          <OrangeBar/>
          <div style={{ padding:"22px 24px 20px" }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:14, flexWrap:"wrap" }}>
              <div>
                <div style={{ display:"inline-flex",alignItems:"center",gap:6,
                  background:"rgba(232,64,28,.08)",border:"1px solid rgba(232,64,28,.18)",
                  borderRadius:100,padding:"3px 10px",marginBottom:8 }}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:T.orange}}/>
                  <span style={{fontSize:10,fontWeight:700,letterSpacing:".12em",color:T.orange,textTransform:"uppercase"}}>Administration</span>
                </div>
                <h1 className="display" style={{ fontSize:22,fontWeight:800,color:"#0f172a",letterSpacing:"-.025em",margin:0,lineHeight:1.2 }}>
                  Gestion des utilisateurs
                </h1>
                <p style={{ fontSize:13,color:"#64748b",marginTop:4 }}>
                  Créer, modifier et gérer les accès à EnerTrack
                </p>
              </div>
              <button onClick={openCreate} style={{
                display:"flex",alignItems:"center",gap:8,
                padding:"10px 20px",borderRadius:11,
                background:T.blue,color:"white",border:"none",
                fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:700,
                cursor:"pointer",
                boxShadow:"0 4px 14px rgba(30,58,138,.25)",
                transition:"all .18s",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = T.blueMd; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = T.blue; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
              >
                <UserPlus size={16}/> Nouvel utilisateur
              </button>
            </div>

            {/* Stats */}
            <div style={{ display:"flex",gap:10,marginTop:18,paddingTop:16,borderTop:`1px solid rgba(30,58,138,.07)`,flexWrap:"wrap" }}>
              {[
                { label:"Total", value:stats.total, icon:<Users size={13}/>, color:T.blue },
                { label:"Admins", value:stats.admins, icon:<Shield size={13}/>, color:"#dc2626" },
                { label:"Actifs", value:stats.actifs, icon:<Check size={13}/>, color:"#10b981" },
              ].map(({ label, value, icon, color }) => (
                <div key={label} style={{
                  display:"flex",alignItems:"center",gap:8,
                  padding:"7px 14px",borderRadius:10,
                  background:T.offDk,border:`1px solid ${T.border}`,
                }}>
                  <div style={{ width:24,height:24,borderRadius:7,background:`${color}15`,display:"grid",placeItems:"center",color }}>{icon}</div>
                  <span style={{ fontFamily:"'Outfit',sans-serif",fontSize:16,fontWeight:800,color:"#0f172a" }}>{value}</span>
                  <span style={{ fontSize:11,color:"#94a3b8" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══ Filters ══════════════════════════════════════════════════════════ */}
        <div style={{
          background:T.white, borderRadius:14,
          border:`1px solid ${T.border}`, boxShadow:T.sm,
          padding:"14px 18px",
          display:"flex", alignItems:"center", gap:10, flexWrap:"wrap",
          animation:"up-in .4s cubic-bezier(.22,1,.36,1) .06s both",
        }}>
          <div style={{ position:"relative", flex:1, minWidth:200 }}>
            <Search size={13} style={{ position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"#94a3b8",pointerEvents:"none" }}/>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou email…"
              style={{ ...inputStyle, paddingLeft:32, borderRadius:9 }}
            />
          </div>
          <select
            value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            style={{ ...inputStyle, width:"auto", minWidth:140 }}
          >
            <option value="">Tous les rôles</option>
            {ROLES.map(r => <option key={r.val} value={r.val}>{r.label}</option>)}
          </select>
        </div>

        {/* ══ Table ════════════════════════════════════════════════════════════ */}
        <div style={{
          background:T.white, borderRadius:16,
          border:`1px solid ${T.border}`, boxShadow:T.shadow,
          overflow:"hidden",
          animation:"up-in .4s cubic-bezier(.22,1,.36,1) .10s both",
        }}>

          {isLoading ? (
            <div style={{ display:"flex",alignItems:"center",justifyContent:"center",padding:"60px 24px",gap:10,color:"#94a3b8",fontSize:14 }}>
              <Loader2 size={18} style={{animation:"spin .8s linear infinite"}}/> Chargement...
            </div>
          ) : users.length === 0 ? (
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"60px 24px",color:"#94a3b8" }}>
              <Users size={32} style={{marginBottom:10}}/>
              <span style={{fontSize:14}}>Aucun utilisateur trouvé</span>
            </div>
          ) : (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#f0f4ff", borderBottom:"2px solid rgba(30,58,138,.08)" }}>
                  {["Utilisateur","Rôle","Pays","Statut","Dernière connexion","Actions"].map(h => (
                    <th key={h} style={{ padding:"10px 16px",fontSize:10,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:".08em",textAlign:"left",whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} className="user-row"
                    style={{ borderBottom:`1px solid rgba(30,58,138,.05)`,
                      background: u.id === me?.id ? "rgba(30,58,138,.02)" : "white",
                    }}
                  >
                    {/* Utilisateur */}
                    <td style={{ padding:"12px 16px" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                        <Avatar user={u}/>
                        <div>
                          <div style={{ fontSize:13,fontWeight:700,color:"#0f172a",display:"flex",alignItems:"center",gap:6 }}>
                            {u.username}
                            {u.id === me?.id && <span style={{ fontSize:9,padding:"1px 6px",borderRadius:100,background:T.off,color:T.blue,border:`1px solid rgba(30,58,138,.2)`,fontWeight:700,letterSpacing:".06em" }}>Vous</span>}
                          </div>
                          <div style={{ fontSize:11,color:"#94a3b8" }}>{u.email}</div>
                          {(u.first_name || u.last_name) && (
                            <div style={{ fontSize:11,color:"#64748b" }}>{[u.first_name,u.last_name].filter(Boolean).join(" ")}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Rôle */}
                    <td style={{ padding:"12px 16px" }}><RolePill role={u.role}/></td>

                    {/* Pays */}
                    <td style={{ padding:"12px 16px" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:5,fontSize:12,color:"#475569" }}>
                        <Globe size={12} style={{color:"#94a3b8"}}/>
                        {paysLabel(u.pays)}
                      </div>
                    </td>

                    {/* Statut */}
                    <td style={{ padding:"12px 16px" }}><ActivePill active={u.is_active}/></td>

                    {/* Dernière connexion */}
                    <td style={{ padding:"12px 16px",fontSize:11,color:"#94a3b8",whiteSpace:"nowrap" }}>
                      {fmtDate(u.last_login)}
                    </td>

                    {/* Actions */}
                    <td style={{ padding:"12px 16px" }}>
                      <div style={{ display:"flex",gap:5 }}>
                        {/* Edit */}
                        <button className="action-btn" title="Modifier" onClick={() => openEdit(u)}>
                          <Pencil size={13} style={{color:T.blue}}/>
                        </button>

                        {/* Toggle active */}
                        <button
                          className="action-btn"
                          title={u.is_active ? "Désactiver" : "Activer"}
                          disabled={u.id === me?.id || toggleMut.isPending}
                          onClick={() => toggleMut.mutate(u.id)}
                          style={{ opacity: u.id === me?.id ? .35 : 1, cursor: u.id === me?.id ? "not-allowed" : "pointer" }}
                        >
                          {u.is_active
                            ? <EyeOff size={13} style={{color:"#f59e0b"}}/>
                            : <Eye size={13} style={{color:"#10b981"}}/>
                          }
                        </button>

                        {/* Delete */}
                        <button
                          className="action-btn danger"
                          title="Supprimer"
                          disabled={u.id === me?.id}
                          onClick={() => setDelUser(u)}
                          style={{ opacity: u.id === me?.id ? .35 : 1, cursor: u.id === me?.id ? "not-allowed" : "pointer" }}
                        >
                          <Trash2 size={13} style={{color:"#ef4444"}}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ══ Modals ════════════════════════════════════════════════════════════ */}
      {modal && (
        <UserModal
          mode={modal.mode}
          initial={formInitial}
          onClose={() => setModal(null)}
          loading={createMut.isPending || updateMut.isPending}
          onSave={(d) => {
            if (modal.mode === "create") createMut.mutate(d);
            else updateMut.mutate({ id: modal.user!.id, d });
          }}
        />
      )}
      {delUser && (
        <DeleteModal
          user={delUser}
          onClose={() => setDelUser(null)}
          onConfirm={() => deleteMut.mutate(delUser.id)}
          loading={deleteMut.isPending}
        />
      )}
    </>
  );
}