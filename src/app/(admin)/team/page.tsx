"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Users, UserPlus, Shield, Crown, Loader2, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function TeamManagementPage() {
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<any>(null);
  
  const [isInviting, setIsInviting] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    setLoading(true);
    let currentOrgId = "";
    
    // Get organization
    const { data: { user } } = await supabase.auth.getUser();
    if(user) {
        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
        if(profile) currentOrgId = profile.organization_id;
    }
    
    // Fallback locale / demo
    if (!currentOrgId) {
       const { data: fallback } = await supabase.from('organizations').select('id, plan').limit(1).single();
       if (fallback) {
           currentOrgId = fallback.id;
           setOrg(fallback);
       }
    } else {
       const { data: o } = await supabase.from('organizations').select('*').eq('id', currentOrgId).single();
       if(o) setOrg(o);
    }
    
    if (currentOrgId) {
      const { data: teamData } = await supabase.from('profiles')
        .select('*')
        .eq('organization_id', currentOrgId)
        .in('role', ['org_admin', 'org_staff']);
      
      if (teamData) setTeam(teamData);
      else setTeam([]);
    }
    
    setLoading(false);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) return;

    // Controllo Paywall
    const plan = org.plan || "premium";
    const maxUsers = plan.toLowerCase() === "basic" ? 1 : 3;

    if (team.length >= maxUsers) {
      if (plan.toLowerCase() === "basic") {
         toast.error("Paywall: Il Piano Basic include solo 1 Admin. Passa a Premium per invitare 2 colleghi (Power User).", { duration: 5000 });
      } else {
         toast.error("Hai raggiunto il limite di 3 membri del piano Premium. Contatta l'Enterprise per espandere.", { duration: 5000 });
      }
      return;
    }

    setIsInviting(true);
    // Simula invio email invito (In produzione richiederebbe un edge function con ServiceRole per supabase.auth.admin.inviteUserByEmail)
    toast.success("Logica di Invito disabilitata in Demo Mode locale. RLS Auth Limit.");
    setTimeout(() => {
      setIsInviting(false);
      setNewEmail("");
      setNewName("");
    }, 1000);
  };

  const planName = org?.plan || "Premium (Trial)";
  const maxUsers = planName.toLowerCase().includes("basic") ? 1 : 3;
  const isUpgradable = team.length >= 1 && planName.toLowerCase().includes("basic");

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 flex items-center">
            <Users className="w-8 h-8 text-rose-600 mr-3" />
            Team e Accessi
          </h1>
          <p className="text-gray-500 mt-2">Invita colleghi e co-host a gestire l'azienda con te.</p>
        </div>
        <div className="bg-white px-4 py-3 rounded-xl border border-gray-200 flex items-center shadow-sm">
           <Crown className={`w-5 h-5 mr-3 ${planName.toLowerCase().includes("basic") ? "text-gray-400" : "text-amber-500"}`} />
           <div>
             <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">Piano Attuale</div>
             <div className="font-bold text-gray-900 capitalize">{planName} <span className="text-gray-400 font-normal">({team.length}/{maxUsers} Utenti)</span></div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Modulo Aggiunta */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 lg:col-span-1 h-fit">
          <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center">
            <UserPlus className="w-5 h-5 mr-2 text-rose-500" /> Invita un Collega
          </h2>
          
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1">Nome Collega</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} required className="w-full border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-gray-50" placeholder="Mario Bianchi" />
            </div>
            <div>
              <label className="text-sm font-bold text-gray-700 block mb-1">Indirizzo Email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required className="w-full border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-gray-50" placeholder="collega@agenzia.it" />
            </div>
            
            {isUpgradable ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-6">
                    <p className="text-sm text-amber-800 font-medium mb-3">
                        <AlertCircle className="w-4 h-4 inline mr-1 mb-0.5" />
                        Il piano Basic consente 1 solo accesso.
                    </p>
                    <button type="button" onClick={() => toast("Redirect a Stripe in prod!")} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-lg transition text-sm shadow-md">
                        Esegui Upgrade (49€/m)
                    </button>
                </div>
            ) : (
                <button type="submit" disabled={isInviting || !newEmail || team.length >= maxUsers} className="w-full mt-6 bg-gray-900 hover:bg-gray-800 text-white font-bold py-3.5 rounded-xl flex justify-center transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                  {isInviting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Invia Invito Magic Link'}
                </button>
            )}
          </form>
        </div>

        {/* Lista Team */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 lg:col-span-2 overflow-hidden">
          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
          ) : team.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
               Nessun utente trovato. Aggiungine uno tramite il form a lato.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
                {team.map(member => (
                   <div key={member.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition">
                      <div className="flex items-center">
                         <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex flex-col items-center justify-center text-gray-400">
                             <Users className="w-5 h-5"/>
                         </div>
                         <div className="ml-4">
                            <div className="font-bold text-gray-900 text-lg flex items-center">
                               {member.full_name || member.id.split('-')[0]} 
                               {member.role === 'org_admin' && <span className="ml-2 bg-rose-100 text-rose-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center px-2 py-1"><Shield className="w-3 h-3 mr-1"/> Admin</span>}
                            </div>
                            <div className="text-gray-500 text-sm font-medium">{member.role === 'org_staff' ? 'Power User (Accesso Team)' : 'Amministratore Totale'}</div>
                         </div>
                      </div>
                      <div className="flex flex-col items-end">
                         
                      </div>
                   </div>
                ))}
                
                {team.length < maxUsers && (
                   <div className="p-6 bg-gray-50 border-t border-gray-100 border-dashed flex justify-center text-gray-400 text-sm font-medium italic">
                      Puoi invitare altri {maxUsers - team.length} Power User...
                   </div>
                )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
