"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { Loader2, Mail, Lock } from "lucide-react";
import toast from "react-hot-toast";

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [orgName, setOrgName] = useState("");
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (token) validateInvite();
  }, [token]);

  const validateInvite = async () => {
    setLoading(true);
    
    const { data: staff, error } = await supabase
      .from('staff_members')
      .select('*, organizations(name)')
      .eq('magic_token', token)
      .single();

    if (error || !staff) {
      toast.error("Link di invito non valido o scaduto");
      setLoading(false);
      return;
    }

    setStaffName(staff.name);
    setOrgName(staff.organizations?.name || "l'organizzazione");
    setFullName(staff.name);
    setValid(true);
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName) return;

    setRegistering(true);
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        await supabase.from('profiles').insert({
          id: authData.user.id,
          organization_id: (await supabase.from('staff_members').select('organization_id').eq('magic_token', token).single()).data?.organization_id,
          full_name: fullName,
          role: 'org_staff'
        });

        await supabase
          .from('staff_members')
          .update({ magic_token: null, user_id: authData.user.id })
          .eq('magic_token', token);

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
            <Mail className="w-8 h-8 text-rose-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Ciao {staffName}!</h1>
          <p className="text-gray-500 mt-2">
            Sei stato invitato a unirti a <strong>{orgName}</strong>
          </p>
          <p className="text-gray-400 text-sm mt-1">Crea il tuo account per accedere all'app</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            disabled={registering}
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