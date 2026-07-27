"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { Loader2, Mail, Lock, User } from "lucide-react";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [inviteData, setInviteData] = useState<any>(null);
  const [orgName, setOrgName] = useState("");
  
  const [password, setPassword] = useState("");
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (token) validateInvite();
  }, [token]);

  const validateInvite = async () => {
    setLoading(true);
    
    const { data: invite, error } = await supabase
      .from('invitations')
      .select('*, organizations(name)')
      .eq('token', token)
      .single();

    if (error || !invite) {
      toast.error("Link di invito non valido o scaduto");
      setLoading(false);
      return;
    }

    if (new Date(invite.expires_at) < new Date()) {
      toast.error("Link di invito scaduto");
      setLoading(false);
      return;
    }

    if (invite.status === 'used') {
      toast.error("Questo invito è già stato utilizzato");
      setLoading(false);
      return;
    }

    setInviteData(invite);
    setOrgName(invite.organizations?.name || "l'organizzazione");
    setValid(true);
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast.error("La password deve essere di almeno 6 caratteri");
      return;
    }

    setRegistering(true);
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: inviteData.email,
        password,
        options: {
          data: {
            full_name: inviteData.name
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        await supabase.from('profiles').insert({
          id: authData.user.id,
          organization_id: inviteData.organization_id,
          full_name: inviteData.name,
          role: inviteData.role
        });

        await supabase
          .from('invitations')
          .update({ status: 'used' })
          .eq('id', inviteData.id);

        toast.success("Account creato! Ora puoi accedere.");
        router.push("/login");
      }
    } catch (err: any) {
      toast.error(err.message || "Errore nella registrazione");
    } finally {
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link non valido</h1>
          <p className="text-gray-500">Questo link di invito non è valido o è scaduto.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-rose-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Ciao {inviteData?.name}!</h1>
          <p className="text-gray-500 mt-2">
            Sei stato invitato a unirti a <strong>{orgName}</strong>
          </p>
          <p className="text-gray-400 text-sm mt-1">Crea il tuo account per accedere all'app</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              disabled
              className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500"
              value={inviteData?.email}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              minLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimo 6 caratteri"
            />
          </div>

          <button
            type="submit"
            disabled={registering || password.length < 6}
            className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {registering ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Lock className="w-5 h-5" />
                Crea Account
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}