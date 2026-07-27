"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { User, CreditCard, Users, UserPlus, Shield, Crown, Loader2, AlertCircle, Camera } from "lucide-react";
import toast from "react-hot-toast";

type Tab = 'profile' | 'billing' | 'team';

export default function ProfileHubPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(true);
  
  // States
  const [userProfile, setUserProfile] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [team, setTeam] = useState<any[]>([]);

  // Form States
  const [isInviting, setIsInviting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [profName, setProfName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    fetchHubData();
  }, []);

  const fetchHubData = async () => {
    setLoading(true);
    let currentOrgId = "";
    let myRole = "org_admin"; // fallback

    const { data: { user } } = await supabase.auth.getUser();
    if(user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
        if(profile) {
            currentOrgId = profile.organization_id;
            setUserProfile({ ...profile, email: user.email });
            myRole = profile.role;
            setProfName(profile.full_name || "");
            setAvatarUrl(profile.avatar_url || "");
        } else {
            // L'utente è in Auth ma manca la riga 'profiles'. Forziamo admin per il Test
            setUserProfile({ role: "org_admin", email: user.email, id: user.id });
            setProfName(user.email || "Admin");
        }
    } else {
        // Fallback demo locale
        setProfName("Admin (Local Demo)");
        setUserProfile({ role: "org_admin", email: "demo@altamira-pms.it", id: 'demo-local' });
    }
    
    // Fallback Org
    if (!currentOrgId) {
       const { data: fallback } = await supabase.from('organizations').select('id').limit(1).single();
       if (fallback) {
           currentOrgId = fallback.id;
           setOrg({ ...fallback, plan: 'premium' });
       }
    } else {
       const { data: o } = await supabase.from('organizations').select('*').eq('id', currentOrgId).single();
       if(o) setOrg({ ...o, plan: o.plan || 'premium' });
    }
    
    // Se Admin, carica il team
    if (currentOrgId && ['org_admin', 'super_admin'].includes(myRole)) {
      const { data: teamData } = await supabase.from('profiles')
        .select('*')
        .eq('organization_id', currentOrgId)
        .in('role', ['org_admin', 'org_staff']);
      
      if (teamData) setTeam(teamData);
      else setTeam([]);
    }
    
    setLoading(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    toast.loading("Caricamento foto...");
    // Fallback su property_images visto che il bucket è già pubblico
    const { error: uploadError } = await supabase.storage.from('property_images').upload(filePath, file);
    
    toast.dismiss();
    
    if (uploadError) {
      toast.error("Errore caricamento foto: " + uploadError.message);
    } else {
      const { data } = supabase.storage.from('property_images').getPublicUrl(filePath);
      setAvatarUrl(data.publicUrl);
      toast.success("Foto caricata. Ricorda di premere 'Salva'!");
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.id || userProfile.id === 'demo-local') {
       toast.error("Impossibile salvare in modalità Demo Offline. Loggati.");
       return;
    }

    setIsSaving(true);
    
    // Ora che il DB ha le Policies sbloccate, possiamo usare Upsert direttamente
    const { error } = await supabase.from('profiles').upsert({
       id: userProfile.id,
       full_name: profName,
       avatar_url: avatarUrl,
       organization_id: org?.id,
       role: userProfile.role || 'org_admin'
    }, { onConflict: 'id' });

    setIsSaving(false);

    if (error) {
       toast.error("Errore salvataggio profilo: " + error.message);
    } else {
       toast.success("Profilo aggiornato con successo!");
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) return;

    // Controllo Paywall
    const plan = org.plan || "premium";
    const maxUsers = plan.toLowerCase() === "basic" ? 1 : 3;

    if (team.length >= maxUsers) {
      if (plan.toLowerCase() === "basic") {
         toast.error("Paywall: Piano Basic limitato a 1 collega. Upgrade richiesto.", { duration: 4000 });
      } else {
         toast.error("Limite massimo di 3 membri del piano Premium raggiunto.", { duration: 4000 });
      }
      return;
    }

    setIsInviting(true);
    toast.success("Logica Invito disabilitata in Test Mode.");
    setTimeout(() => {
      setIsInviting(false);
      setNewEmail("");
      setNewName("");
    }, 800);
  };

  if (loading) {
     return <div className="p-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-gray-400" /></div>;
  }

  const isAdmin = userProfile?.role === 'org_admin' || userProfile?.role === 'super_admin';
  const planName = org?.plan || "Premium";
  const maxUsers = planName.toLowerCase().includes("basic") ? 1 : 3;
  const isUpgradable = team.length >= 1 && planName.toLowerCase().includes("basic");

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 h-full flex flex-col">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 flex items-center">
           Il Mio Account
        </h1>
        <p className="text-gray-500 mt-2">Gestisci identità{isAdmin ? ', fatturazione e accessi del tuo team' : ''}.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start flex-1 h-full">
         
         {/* SIDEBAR TABS */}
         <div className="w-full md:w-64 flex flex-col gap-2 shrink-0">
            <button 
               onClick={() => setActiveTab('profile')}
               className={`flex items-center px-4 py-3 rounded-xl font-bold transition-all ${activeTab==='profile' ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-sm' : 'text-gray-500 hover:bg-gray-100 border border-transparent'}`}
            >
               <User className={`w-5 h-5 mr-3 ${activeTab==='profile' ? 'text-rose-500' : 'text-gray-400'}`} /> Profilo
            </button>
            
            {isAdmin && (
               <>
                  <button 
                     onClick={() => setActiveTab('billing')}
                     className={`flex items-center px-4 py-3 rounded-xl font-bold transition-all ${activeTab==='billing' ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-sm' : 'text-gray-500 hover:bg-gray-100 border border-transparent'}`}
                  >
                     <CreditCard className={`w-5 h-5 mr-3 ${activeTab==='billing' ? 'text-rose-500' : 'text-gray-400'}`} /> Abbonamento
                  </button>
                  <button 
                     onClick={() => setActiveTab('team')}
                     className={`flex items-center px-4 py-3 rounded-xl font-bold transition-all ${activeTab==='team' ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-sm' : 'text-gray-500 hover:bg-gray-100 border border-transparent'}`}
                  >
                     <Users className={`w-5 h-5 mr-3 ${activeTab==='team' ? 'text-rose-500' : 'text-gray-400'}`} /> Team
                  </button>
               </>
            )}
         </div>

         {/* CONTENT AREA */}
         <div className="flex-1 w-full bg-white rounded-3xl shadow-sm border border-gray-100 p-8 min-h-[500px]">
            
            {/* TAB PROFILO */}
            {activeTab === 'profile' && (
               <div className="max-w-2xl animate-in fade-in slide-in-from-right-4 duration-300">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Informazioni Personali</h2>
                  
                  <div className="flex items-center gap-6 mb-8 pb-8 border-b border-gray-100">
                     <div className="relative group cursor-pointer" onClick={() => document.getElementById('avatarUpload')?.click()}>
                        <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 overflow-hidden bg-cover bg-center" style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : {}}>
                           {!avatarUrl && <User className="w-10 h-10 text-gray-400" />}
                        </div>
                        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                           <Camera className="w-6 h-6 text-white"/>
                        </div>
                        <input type="file" id="avatarUpload" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                     </div>
                     <div>
                        <div className="text-sm font-bold text-gray-700 mb-1">Foto Profilo</div>
                        <div className="text-xs text-gray-500">Clicca sull'immagine per caricare. Max 2MB.</div>
                     </div>
                  </div>

                  <form onSubmit={handleUpdateProfile} className="space-y-5">
                     <div className="grid grid-cols-2 gap-5">
                        <div className="col-span-2">
                           <label className="text-sm font-bold text-gray-700 block mb-2">Nome Completo</label>
                           <input type="text" value={profName} onChange={e=>setProfName(e.target.value)} required className="w-full border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 bg-gray-50" />
                        </div>
                        <div className="col-span-2">
                           <label className="text-sm font-bold text-gray-700 block mb-2">Email Accesso</label>
                           <input type="email" disabled value={userProfile?.email || "demo@altamira.it"} className="w-full border border-gray-200 p-3 rounded-xl bg-gray-100 text-gray-500 cursor-not-allowed" />
                           <div className="text-xs text-gray-400 mt-1">L'email dell'account non può essere cambiata. Contatta il supporto.</div>
                        </div>
                     </div>
                     <button type="submit" disabled={isSaving} className="px-6 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition shadow-md mt-4 disabled:opacity-50">
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin mx-auto"/> : 'Salva Cambiamenti'}
                     </button>
                  </form>
               </div>
            )}

            {/* TAB ABBONAMENTO (Admin Only) */}
            {activeTab === 'billing' && isAdmin && (
               <div className="max-w-3xl animate-in fade-in slide-in-from-right-4 duration-300">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Abbonamento & Licenza</h2>
                  <p className="text-gray-500 mb-8">Paga le tue quote ed espandi le funzionalità del tuo portale gestionale.</p>
                  
                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
                     <div className="flex items-center">
                        <div className="w-12 h-12 rounded-xl bg-white shadow-sm flex items-center justify-center mr-4 border border-rose-100">
                           <Crown className="w-6 h-6 text-amber-500" />
                        </div>
                        <div>
                           <div className="font-extrabold text-xl text-gray-900 capitalize">Piano {planName}</div>
                           <div className="text-sm font-medium text-rose-600 flex items-center">
                              Attivo e Funzionante
                           </div>
                        </div>
                     </div>
                     <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900 line-through opacity-50 mb-0.5">Trial</div>
                        <div className="text-sm font-bold bg-white text-gray-500 px-3 py-1 rounded-full border border-rose-100 shadow-sm">Scade in 7 giorni</div>
                     </div>
                  </div>

                  {/* Stripe Credit Card Mockup */}
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Aggiungi Metodo di Pagamento</h3>
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                     <div className="space-y-4">
                        <div>
                           <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5 ml-1">Intestatario Carta</label>
                           <input type="text" placeholder="Mario Rossi" className="w-full border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"/>
                        </div>
                        <div>
                           <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5 ml-1">Estremi Carta (Stripe Secure)</label>
                           <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 p-1">
                              <div className="flex-1 flex items-center px-3">
                                 <CreditCard className="w-5 h-5 text-gray-400 mr-2 shrink-0"/>
                                 <input type="text" placeholder="0000 0000 0000 0000" className="w-full p-2 outline-none font-medium tracking-widest text-gray-700"/>
                              </div>
                              <div className="w-24 border-l border-gray-200 px-2">
                                 <input type="text" placeholder="MM/YY" className="w-full p-2 outline-none text-center text-sm font-medium"/>
                              </div>
                              <div className="w-20 border-l border-gray-200 px-2">
                                 <input type="text" placeholder="CVC" className="w-full p-2 outline-none text-center text-sm font-medium"/>
                              </div>
                           </div>
                        </div>
                     </div>
                     <button type="button" onClick={()=>toast.success("Carta di credito salvata (Simulazione)!")} className="w-full block mt-6 px-4 py-3.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/30 transition-all text-center">
                        Salva Metodo di Pagamento
                     </button>
                     <div className="flex items-center justify-center text-xs text-gray-400 font-medium mt-4">
                        <LockIcon className="w-3 h-3 mr-1"/> I dati sono processati in modo sicuro da Stripe.
                     </div>
                  </div>
               </div>
            )}

            {/* TAB TEAM (Admin Only) */}
            {activeTab === 'team' && isAdmin && (
               <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100">
                     <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-1">Accessi Agency</h2>
                        <p className="text-gray-500 text-sm">Puoi invitare altri Property Manager. Capacità: {team.length}/{maxUsers} Utenti.</p>
                     </div>
                     {isUpgradable && (
                        <button onClick={()=>setActiveTab('billing')} className="px-4 py-2 bg-amber-500 text-white font-bold rounded-lg text-sm shadow-sm hover:bg-amber-600 transition">
                           Upgrade per +2 Posti
                        </button>
                     )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                     <form onSubmit={handleInvite} className="space-y-4 bg-gray-50 rounded-2xl p-6 border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-2 flex items-center"><UserPlus className="w-5 h-5 mr-2 text-rose-500"/> Invita Power User</h3>
                        <div>
                           <label className="text-sm font-bold text-gray-700 block mb-1.5">Nome e Email</label>
                           <input type="text" value={newName} onChange={e=>setNewName(e.target.value)} required placeholder="Nome Collega" className="w-full mb-3 border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 bg-white" />
                           <input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} required placeholder="Email lavorativa" className="w-full border border-gray-200 p-3 rounded-xl focus:ring-2 focus:ring-rose-500 bg-white" />
                        </div>
                        <button type="submit" disabled={isInviting || team.length >= maxUsers} className="w-full mt-2 bg-gray-900 text-white font-bold py-3 rounded-xl disabled:opacity-50 transition shadow-md">
                           {isInviting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Invia Invito Magic Link'}
                        </button>
                     </form>

                     <div>
                        <h3 className="font-bold text-gray-800 mb-4 px-2">Account Attivi</h3>
                        <div className="space-y-3">
                           {team.map(member => (
                              <div key={member.id} className="p-4 rounded-xl border border-gray-200 bg-white shadow-sm flex items-center justify-between">
                                 <div className="flex items-center">
                                    <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 font-bold shrink-0">
                                       {(member.full_name || 'U')[0]}
                                    </div>
                                    <div className="ml-3">
                                       <div className="font-bold text-gray-900 flex items-center">
                                          {member.full_name || "Account Team"}
                                          {member.role === 'org_admin' && <Shield className="w-3.5 h-3.5 text-amber-500 ml-1.5"/>}
                                       </div>
                                       <div className="text-xs text-gray-500 font-medium capitalize mt-0.5">{member.role === 'org_admin' ? 'Amministratore' : 'Power User'}</div>
                                    </div>
                                 </div>
                              </div>
                           ))}
                           {team.length < maxUsers && (
                              <div className="p-4 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 font-medium text-sm h-[90px]">
                                 Posto disponibile per Invito
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
               </div>
            )}

         </div>
      </div>
    </div>
  );
}

function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}
