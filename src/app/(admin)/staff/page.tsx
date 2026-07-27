"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Users, UserPlus, Link as LinkIcon, Trash2, Wallet, Loader2, History, CheckCircle2, Mail, KeyRound, Pencil, X, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import toast from "react-hot-toast";
import Link from "next/link";

export default function StaffManagementPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string>("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("cleaner");
  const [newPhone, setNewPhone] = useState("");
  const [newCost, setNewCost] = useState("");
  const [withdrawModal, setWithdrawModal] = useState<any>(null);
  const [withdrawMethod, setWithdrawMethod] = useState("Contante");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [inviteModal, setInviteModal] = useState<any>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  const [passwordModal, setPasswordModal] = useState<any>(null);
  const [pwdEmail, setPwdEmail] = useState("");
  const [pwdPassword, setPwdPassword] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  const [editModal, setEditModal] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setLoading(true);
    let currentOrgId = "";
    const { data: { user } } = await supabase.auth.getUser();
    if(user) {
        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
        if(profile) currentOrgId = profile.organization_id;
    }
    
    if (!currentOrgId) {
      const { data: fallback } = await supabase.from('organizations').select('id').limit(1).single();
      if (fallback) currentOrgId = fallback.id;
    }
    
    setOrgId(currentOrgId);
      
    // Fetch Staff with their cash ledger balances
    const { data: staffData } = await supabase.from('staff_members').select('*').order('created_at', { ascending: false });
    
    if (staffData) {
      const { data: txData } = await supabase.from('cash_transactions').select('*').eq('status', 'confirmed');
      
      const enrichedStaff = staffData.map(member => {
        const memberTx = txData?.filter(t => t.staff_member_id === member.id) || [];
        const balance = memberTx.reduce((sum, tx) => sum + Number(tx.amount), 0);
        return { ...member, wallet_balance: balance };
      });
      setStaff(enrichedStaff);
    }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    let targetOrgId = orgId;
    if (!targetOrgId) {
      const { data: fallback } = await supabase.from('organizations').select('id').limit(1).single();
      if (fallback) {
        targetOrgId = fallback.id;
        setOrgId(fallback.id);
      }
    }

    if (!targetOrgId) {
      toast.error("Errore Tecnico: Sei senza Organizzazione e il database è vuoto.");
      return;
    }

    setIsCreating(true);
    const { error } = await supabase.from('staff_members').insert([
      { name: newName, role: newRole, phone_number: newPhone, organization_id: targetOrgId, cost_per_service: Number(newCost) || 0 }
    ]);

    if (!error) {
      toast.success("Membro staff creato!");
      setShowCreateModal(false);
      setNewName("");
      setNewRole("cleaner");
      setNewPhone("");
      setNewCost("");
      fetchStaff();
    }
    setIsCreating(false);
  };

  const sendInvite = async () => {
    if (!inviteEmail || !inviteModal) return;
    
    setInviteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let token = session?.access_token;
      
      if (!token) {
        const { data: { session: freshSession } } = await supabase.auth.refreshSession();
        token = freshSession?.access_token;
      }
      
      if (!token) {
        toast.error("Sessione scaduta. Riprova ad effettuare il login.");
        setInviteLoading(false);
        return;
      }
      
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          staff_id: inviteModal.id,
          email: inviteEmail,
          name: inviteModal.name
        })
      });
      
      const data = await res.json();
      
      if (data.url) {
        setInviteLink(data.url);
        toast.success("Ecco il link di invito!");
      } else if (data.success) {
        toast.success("Email di invito inviata!");
        setInviteModal(null);
        setInviteEmail("");
      } else {
        toast.error(data.error || "Errore nell'invio");
      }
    } catch (err) {
      toast.error("Errore nell'invio");
    } finally {
      setInviteLoading(false);
    }
  };

  const deleteStaff = async (id: string) => {
    if(!confirm("Sicuro di voler eliminare questo addetto?")) return;
    const { error } = await supabase.from('staff_members').delete().eq('id', id);
    if(error) toast.error("Errore cancellazione");
    else fetchStaff();
  };

  const copyMagicLink = (token: string) => {
    const url = `${window.location.origin}/b?token=${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copiato negli appunti");
  };

  const handleVersamentoManager = async () => {
    if (!withdrawModal) return;
    const member = withdrawModal;
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0 || amount > member.wallet_balance) {
        toast.error("Importo non valido");
        return;
    }
    const { error: err1 } = await supabase.from('cash_transactions').insert({
        organization_id: member.organization_id,
        amount: -amount,
        notes: `[${withdrawMethod}] [Giroconto] Uscita da portafoglio dipendente`,
        status: 'confirmed',
        transaction_type: 'manager_handover',
        staff_member_id: member.id,
    });
    
    const { error: err2 } = await supabase.from('cash_transactions').insert({
        organization_id: member.organization_id,
        amount: amount,
        notes: `[${withdrawMethod}] [Giroconto] Entrata in cassaforte (Versamento da ${member.name})`,
        status: 'confirmed',
        transaction_type: 'manager_handover',
        staff_member_id: null,
    });

    if (err1 || err2) {
        console.error("Giroconto err:", err1, err2);
        toast.error("Errore registrazione giroconto");
    } else { 
        toast.success("Portafoglio azzerato e Giroconto completato"); 
        setWithdrawModal(null);
        fetchStaff(); 
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center">
          <Users className="w-8 h-8 text-blue-600 mr-3" />
          Anagrafica Staff
        </h1>
        <p className="text-gray-500 font-medium">Gestisci i collaboratori e visualizza il saldo contante da ritirare.</p>
      </div>

      <div className="flex justify-end">
        <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-sm hover:bg-blue-700 transition">
          <Plus className="w-5 h-5" /> Nuovo Addetto
        </button>
      </div>

      {/* MODALE CREAZIONE */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" /> Nuovo Addetto
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome Completo *</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Es. Mario Rossi" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Ruolo</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="cleaner">Addetto Pulizie</option>
                  <option value="reception">Accoglienza / Check-In</option>
                  <option value="maintenance">Manutentore</option>
                  <option value="marketing">Gestione / Marketing Commerciale</option>
                  <option value="manager">Responsabile / Area Manager</option>
                  <option value="admin">Amministratore / Power User</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Telefono (Opzionale)</label>
                <input type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="+39 ..." />
              </div>
              <div>
                <label className="block text-sm font-bold text-amber-700 mb-1">Nostro Costo ad intervento (€)</label>
                <input type="number" step="0.01" value={newCost} onChange={e => setNewCost(e.target.value)} className="w-full border border-amber-300 p-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 bg-amber-50 outline-none" placeholder="Es. 15.00" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition">Annulla</button>
                <button type="submit" disabled={isCreating || !newName} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-sm hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2">
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Crea Profilo Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista Addetti */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
          ) : staff.length === 0 ? (
            <div className="p-12 text-center text-gray-500">Nessun addetto registrato. Clicca su "Nuovo Addetto".</div>
          ) : (
            <div className="overflow-x-auto">
               <table className="w-full text-left text-sm whitespace-nowrap">
                 <thead className="bg-gray-50 border-b border-gray-200">
                   <tr>
                     <th className="px-6 py-4 font-bold text-gray-700">Addetto</th>
                     <th className="px-6 py-4 font-bold text-gray-700 text-right">Saldo Portafogli</th>
                     <th className="px-6 py-4 font-bold text-gray-700 text-right">Azioni</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {staff.map(s => (
                     <tr key={s.id} className="hover:bg-gray-50 transition">
                       <td className="px-6 py-4">
                         <div className="font-bold text-gray-900 text-base">{s.name}</div>
                         <div className="text-gray-500 capitalize">
                            {s.role === 'cleaner' ? 'Addetto Pulizie' : 
                             s.role === 'reception' ? 'Accoglienza' : 
                             s.role === 'maintenance' ? 'Manutentore' : s.role}
                         </div>
                       </td>
                       <td className="px-6 py-4 text-right">
                         <div className={`text-lg font-bold flex items-center justify-end ${s.wallet_balance < 0 ? 'text-red-600' : s.wallet_balance > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                           <Wallet className="w-4 h-4 mr-1.5 opacity-50" />
                           {formatCurrency(s.wallet_balance)}
                         </div>
                         {s.wallet_balance > 0 && <div className="text-[10px] text-gray-400 font-medium">Da versare in amministrazione</div>}
                         {s.wallet_balance < 0 && <div className="text-[10px] text-gray-400 font-medium">A credito</div>}
                       </td>
                       <td className="px-6 py-4">
                          <div className="flex justify-end gap-2 flex-wrap">
                            {s.wallet_balance > 0 && (
                              <button onClick={() => { setWithdrawModal(s); setWithdrawAmount(String(s.wallet_balance)); }} className="px-3 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg flex items-center font-bold shadow-sm transition text-sm" title="Incassa il saldo da questo dipendente per azzerare il suo debito">
                                 <CheckCircle2 className="w-4 h-4 mr-1.5" /> Ritira {formatCurrency(s.wallet_balance)}
                              </button>
                            )}
                             <Link href={`/cassa?staff_id=${s.id}`} className="px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg flex items-center font-bold border border-blue-100 transition shadow-sm text-sm" title="Vedi Movimenti Cassa">
                                <History className="w-4 h-4 mr-1.5" /> Movimenti
                             </Link>
                             <button onClick={() => { setEditModal(s); setEditName(s.name); setEditRole(s.role); setEditPhone(s.phone_number || ""); setEditCost(String(s.cost_per_service || "")); }} className="px-3 py-2.5 bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center font-medium transition text-sm" title="Modifica addetto">
                                <Pencil className="w-4 h-4 mr-1.5" /> Modifica
                              </button>
                              {!s.user_id && (
                                <button onClick={() => { setPasswordModal(s); setPwdEmail(""); setPwdPassword(""); }} className="px-3 py-2.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg flex items-center font-medium transition text-sm" title="Imposta password manualmente">
                                  <KeyRound className="w-4 h-4 mr-1.5" /> Password
                                </button>
                              )}
                             <button onClick={() => { setInviteModal(s); setInviteEmail(""); setInviteLink(""); }} className="px-3 py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg flex items-center font-medium transition text-sm" title="Invia invito">
                                <Mail className="w-4 h-4 mr-1.5" /> Invita
                              </button>
                            <button onClick={() => deleteStaff(s.id)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Elimina Anagrafica">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>
          )}
        </div>

      {/* Modale Invito */}
      {inviteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold tracking-tight text-gray-900">Invita {inviteModal.name}</h3>
              <button 
                onClick={() => setInviteModal(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                X
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Email del nuovo membro</label>
                <input
                  type="email"
                  className="w-full text-base p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="esempio@email.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              
              {inviteLink && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Link di invito</label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      className="w-full text-sm p-2 border rounded bg-gray-50 text-gray-600"
                      value={inviteLink}
                    />
                    <button 
                      onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success("Copiato!"); }}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg font-medium"
                    >
                      Copia
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 rounded-b-2xl border-t border-gray-100">
              <button 
                onClick={() => setInviteModal(null)} 
                className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 transition hover:bg-gray-200 rounded-xl"
              >
                Chiudi
              </button>
              {!inviteLink && (
                <button 
                  onClick={sendInvite}
                  disabled={!inviteEmail || inviteLoading}
                  className="px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold shadow-sm flex items-center transition disabled:opacity-50"
                >
                  {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Invia Invito
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modale Imposta Password */}
      {passwordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold tracking-tight text-gray-900">Imposta Password per {passwordModal.name}</h3>
              <button 
                onClick={() => setPasswordModal(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                X
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!pwdEmail || !pwdPassword) return;

              setPwdLoading(true);
              try {
                const { data: { session } } = await supabase.auth.getSession();
                let token = session?.access_token;

                if (!token) {
                  const { data: { session: freshSession } } = await supabase.auth.refreshSession();
                  token = freshSession?.access_token;
                }

                if (!token) {
                  toast.error("Sessione scaduta. Riprova ad effettuare il login.");
                  setPwdLoading(false);
                  return;
                }

                const res = await fetch('/api/staff/set-password', {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                  },
                  body: JSON.stringify({
                    staff_id: passwordModal.id,
                    email: pwdEmail,
                    password: pwdPassword,
                    name: passwordModal.name
                  })
                });

                const data = await res.json();

                if (data.success) {
                  toast.success("Account creato con password!");
                  setPasswordModal(null);
                  fetchStaff();
                } else {
                  toast.error(data.error || "Errore nella creazione");
                }
              } catch (err) {
                toast.error("Errore nella creazione");
              } finally {
                setPwdLoading(false);
              }
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Email per l'accesso</label>
                <input
                  type="email"
                  required
                  className="w-full text-base p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="esempio@email.com"
                  value={pwdEmail}
                  onChange={(e) => setPwdEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  className="w-full text-base p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="Minimo 6 caratteri"
                  value={pwdPassword}
                  onChange={(e) => setPwdPassword(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setPasswordModal(null)} 
                  className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 transition hover:bg-gray-200 rounded-xl"
                >
                  Annulla
                </button>
                <button 
                  type="submit"
                  disabled={!pwdEmail || !pwdPassword || pwdLoading}
                  className="px-5 py-2.5 bg-amber-600 text-white hover:bg-amber-700 rounded-xl font-bold shadow-sm flex items-center transition disabled:opacity-50"
                >
                  {pwdLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                  Crea Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale Modifica Addetto */}
      {editModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold tracking-tight text-gray-900">Modifica {editModal.name}</h3>
              <button onClick={() => setEditModal(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition">X</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!editName) return;
              setEditSaving(true);
              const { error } = await supabase.from('staff_members').update({
                name: editName,
                role: editRole,
                phone_number: editPhone || null,
                cost_per_service: Number(editCost) || 0,
              }).eq('id', editModal.id);
              if (error) {
                toast.error("Errore salvataggio");
              } else {
                toast.success("Addetto aggiornato!");
                setEditModal(null);
                fetchStaff();
              }
              setEditSaving(false);
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome Completo</label>
                <input type="text" required value={editName} onChange={e => setEditName(e.target.value)} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Ruolo</label>
                <select value={editRole} onChange={e => setEditRole(e.target.value)} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="cleaner">Addetto Pulizie</option>
                  <option value="reception">Accoglienza / Check-In</option>
                  <option value="maintenance">Manutentore</option>
                  <option value="marketing">Gestione / Marketing Commerciale</option>
                  <option value="manager">Responsabile / Area Manager</option>
                  <option value="admin">Amministratore / Power User</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Telefono</label>
                <input type="tel" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500" placeholder="+39 ..." />
              </div>
              <div>
                <label className="block text-sm font-bold text-amber-700 mb-1">Nostro Costo ad intervento (€)</label>
                <input type="number" step="0.01" value={editCost} onChange={e => setEditCost(e.target.value)} className="w-full border border-amber-300 p-2.5 rounded-lg focus:ring-2 focus:ring-amber-500 bg-amber-50" placeholder="Es. 15.00" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditModal(null)} className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 transition hover:bg-gray-200 rounded-xl">Annulla</button>
                <button type="submit" disabled={editSaving || !editName} className="px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold shadow-sm transition disabled:opacity-50">
                  {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salva Modifiche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale Ritiro Contante */}
      {withdrawModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold tracking-tight text-gray-900">Registra Versamento</h3>
              <button 
                onClick={() => setWithdrawModal(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                X
              </button>
            </div>
            
            <div className="p-6 space-y-4">
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Addetto</label>
                  <div className="w-full text-sm p-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 font-medium">
                     {withdrawModal.name}
                  </div>
               </div>
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Importo da ritirare (€)</label>
                  <input
                     type="number"
                     step="0.01"
                     max={withdrawModal.wallet_balance}
                     className="w-full text-xl p-3 border border-gray-300 rounded-xl bg-white text-emerald-700 font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                     value={withdrawAmount}
                     onChange={(e) => setWithdrawAmount(e.target.value)}
                  />
                  <div className="text-xs text-gray-500 mt-1">Massimo ritirabile: {formatCurrency(withdrawModal.wallet_balance)}</div>
               </div>
               <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Metodo di Versamento</label>
                  <select 
                     className="w-full text-base p-3 border border-gray-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                     value={withdrawMethod}
                     onChange={(e) => setWithdrawMethod(e.target.value)}
                  >
                     <option>Contante</option>
                     <option>Bonifico</option>
                     <option>Bonifico Immediato</option>
                     <option>Stripe</option>
                  </select>
               </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3 rounded-b-2xl border-t border-gray-100">
              <button 
                onClick={() => setWithdrawModal(null)} 
                className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 transition hover:bg-gray-200 rounded-xl"
              >
                Annulla
              </button>
              <button 
                onClick={() => handleVersamentoManager()}
                className="px-5 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-bold shadow-sm flex items-center transition"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Conferma Ritiro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
