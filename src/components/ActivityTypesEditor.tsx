"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Tags, Plus, Trash2, Loader2, Check } from "lucide-react";
import toast from "react-hot-toast";

export default function ActivityTypesEditor({ orgId }: { orgId: string }) {
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("bg-gray-100 text-gray-800 border-gray-300");

  const colors = [
    { class: "bg-blue-100 text-blue-800 border-blue-200", bg: "bg-blue-500" },
    { class: "bg-indigo-100 text-indigo-800 border-indigo-200", bg: "bg-indigo-500" },
    { class: "bg-purple-100 text-purple-800 border-purple-200", bg: "bg-purple-500" },
    { class: "bg-rose-100 text-rose-800 border-rose-200", bg: "bg-rose-500" },
    { class: "bg-emerald-100 text-emerald-800 border-emerald-200", bg: "bg-emerald-500" },
    { class: "bg-amber-100 text-amber-800 border-amber-200", bg: "bg-amber-500" },
    { class: "bg-gray-100 text-gray-800 border-gray-300", bg: "bg-gray-800" },
  ];

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    setLoading(true);
    const { data } = await supabase.from('activity_types').select('*').order('name');
    setTypes(data || []);
    setLoading(false);
  };

  const handleAdd = async (e: any) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    
    // Controlla se la tipologia Check-in o Check-out esiste già per proteggerle?
    
    const { error } = await supabase.from('activity_types').insert({
       organization_id: orgId,
       name: newName,
       color: newColor
    });

    if (error) {
       toast.error("Errore salvataggio!");
    } else {
       toast.success("Tipologia creata");
       setNewName("");
       fetchTypes();
    }
    setAdding(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (['Check-in', 'Check-out', 'Pulizie'].includes(name)) {
       return toast.error("Le tipologie di sistema non possono essere cancellate.");
    }
    if (!confirm(`Sei sicuro di voler eliminare la tipologia ${name}? I tasks ad essa collegati potrebbero non funzionare correttamente.`)) return;

    const { error } = await supabase.from('activity_types').delete().eq('id', id);
    if (error) toast.error("Impossibile eliminare");
    else fetchTypes();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6 animate-in slide-in-from-bottom-2 fade-in">
       <div className="p-6">
         <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
            <Tags className="w-5 h-5 mr-2 text-rose-600"/>
            Tipologie di Attività (Task e Opportunità)
         </h3>
         <p className="text-sm text-gray-500 mb-6">
            Aggiungi qui categorie di task da assegnare al tuo staff (es. Manutenzione, Chiamata Marketing). Check-in, Check-out e Pulizie sono fisse.
         </p>

         {loading ? (
             <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
         ) : (
             <div className="space-y-4">
                 <div className="flex flex-wrap gap-3">
                     {types.map(t => (
                         <div key={t.id} className={`flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg border text-sm font-bold ${t.color}`}>
                             {t.name}
                             {!['Check-in', 'Check-out', 'Pulizie'].includes(t.name) && (
                                <button onClick={() => handleDelete(t.id, t.name)} className="opacity-50 hover:opacity-100 hover:text-red-600 transition"><Trash2 className="w-4 h-4"/></button>
                             )}
                         </div>
                     ))}
                 </div>

                 <form onSubmit={handleAdd} className="mt-6 flex flex-col md:flex-row gap-4 border bg-gray-50 p-4 rounded-xl">
                    <div className="flex-1">
                        <label className="text-xs uppercase font-bold text-gray-500 mb-1 block">Nome Tipologia</label>
                        <input type="text" maxLength={30} value={newName} onChange={e => setNewName(e.target.value)} placeholder="Es. Chiamata Vendita" required className="w-full border p-2.5 rounded-xl border-gray-300" />
                    </div>
                    <div>
                        <label className="text-xs uppercase font-bold text-gray-500 mb-1 block">Colore</label>
                        <div className="flex items-center gap-2 h-[46px]">
                            {colors.map(c => (
                                <button key={c.class} type="button" onClick={() => setNewColor(c.class)} className={`w-8 h-8 rounded-full border-2 ${newColor === c.class ? 'border-gray-900 scale-110' : 'border-transparent'} ${c.bg} flex justify-center items-center transition`}>
                                    {newColor === c.class && <Check className="w-4 h-4 text-white" />}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-end">
                       <button type="submit" disabled={adding} className="bg-gray-900 text-white font-bold h-[46px] px-6 rounded-xl hover:bg-gray-800 transition flex items-center shrink-0 disabled:opacity-50">
                           {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                           Aggiungi
                       </button>
                    </div>
                 </form>
             </div>
         )}
       </div>
    </div>
  );
}
