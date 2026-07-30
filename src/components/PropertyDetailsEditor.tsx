"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { Building2, MapPin, Bed, Save, Edit3, X } from "lucide-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";

const MapPicker = dynamic(() => import("./MapPicker"), { 
  ssr: false, 
  loading: () => <div className="h-[250px] bg-gray-100 flex items-center justify-center border rounded">Caricamento Mappa...</div> 
});

export default function PropertyDetailsEditor({ property }: { property: any }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: property.name || "",
    description: property.description || "",
    address: property.address || "",
    city: property.city || "",
    zip_code: property.zip_code || "",
    country: property.country || "Italia",
    latitude: property.latitude || null,
    longitude: property.longitude || null,
    base_price_per_night: property.base_price_per_night || 0,
    cleaning_fee: property.cleaning_fee || 0,
    pet_fee: property.pet_fee || 0,
    security_deposit: property.security_deposit || 0,
    deposit_percentage: property.deposit_percentage || 0,
    city_tax_per_night: property.city_tax_per_night ?? 2,
    city_tax_max_nights: property.city_tax_max_nights ?? 10,
    city_tax_child_age: property.city_tax_child_age ?? 11,
    hide_prices: property.hide_prices ?? false,
    bedrooms: property.bedrooms || 1,
    max_guests: property.max_guests || 2,
    is_active: property.is_active || false,
  });

  const toSlug = (text: string) =>
    text.toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");

  const handleSave = async () => {
    setLoading(true);
    const payload: any = { ...formData };
    const baseSlug = toSlug(formData.name);
    if (baseSlug && baseSlug !== property.slug) {
      let finalSlug = baseSlug;
      const { data: existing } = await supabase
        .from("properties")
        .select("id, slug")
        .neq("id", property.id)
        .filter("slug", "like", `${baseSlug}%`);
      const slugs = new Set((existing || []).map((p: any) => p.slug));
      let i = 1;
      while (slugs.has(finalSlug)) {
        finalSlug = `${baseSlug}-${i++}`;
      }
      payload.slug = finalSlug;
    }
    const { error } = await supabase
      .from("properties")
      .update(payload)
      .eq("id", property.id);

    if (error) {
      toast.error("Errore salvataggio!");
      console.error(error);
    } else {
      setIsEditing(false);
      router.refresh();
      toast.success("Dati aggiornati con successo!");
    }
    setLoading(false);
  };

  if (!isEditing) {
    return (
      <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm relative group overflow-hidden">
        <button 
          onClick={() => setIsEditing(true)} 
          className="absolute top-4 right-4 p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all opacity-0 group-hover:opacity-100"
          title="Modifica"
        >
          <Edit3 className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-medium border-b pb-2 mb-4 text-gray-900">Dettagli Immobile</h3>
        <ul className="space-y-3 text-sm text-gray-600">
          <li className="flex items-center"><Building2 className="w-4 h-4 mr-2" /> SaaS: {property.organizations?.name}</li>
          <li className="flex items-center"><MapPin className="w-4 h-4 mr-2" /> {property.city}</li>
          <li className="flex items-center"><Bed className="w-4 h-4 mr-2" /> {property.bedrooms} Camere ({property.max_guests} Ospiti)</li>
        </ul>
        <div className="mt-6 pt-4 border-t flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-gray-900">€{property.base_price_per_night}</div>
            <div className="text-xs text-gray-500 uppercase font-semibold">Prezzo Base / Notte</div>
          </div>
          <div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold leading-none ${property.is_active ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {property.is_active ? 'Online' : 'Bozza'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm border-t-4 border-t-blue-500 animate-in slide-in-from-top-2">
      <div className="flex justify-between items-center border-b pb-2 mb-4">
        <h3 className="text-lg font-medium text-gray-900">Modifica Dettagli</h3>
        <button onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
      </div>
      
      <div className="space-y-4">
        <div>
           <label className="block text-xs font-medium text-gray-700">Nome</label>
           <input type="text" className="w-full border rounded p-2 text-sm text-gray-900 focus:ring-blue-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        </div>
        
        <div className="flex items-center bg-gray-50 p-2 rounded border">
           <input type="checkbox" className="w-4 h-4 text-blue-600 mr-2" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
           <label className="text-xs font-bold text-gray-700">Pubblica Online (Attivo)</label>
        </div>

        <div>
           <label className="block text-xs font-medium text-gray-700">Descrizione dell'Host</label>
           <textarea className="w-full border rounded p-2 text-sm text-gray-900 h-28 focus:ring-blue-500" placeholder="Es. Bellissimo bilocale vista mare..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
             <label className="block text-xs font-medium text-gray-700">Città</label>
             <input type="text" className="w-full border rounded p-2 text-sm text-gray-900 focus:ring-blue-500" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
          </div>
          <div>
             <label className="block text-xs font-medium text-gray-700">Camere</label>
             <input type="number" className="w-full border rounded p-2 text-sm text-gray-900 focus:ring-blue-500" value={formData.bedrooms} onChange={e => setFormData({...formData, bedrooms: Number(e.target.value)})} />
          </div>
          <div>
             <label className="block text-xs font-medium text-gray-700">Ospiti Max</label>
             <input type="number" className="w-full border rounded p-2 text-sm text-gray-900 focus:ring-blue-500" value={formData.max_guests} onChange={e => setFormData({...formData, max_guests: Number(e.target.value)})} />
          </div>
        </div>

        <div className="pt-4 border-t mt-4 border-gray-100">
          <h4 className="text-sm font-semibold mb-3 text-gray-900">Tariffe e Costi Aggiuntivi</h4>
          <div className="grid grid-cols-3 gap-x-4 gap-y-4 items-end mb-6">
            {[
              { label: 'Prezzo Base (€/notte)',        note: null,                     key: 'base_price_per_night', type: 'number', step: '1',    cls: 'text-gray-900' },
              { label: 'Spese Pulizia (€)',             note: null,                     key: 'cleaning_fee',         type: 'number', step: '1',    cls: 'text-gray-900' },
              { label: 'Tariffa Animale (€/animale)',   note: null,                     key: 'pet_fee',              type: 'number', step: '1',    cls: 'text-gray-900' },
              { label: 'Cauzione Danni (€)',            note: null,                     key: 'security_deposit',     type: 'number', step: '1',    cls: 'text-gray-900' },
              { label: 'Caparra Richiesta (%)',         note: null,                     key: 'deposit_percentage',   type: 'number', step: '1',    cls: 'text-gray-900 bg-orange-50 border-orange-200' },
            ].map(({ label, note, key, type, step, cls }) => (
              <div key={key} className="flex flex-col justify-end">
                <label className="block text-xs font-medium text-gray-700 leading-tight">{label}</label>
                {note
                  ? <p className="text-[10px] text-gray-400 mt-0.5 mb-1 leading-tight">{note}</p>
                  : <div className="h-[18px]" />
                }
                <input
                  type={type}
                  step={step}
                  min="0"
                  className={`w-full border rounded p-2 text-sm focus:ring-blue-500 outline-none ${cls}`}
                  value={(formData as any)[key]}
                  onChange={e => setFormData({ ...formData, [key]: Number(e.target.value) })}
                />
              </div>
            ))}
          </div>

          <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-5">
             <h4 className="text-sm font-bold mb-3 text-blue-900 flex items-center tracking-tight">
                Configurazione Tassa di Soggiorno
             </h4>
             <div className="grid grid-cols-3 gap-x-4 gap-y-4 items-end">
               {[
                 { label: 'Importo (€ a notte/adulto)', note: null,                     key: 'city_tax_per_night',   type: 'number', step: '0.5',  cls: 'font-bold text-blue-900 bg-white border-blue-200' },
                 { label: 'Limite Notti',               note: 'Max notti tassabili',    key: 'city_tax_max_nights',  type: 'number', step: '1',    cls: 'font-bold text-blue-900 bg-white border-blue-200' },
                 { label: 'Età Esenzione',              note: 'Bambini fino a...',      key: 'city_tax_child_age',   type: 'number', step: '1',    cls: 'font-bold text-blue-900 bg-white border-blue-200' },
               ].map(({ label, note, key, type, step, cls }) => (
                 <div key={key} className="flex flex-col justify-end">
                   <label className="block text-xs font-semibold text-blue-900 leading-tight">{label}</label>
                   {note
                     ? <p className="text-[10px] text-blue-600/70 mt-0.5 mb-1 leading-tight">{note}</p>
                     : <div className="h-[18px]" />
                   }
                   <input
                     type={type}
                     step={step}
                     min="0"
                     className={`w-full border rounded p-2 text-sm focus:ring-blue-500 outline-none shadow-sm ${cls}`}
                     value={(formData as any)[key]}
                     onChange={e => setFormData({ ...formData, [key]: Number(e.target.value) })}
                   />
                 </div>
               ))}
             </div>
          </div>
        </div>

        <div className="pt-4 border-t mt-4 border-gray-100 flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
           <input type="checkbox" className="w-4 h-4 text-blue-600" checked={!formData.hide_prices} onChange={e => setFormData({...formData, hide_prices: !e.target.checked})} />
           <div>
             <label className="text-xs font-bold text-gray-700">Prezzi e costi visibili sul form di prenotazione</label>
             <p className="text-[10px] text-gray-400">Se disabilitato, il form mostra solo disponibilità e richiesta dati cliente (senza prezzi)</p>
           </div>
        </div>

        <div className="pt-4 border-t mt-4 border-gray-100">
          <h4 className="text-sm font-semibold mb-3 text-gray-900">Posizione Esatta</h4>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
               <label className="block text-xs font-medium text-gray-700">Indirizzo / Via</label>
               <input type="text" className="w-full border rounded p-2 text-sm text-gray-900 focus:ring-blue-500" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>
            <div>
               <label className="block text-xs font-medium text-gray-700">CAP</label>
               <input type="text" className="w-full border rounded p-2 text-sm text-gray-900 focus:ring-blue-500" value={formData.zip_code} onChange={e => setFormData({...formData, zip_code: e.target.value})} />
            </div>
            <div>
               <label className="block text-xs font-medium text-gray-700">Nazione</label>
               <input type="text" className="w-full border rounded p-2 text-sm text-gray-900 focus:ring-blue-500" value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} />
            </div>
          </div>
          
          <label className="block text-xs font-medium text-gray-700 mb-1">Punta il Mouse sulla Mappa</label>
          <MapPicker 
            latitude={formData.latitude} 
            longitude={formData.longitude} 
            onChange={(lat, lng) => setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }))}
          />
        </div>

        <div className="pt-4 border-t flex justify-end">
          <button 
            onClick={handleSave} 
            disabled={loading}
            className="flex items-center bg-blue-600 text-white px-5 py-2 rounded shadow-md hover:bg-blue-700 transition"
          >
            <Save className="w-4 h-4 mr-2" /> {loading ? "Sto salvando..." : "Salva Modifiche"}
          </button>
        </div>
      </div>
    </div>
  );
}
