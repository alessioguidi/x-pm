"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { Save, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

type ExtraService = {
  id: string;
  name: string;
  price: number;
  cost_price?: number;
};

export default function PropertyExtraServicesEditor({ property }: { property: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const initialServices: ExtraService[] = Array.isArray(property.extra_services) ? property.extra_services : [];
  const [services, setServices] = useState<ExtraService[]>(initialServices);

  const addService = () => {
    setServices([...services, { id: Math.random().toString(36).substr(2, 9), name: "", price: 0, cost_price: 0 }]);
  };

  const updateService = (id: string, field: keyof ExtraService, value: string | number) => {
    setServices(services.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const removeService = (id: string) => {
    setServices(services.filter(s => s.id !== id));
  };

  const handleSave = async () => {
    setLoading(true);
    // Filtriamo quelli vuoti o non validi
    const validServices = services.filter(s => s.name.trim() !== "");
    
    const { error } = await supabase
      .from("properties")
      .update({ extra_services: validServices })
      .eq("id", property.id);

    if (error) {
      toast.error("Errore salvataggio tariffario!");
      console.error(error);
    } else {
      setServices(validServices);
      router.refresh();
      toast.success("Listino Extra salvato!");
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm animate-in fade-in">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h3 className="text-xl font-bold text-gray-900">Listino Servizi Extra</h3>
           <p className="text-sm text-gray-500">Crea pacchetti o servizi che l'ospite può aggiungere alla prenotazione.</p>
        </div>
        <button onClick={addService} className="flex items-center text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-2 rounded transition">
           <Plus className="w-4 h-4 mr-1" /> Aggiungi Voce
        </button>
      </div>

      <div className="space-y-3 mb-8">
        {services.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-500">
             Nessun servizio extra definito. Clicca su "Aggiungi Voce".
          </div>
        ) : (
          services.map((svc, index) => (
             <div key={svc.id} className="flex items-center gap-3 bg-gray-50 p-3 border border-gray-200 rounded-lg">
                <div className="flex-grow">
                   <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Nome Servizio</label>
                   <input type="text" placeholder="Es. Kit Asciugamani" className="w-full text-sm border-gray-300 rounded focus:ring-blue-500" value={svc.name} onChange={e => updateService(svc.id, 'name', e.target.value)} />
                </div>
                <div className="w-32">
                   <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">Prezzo Visibile (€)</label>
                   <input type="number" step="0.01" className="w-full text-sm border-gray-300 rounded focus:ring-blue-500 bg-white" value={svc.price} onChange={e => updateService(svc.id, 'price', Number(e.target.value))} />
                </div>
                <div className="w-32">
                   <label className="block text-[10px] font-bold uppercase text-amber-600 mb-1" title="Costo reale sostenuto dall'agenzia">Mio Costo (€)</label>
                   <input type="number" step="0.01" className="w-full text-sm border-amber-300 bg-amber-50 rounded focus:ring-amber-500" value={svc.cost_price || 0} onChange={e => updateService(svc.id, 'cost_price', Number(e.target.value))} />
                </div>
                <div className="w-10 pt-5 flex justify-center">
                   <button onClick={() => removeService(svc.id)} className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition" title="Rimuovi">
                     <Trash2 className="w-5 h-5" />
                   </button>
                </div>
             </div>
          ))
        )}
      </div>

      <div className="pt-6 border-t flex justify-end">
        <button 
          onClick={handleSave} 
          disabled={loading}
          className="flex items-center bg-blue-600 text-white px-6 py-2.5 rounded-lg shadow hover:bg-blue-700 transition"
        >
          <Save className="w-5 h-5 mr-2" /> {loading ? "Salvataggio..." : "Salva Tariffario Extra"}
        </button>
      </div>
    </div>
  );
}
