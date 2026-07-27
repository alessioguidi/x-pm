"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/utils/supabase/client";
import { Loader2, Plus, ArrowLeftRight, Edit3, Trash2, Search, Filter, History, X } from "lucide-react";
import { formatCurrency, formatDateStr, formatDateTime } from "@/lib/format";
import toast from "react-hot-toast";
import { useSearchParams } from "next/navigation";

const extractMethod = (note: string) => {
   const match = (note || '').match(/^\[(.*?)\]\s*(.*)$/);
   if (match) return { method: match[1], text: match[2] };
   return { method: 'Contante', text: note || '' };
};

function CassaInner() {
  const searchParams = useSearchParams();
  const initialStaffId = searchParams.get('staff_id') || 'all';

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string>("");
  
  // Base Data for dropdowns
  const [staffList, setStaffList] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);

  // Filters
  const [filterStaff, setFilterStaff] = useState<string>(initialStaffId);
  const [filterProperty, setFilterProperty] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState("");

  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [txDate, setTxDate] = useState('');
  const [txPropertyId, setTxPropertyId] = useState('');
  const [txStaffId, setTxStaffId] = useState('');
  const [txMethod, setTxMethod] = useState('Contante');
  const [txNotes, setTxNotes] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txStatus, setTxStatus] = useState('confirmed');

  useEffect(() => {
    fetchBaseData();
  }, []);

  useEffect(() => {
     if (orgId) fetchTransactions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, filterStaff, filterProperty]);

  const fetchBaseData = async () => {
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
      
    const [propsRes, staffRes] = await Promise.all([
       supabase.from('properties').select('id, name').eq('organization_id', currentOrgId).eq('is_active', true),
       supabase.from('staff_members').select('id, name').eq('organization_id', currentOrgId)
    ]);
    
    if(propsRes.data) setProperties(propsRes.data);
    if(staffRes.data) setStaffList(staffRes.data);
  };

  const fetchTransactions = async () => {
    setLoading(true);
    let query = supabase.from('cash_transactions')
        .select(`
            *,
            bookings (
                guest_name,
                check_in_date,
                check_out_date,
                properties (name)
            )
        `)
        .order('created_at', { ascending: false }).limit(200);
    
    if (filterStaff !== 'all') {
        query = query.eq('staff_member_id', filterStaff);
    }
    if (filterProperty !== 'all') {
        query = query.eq('property_id', filterProperty);
    }
    
    // We fetch global transactions across the org by getting those assigned to any staff OR property in the org OR no staff/property.
    // Instead of complex OR, we just fetch a subset and filter locally for simplicity, or we depend on RLS.
    // Ideally, RLS is active so we just fetch them.
    const { data } = await query;
    let finalData = data || [];

    setTransactions(finalData);
    setLoading(false);
  };

  const handleSave = async () => {
    const parsedAmount = parseFloat(txAmount.replace(',', '.'));
    if (isNaN(parsedAmount) || parsedAmount === 0 || !txNotes.trim()) {
       toast.error("Inserisci causale e importo valido");
       return;
    }

    const finalDate = txDate || new Date().toISOString();
    
    const payload = {
        organization_id: orgId,
        amount: parsedAmount,
        notes: txNotes,
        reason: txNotes,
        payment_method: txMethod,
        status: txStatus,
        created_at: finalDate, // Date logic handles custom retro-dates
        property_id: txPropertyId || null,
        staff_member_id: txStaffId || null,
        transaction_type: parsedAmount < 0 ? 'expense' : 'manual' // Just explicit tag
    };

    if (editingRowId) {
        const { error } = await supabase.from('cash_transactions').update(payload).eq('id', editingRowId);
        if (error) { toast.error("Modifica fallita"); return; }
        toast.success("Movimento modificato");
    } else {
        const { error } = await supabase.from('cash_transactions').insert(payload);
        if (error) { toast.error("Inserimento fallito"); return; }
        toast.success("Nuovo movimento registrato");
    }

    resetForm();
    fetchTransactions();
  };

  const handleStartEdit = (item: any) => {
     setEditingRowId(item.id);
     setTxAmount(item.amount.toString());
     const parsedNote = extractMethod(item.notes);
     setTxNotes(item.transaction_type === 'scheduled' || item.transaction_type === 'manager_handover' ? item.notes : parsedNote.text);
     setTxMethod(item.transaction_type !== 'scheduled' && item.transaction_type !== 'manager_handover' ? parsedNote.method : 'Contante');
     setTxDate(item.created_at ? item.created_at.slice(0, 10) : '');
     setTxPropertyId(item.property_id || '');
     setTxStaffId(item.staff_member_id || '');
     setTxStatus(item.status || 'confirmed');
     setShowModal(true);
  };

  const deleteTransaction = async (id: string, notes: string) => {
    if (!confirm("Sei sicuro di voler eliminare permanentemente questo movimento dalla cassa?")) return;
    
    const { error } = await supabase.from('cash_transactions').delete().eq('id', id);
    if(error) {
        toast.error("Errore cancellazione");
    } else {
        fetchTransactions();
    }
  };

  const handleOpenNew = () => {
      resetForm();
      setShowModal(true);
  };

  const resetForm = () => {
      setEditingRowId(null);
      setShowModal(false);
      setTxAmount('');
      setTxNotes('');
      setTxDate('');
      setTxMethod('Contante');
      setTxPropertyId('');
      setTxStaffId(filterStaff !== 'all' ? filterStaff : ''); // Auto-fill if filtered
      setTxStatus('confirmed');
  };

  const searchLower = searchQuery.toLowerCase();
  const filteredTransactions = transactions.filter(t => 
      t.notes?.toLowerCase().includes(searchLower) || 
      t.amount.toString().includes(searchQuery) ||
      t.bookings?.guest_name?.toLowerCase().includes(searchLower) ||
      t.bookings?.properties?.name?.toLowerCase().includes(searchLower)
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
           <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
             <ArrowLeftRight className="w-8 h-8 text-blue-600" />
             Cassa Globale
           </h1>
           <p className="text-gray-500 mt-1">Registro completo delle entrate e delle uscite contabili.</p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-xl border border-gray-100 flex flex-wrap gap-4 items-center shadow-sm">
         <div className="flex items-center gap-2 text-sm font-bold text-gray-700 bg-gray-50 px-3 py-2 rounded-lg"><Filter className="w-4 h-4"/> Filtri:</div>
         
         <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} className="text-sm p-2 bg-gray-50 border border-gray-200 rounded-lg">
             <option value="all">Tutto lo Staff</option>
             {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
         </select>
         
         <select value={filterProperty} onChange={e => setFilterProperty(e.target.value)} className="text-sm p-2 bg-gray-50 border border-gray-200 rounded-lg">
             <option value="all">Tutte le Strutture</option>
             {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
         </select>

         <div className="ml-auto w-full md:w-auto relative">
             <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
             <input type="text" placeholder="Cerca nota o cifra..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full md:w-64 pl-9 pr-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500" />
         </div>
      </div>

      {/* Pulsante Nuovo Movimento */}
      <div className="flex justify-end">
        <button onClick={handleOpenNew} className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-sm hover:bg-blue-700 transition">
          <Plus className="w-5 h-5" /> Nuovo Movimento
        </button>
      </div>

      {/* MODALE INSERIMENTO / MODIFICA */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                {editingRowId ? <Edit3 className="w-5 h-5 text-blue-600" /> : <Plus className="w-5 h-5 text-emerald-600" />}
                {editingRowId ? "Modifica Movimento" : "Nuovo Movimento"}
              </h3>
              <button onClick={resetForm} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Data</label>
                  <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Stato</label>
                  <select value={txStatus} onChange={e => setTxStatus(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="confirmed">Confermato</option>
                    <option value="scheduled">Programmato</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Metodo</label>
                  <select value={txMethod} onChange={e => setTxMethod(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="Contante">Contante</option>
                    <option value="Bonifico">Bonifico</option>
                    <option value="Bonifico Immediato">Bonifico I.</option>
                    <option value="Stripe">Stripe</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Causale *</label>
                <input type="text" value={txNotes} onChange={e => setTxNotes(e.target.value)} placeholder="Es. Manutenzione caldaia, Acconto caparra..." className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Importo (€) *</label>
                  <input type="number" step="0.01" value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="Usa - per uscite" className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-700" />
                  <p className="text-[11px] text-gray-400 mt-1">Valore negativo (es. -50) per le uscite</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Struttura</label>
                  <select value={txPropertyId} onChange={e => setTxPropertyId(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">(Nessuna)</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Addetto</label>
                  <select value={txStaffId} onChange={e => setTxStaffId(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">(Nessuno)</option>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button onClick={resetForm} className="px-5 py-3 text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition">Annulla</button>
              <button onClick={handleSave} className="px-5 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-sm hover:bg-blue-700 transition flex items-center gap-2">
                {editingRowId ? 'Salva Modifica' : 'Aggiungi Movimento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600"/></div>
      ) : filteredTransactions.length === 0 ? (
          <div className="py-20 text-center text-gray-500 flex flex-col items-center bg-white rounded-3xl border border-dashed border-gray-200">
              <History className="w-12 h-12 text-gray-300 mb-3" />
              Nessun movimento registrato. Modifica i filtri o inseriscine uno nuovo.
          </div>
      ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-gray-50 border-b border-gray-100">
                       <tr>
                          <th className="px-6 py-4 font-bold text-gray-700">Data</th>
                          <th className="px-6 py-4 font-bold text-gray-700">Stato</th>
                          <th className="px-6 py-4 font-bold text-gray-700">Tipo</th>
                          <th className="px-6 py-4 font-bold text-gray-700">Metodo</th>
                          <th className="px-6 py-4 font-bold text-gray-700 w-full">Dettaglio / Causale</th>
                          <th className="px-6 py-4 font-bold text-gray-700">Riferimenti</th>
                          <th className="px-6 py-4 font-bold text-gray-700 text-right">Importo</th>
                          <th className="px-6 py-4 font-bold text-gray-700 text-right">Azioni</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                       {filteredTransactions.map(item => {
                          const staffM = staffList.find(s => s.id === item.staff_member_id);
                          const propM = properties.find(p => p.id === item.property_id);
                          return (
                           <tr key={item.id} className="hover:bg-gray-50 transition">
                             <td className="px-6 py-4 text-gray-500">
                                {formatDateTime(item.created_at)}
                             </td>
                             <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                 {item.status === 'scheduled' && <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Programmato</span>}
                                 {item.status === 'confirmed' && <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Confermato</span>}
                                </div>
                             </td>
                             <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                 {item.transaction_type === 'manager_handover' && <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Versamento M.</span>}
                                 {item.transaction_type !== 'manager_handover' && item.amount > 0 && <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Entrata</span>}
                                 {item.transaction_type !== 'manager_handover' && item.amount < 0 && <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase">Uscita</span>}
                                </div>
                             </td>
                             <td className="px-6 py-4 text-gray-700">
                                 <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-1 rounded uppercase">{item.payment_method || 'Contante'}</span>
                             </td>
                             <td className="px-6 py-4 text-gray-900 font-medium truncate max-w-[250px]" title={item.notes || ''}>
                                {item.reason || item.notes}
                             </td>
                             <td className="px-6 py-4 flex flex-col gap-1">
                                {item.bookings ? (
                                    <>
                                       <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded w-fit max-w-[150px] truncate">{item.bookings.properties?.name || ''}</span>
                                       <span className="text-[10px] text-gray-500 font-medium">
                                          {item.bookings.guest_name} • {formatDateStr(item.bookings.check_in_date)} → {formatDateStr(item.bookings.check_out_date)}
                                       </span>
                                    </>
                                ) : propM ? <span className="text-[10px] bg-indigo-50 text-indigo-600 font-bold px-2 py-0.5 rounded w-fit max-w-[150px] truncate">{propM.name}</span> : null}
                                {staffM ? <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded w-fit">{staffM.name}</span> : null}
                             </td>
                             <td className={`px-6 py-4 text-right font-black ${item.amount > 0 ? (item.status === 'confirmed' ? 'text-emerald-600' : 'text-gray-900') : 'text-red-500'}`}>
                                {item.amount > 0 ? '+' : ''}{formatCurrency(item.amount)}
                             </td>
                             <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-1">
                                   <button onClick={() => handleStartEdit(item)} className="p-2.5 bg-white border border-gray-200 text-blue-600 hover:bg-blue-50 rounded-lg transition shadow-sm" title="Modifica">
                                     <Edit3 className="w-4 h-4" />
                                   </button>
                                   <button onClick={() => deleteTransaction(item.id, item.notes)} className="p-2.5 bg-white border border-gray-200 text-red-600 hover:bg-red-50 rounded-lg transition shadow-sm" title="Elimina">
                                     <Trash2 className="w-4 h-4" />
                                   </button>
                                </div>
                             </td>
                          </tr>
                          );
                       })}
                    </tbody>
                     <tfoot className="bg-blue-50/50 border-t-2 border-indigo-100">
                        <tr>
                           <td colSpan={5} className="px-6 py-4 text-right font-black text-indigo-900 text-sm uppercase tracking-wide">Totale Visualizzato</td>
                           <td className={`px-6 py-4 text-right font-black text-lg ${filteredTransactions.reduce((acc, t) => acc + t.amount, 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {formatCurrency(filteredTransactions.reduce((acc, t) => acc + t.amount, 0))}
                           </td>
                           <td className="px-6 py-4"></td>
                        </tr>
                     </tfoot>
                  </table>
              </div>
          </div>
      )}
    </div>
  );
}

export default function CassaPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600"/></div>}>
            <CassaInner />
        </Suspense>
    );
}
