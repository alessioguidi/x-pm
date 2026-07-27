"use client";

import { useEffect, useState, use } from "react";
import { createClient } from "@supabase/supabase-js";
import { Loader2, Wallet, Plus, CheckCircle2, FileText, AlertTriangle, Receipt } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency } from "@/lib/format";

// Initialize a custom Supabase client for this token
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export default function StaffTokenApp({ params }: { params: Promise<{ magic_token: string }> }) {
  const { magic_token } = use(params);
  const [supabase, setSupabase] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'turni' | 'spese'>('turni');

  // New Expense State
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expAmount, setExpAmount] = useState("");
  const [expNote, setExpNote] = useState("");

  useEffect(() => {
    const token = magic_token;
    if(!token) return;

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { 'x-magic-token': token } }
    });
    setSupabase(client);
    
    // Fetch profile mapping to token
    const loadProfileAndLedger = async () => {
      // Dobbiamo estrarre prima il profilo per prendere l'ID e Organization_ID
      const { data: prof, error: pErr } = await client.from("staff_members").select("*").single();
      if(pErr || !prof) {
        setLoading(false);
        return;
      }
      setProfile(prof);

      // Fetch personal transactions
      const { data: txs } = await client.from("cash_transactions").select("*").order('created_at', { ascending: false });
      if(txs) setTransactions(txs);

      // Fetch pending payments assigned to this staff member
      const { data: pp } = await client
         .from("booking_payments")
         .select("*")
         .eq("staff_member_id", prof.id)
         .eq("status", "scheduled")
         .order('date', { ascending: true });
      if (pp) setPendingPayments(pp);

      // Fetch Bookings for Tasks
      const { data: bks } = await client
        .from('bookings')
        .select('*, properties(*)')
        .eq('organization_id', prof.organization_id)
        .in('status', ['pending', 'confirmed'])
        .gte('check_in_date', new Date().toISOString().split('T')[0]);

      if (bks) {
        const userTasks: any[] = [];
        bks.forEach(b => {
          const p = b.properties;
          if (!p) return;
          const c_in = b.checkin_staff_id || p.default_checkin_staff_id;
          const c_out = b.checkout_staff_id || p.default_checkout_staff_id;
          const c_clean = b.cleaning_staff_id || p.default_cleaning_staff_id;

          if (c_in === prof.id) {
             userTasks.push({ id: b.id+'-in', type: 'Check-in', date: b.check_in_date, b, p });
          }
          if (c_out === prof.id) {
             userTasks.push({ id: b.id+'-out', type: 'Check-out', date: b.check_out_date, b, p });
          }
          if (c_clean === prof.id) {
             userTasks.push({ id: b.id+'-clean', type: 'Pulizie', date: b.check_out_date, b, p });
          }
        });
        userTasks.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setTasks(userTasks);
      }
      
      setLoading(false);
    };

    loadProfileAndLedger();
  }, [magic_token]);

  const confirmPendingTx = async (txId: string) => {
    toast.loading("Conferma in corso...", { id: 'confP' });
    const res = await fetch(`/api/payments/${txId}/confirm`, {
       method: 'POST',
       headers: { 'Authorization': `Bearer ${magic_token}` }
    });
    if(!res.ok) toast.error("Errore di conferma", { id: 'confP' });
    else {
      toast.success("Incasso confermato!", { id: 'confP' });
      // Remove from pending
      setPendingPayments(prev => prev.filter(p => p.id !== txId));
      // Reload profile/ledger to get the new wallet tx
      const { data: newTxs } = await supabase.from("cash_transactions").select("*").order('created_at', { ascending: false });
      if (newTxs) setTransactions(newTxs);
    }
  }

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!expAmount || !profile) return;

    const { data: tx, error } = await supabase.from('cash_transactions').insert([{
      organization_id: profile.organization_id,
      staff_member_id: profile.id,
      amount: -Math.abs(Number(expAmount)), // always negative for expense
      transaction_type: 'expense',
      status: 'confirmed',
      notes: expNote
    }]).select().single();

    if(error){
      toast.error("Errore salvataggio!");
    } else {
      toast.success("Spesa registrata");
      setTransactions(prev => [tx, ...prev]);
      setShowExpenseForm(false);
      setExpAmount("");
      setExpNote("");
    }
  }

  if (loading) return <div className="h-screen w-full flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

  if (!profile) return (
    <div className="h-screen w-full flex flex-col items-center justify-center p-6 bg-gray-50 text-center">
      <AlertTriangle className="w-16 h-16 text-yellow-500 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Negato</h1>
      <p className="text-gray-500">Il Link che stai usando non è valido o è stato revocato dal Manager.</p>
    </div>
  );

  const pendingTxs = pendingPayments;
  const pastTxs = transactions;

  // calcola saldo attuale
  const walletBalance = pastTxs.filter(tx => tx.status === 'confirmed').reduce((sum, tx) => sum + Number(tx.amount), 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* HEADER SUPERIORE */}
      <div className="bg-blue-600 px-6 pt-10 pb-8 rounded-b-[2rem] shadow-md text-white">
        <h1 className="text-xl font-medium text-blue-100 mb-1">Ciao, {profile.name} 👋</h1>
        <p className="text-sm text-blue-200 capitalize">Reparto: {profile.role}</p>

        <div className="mt-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <span className="block text-xs font-bold uppercase tracking-widest text-blue-100 mb-1">Nel Tuo Portafogli</span>
            <div className="text-4xl font-extrabold tracking-tight">{formatCurrency(walletBalance)}</div>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <Wallet className="w-6 h-6 text-white" />
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div className="flex bg-blue-700/50 p-1 rounded-xl mt-6">
           <button 
             onClick={() => setActiveTab('turni')}
             className={`flex-1 py-2 font-bold text-sm rounded-lg transition-colors ${activeTab === 'turni' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-100 hover:text-white'}`}
           >
             I Miei Turni
           </button>
           <button 
             onClick={() => setActiveTab('spese')}
             className={`flex-1 py-2 font-bold text-sm rounded-lg transition-colors ${activeTab === 'spese' ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-100 hover:text-white'}`}
           >
             Cassa & Spese
           </button>
        </div>
      </div>

      <div className="px-5 mt-6 space-y-6">

        {activeTab === 'turni' && (
          <div className="space-y-4 animate-in slide-in-from-left duration-300">
             <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Impegni in Arrivo</h2>
             {tasks.length === 0 ? (
               <div className="text-center text-sm text-gray-500 py-10 bg-white border border-gray-100 rounded-xl">Non ci sono turni assegnati a te nei prossimi giorni.</div>
             ) : (
               tasks.map(task => (
                 <div key={task.id} className="bg-white border text-sm border-gray-100 rounded-xl p-4 shadow-sm flex flex-col gap-2 relative overflow-hidden">
                    <div className={`absolute left-0 top-0 w-1 h-full ${task.type === 'Check-in' ? 'bg-emerald-500' : task.type === 'Pulizie' ? 'bg-cyan-500' : 'bg-rose-500'}`} />
                    <div className="flex justify-between items-center pl-2">
                       <span className="font-bold text-gray-900 border-b border-gray-100 pb-1">{task.type}</span>
                       <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg text-xs">{task.date}</span>
                    </div>
                    <div className="pl-2 pt-1">
                       <p className="font-bold text-gray-800">{task.p.name}</p>
                       <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><AlertTriangle className="w-3.5 h-3.5"/> Ospite: {task.b.guest_name}</p>
                    </div>
                 </div>
               ))
             )}
          </div>
        )}
        
        {activeTab === 'spese' && (
           <div className="space-y-6 animate-in slide-in-from-right duration-300">
             {/* PENDENZE MANAGER */}
        {pendingTxs.length > 0 && (
          <div className="animate-in slide-in-from-bottom flex flex-col gap-3">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center">
              Da Incassare (Richiesti dal Manager) <span className="bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center ml-2 text-xs">{pendingTxs.length}</span>
            </h2>
            {pendingTxs.map(tx => (
              <div key={tx.id} className="bg-white border-2 border-red-100 rounded-xl p-4 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-400" />
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">Incasso Ospite</h3>
                    <p className="text-sm text-gray-500">{tx.notes || 'Nessuna nota dal manager'}</p>
                  </div>
                  <div className="text-xl font-bold text-emerald-600">+ {formatCurrency(tx.amount)}</div>
                </div>
                <button onClick={() => confirmPendingTx(tx.id)} className="w-full bg-red-50 hover:bg-red-100 text-red-700 font-bold py-3 rounded-lg flex items-center justify-center transition">
                  <span className="mr-2">Confermo l'Incasso</span> <CheckCircle2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* LOGICA NUOVA SPESA */}
        {showExpenseForm ? (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm animate-in zoom-in duration-200">
            <h2 className="font-bold text-gray-900 mb-4 flex items-center">
              <Receipt className="w-5 h-5 mr-2 text-blue-600" /> Segnala una Spesa
            </h2>
            <form onSubmit={addExpense} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">IMPORTO PAGATO (€)</label>
                <input type="number" step="0.01" value={expAmount} onChange={e => setExpAmount(e.target.value)} required className="w-full border-b-2 border-gray-200 p-2 text-xl font-bold rounded-t-lg bg-gray-50 focus:border-blue-600 outline-none transition-colors" placeholder="Es. 15.50" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 block mb-1">COSA HAI COMPRATO? (SCONTRINO)</label>
                <textarea value={expNote} onChange={e => setExpNote(e.target.value)} required className="w-full border-2 border-gray-100 p-3 text-sm font-medium rounded-lg bg-white outline-none focus:border-blue-600 transition-colors" rows={2} placeholder="Es. Tovaglioli, sapone, detersivo pavimenti..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowExpenseForm(false)} className="px-4 py-3 bg-gray-100 font-bold text-gray-600 rounded-lg w-1/3 text-center">Annulla</button>
                <button type="submit" className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 font-bold text-white rounded-lg text-center transition shadow-md shadow-blue-200">Salva Spesa</button>
              </div>
            </form>
          </div>
        ) : (
          <button onClick={() => setShowExpenseForm(true)} className="w-full bg-white border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-blue-600 font-bold py-4 rounded-xl flex items-center justify-center transition">
            <Plus className="w-5 h-5 mr-2" /> Segnala Spesa / Reso
          </button>
        )}

        {/* STORICO */}
        <div>
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Ultimi Movimenti</h2>
          {pastTxs.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-6 border border-gray-100 rounded-xl bg-white">Nessun movimento recente.</div>
          ) : (
            <div className="space-y-3">
              {pastTxs.map(tx => (
                <div key={tx.id} className="bg-white border text-sm border-gray-100 rounded-xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${Number(tx.amount) > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                      {Number(tx.amount) > 0 ? <Plus className="w-5 h-5" /> : <FileText className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{tx.transaction_type === 'expense' ? 'Spesa Scontrino' : tx.transaction_type === 'manager_handover' ? 'Consegnati al Manager' : 'Incasso da Ospiti'}</p>
                      <p className="text-xs text-gray-500">{tx.notes || 'Nessuna nota'}</p>
                    </div>
                  </div>
                  <div className={`font-bold ${Number(tx.amount) > 0 ? 'text-emerald-600' : 'text-gray-900'}`}>
                    {Number(tx.amount) > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
        )}
      </div>
    </div>
  );
}
