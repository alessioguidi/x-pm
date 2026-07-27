"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Users, UserPlus, Trash2, Mail, RefreshCw, Loader2, Shield, User, MoreVertical } from "lucide-react";
import toast from "react-hot-toast";

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  created_at: string;
}

export default function UsersManagement({ orgId }: { orgId: string }) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("org_staff");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");

  useEffect(() => {
    fetchUsers();
    fetchCurrentUser();
  }, [orgId]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const sendInvite = async () => {
    if (!inviteEmail || !inviteName) return;
    
    setInviteLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let token = session?.access_token;
      
      if (!token) {
        const { data: { session: freshSession } } = await supabase.auth.refreshSession();
        token = freshSession?.access_token;
      }

      const res = await fetch('/api/users/invite', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: inviteEmail,
          name: inviteName,
          role: inviteRole,
          organization_id: orgId
        })
      });
      
      const data = await res.json();
      
      if (data.success || data.url) {
        toast.success(data.url ? "Ecco il link di invito!" : "Utente creato!");
        if (data.url) {
          await navigator.clipboard.writeText(data.url);
          toast.success("Link copiato!");
        }
        fetchUsers();
        setShowInvite(false);
        setInviteEmail("");
        setInviteName("");
        setInviteRole("org_staff");
      } else {
        toast.error(data.error || "Errore");
      }
    } catch (err) {
      toast.error("Errore nell'invio");
    } finally {
      setInviteLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    if (userId === currentUserId) {
      toast.error("Non puoi eliminare il tuo account");
      return;
    }
    
    if (!confirm("Sei sicuro di voler eliminare questo utente?")) return;
    
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);
    
    if (!error) {
      toast.success("Utente eliminato");
      fetchUsers();
    } else {
      toast.error("Errore nell'eliminazione");
    }
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    
    if (!error) {
      toast.success("Email di reset inviata!");
    } else {
      toast.error("Errore nell'invio email");
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      super_admin: "Super Admin",
      org_admin: "Amministratore",
      org_staff: "Staff",
      guest: "Ospite"
    };
    return labels[role] || role;
  };

  const getRoleIcon = (role: string) => {
    if (role === 'super_admin' || role === 'org_admin') return Shield;
    return User;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-500" />
          <h2 className="font-bold text-lg text-gray-900">Utenti</h2>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium flex items-center gap-2 transition"
        >
          <UserPlus className="w-4 h-4" />
          Aggiungi Utente
        </button>
      </div>

      {loading ? (
        <div className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : users.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          Nessun utente trovato. Aggiungi il primo utente!
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {users.map(user => {
            const RoleIcon = getRoleIcon(user.role);
            return (
              <div key={user.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="font-bold text-gray-600">
                      {(user.full_name || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{user.full_name || "Senza nome"}</span>
                      {user.id === currentUserId && (
                        <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">Tu</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <RoleIcon className="w-3 h-3" />
                      {getRoleLabel(user.role)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => resetPassword(user.email || "")}
                    className="p-2 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Invia email reset password"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  {user.id !== currentUserId && (
                    <button
                      onClick={() => deleteUser(user.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Elimina utente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Invito */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-lg mb-4">Aggiungi Nuovo Utente</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Mario Rossi"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="mario@esempio.it"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ruolo</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="org_staff">Staff</option>
                  <option value="org_admin">Amministratore</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowInvite(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Annulla
              </button>
              <button
                onClick={sendInvite}
                disabled={!inviteEmail || !inviteName || inviteLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {inviteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {inviteLoading ? "Invio..." : "Invia Invito"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}