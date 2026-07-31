"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { Save, Plus, Trash2, Utensils, Landmark, Phone, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

type GuideItem = { name: string; description?: string; address?: string; phone?: string; url?: string };
type UsefulNumber = { label: string; phone: string };

export default function PropertyGuideEditor({ property }: { property: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [restaurants, setRestaurants] = useState<GuideItem[]>(Array.isArray(property.guide_restaurants) ? property.guide_restaurants : []);
  const [attractions, setAttractions] = useState<GuideItem[]>(Array.isArray(property.guide_attractions) ? property.guide_attractions : []);
  const [usefulNumbers, setUsefulNumbers] = useState<UsefulNumber[]>(Array.isArray(property.useful_numbers) ? property.useful_numbers : []);
  const [guideNotes, setGuideNotes] = useState(property.guide_notes || "");
  const [portalExpiresDays, setPortalExpiresDays] = useState(property.portal_expires_days ?? 7);

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("properties")
      .update({
        guide_restaurants: restaurants.filter(r => r.name),
        guide_attractions: attractions.filter(a => a.name),
        useful_numbers: usefulNumbers.filter(n => n.label && n.phone),
        guide_notes: guideNotes,
        portal_expires_days: portalExpiresDays,
      })
      .eq("id", property.id);

    if (error) {
      toast.error("Errore salvataggio!");
      console.error(error);
    } else {
      router.refresh();
      toast.success("Guida aggiornata correttamente!");
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm space-y-10 animate-in fade-in">

      {/* SEZIONE RISTORANTI */}
      <section>
        <h3 className="text-xl font-bold text-gray-900 border-b pb-2 mb-4 flex items-center">
          <Utensils className="w-5 h-5 mr-2 text-blue-600" /> Ristoranti e Consigli Culinari
        </h3>
        {restaurants.map((item, i) => (
          <div key={i} className="border rounded-lg p-3 mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Nome ristorante"
                className="border rounded p-2 text-sm text-gray-900 focus:ring-blue-500 outline-none"
                value={item.name}
                onChange={e => setRestaurants(restaurants.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r))}
              />
              <input
                placeholder="Telefono"
                className="border rounded p-2 text-sm text-gray-900 focus:ring-blue-500 outline-none"
                value={item.phone || ""}
                onChange={e => setRestaurants(restaurants.map((r, idx) => idx === i ? { ...r, phone: e.target.value } : r))}
              />
            </div>
            <input
              placeholder="Indirizzo (es. Via Roma 12, centro)"
              className="w-full border rounded p-2 text-sm text-gray-900 focus:ring-blue-500 outline-none"
              value={item.address || ""}
              onChange={e => setRestaurants(restaurants.map((r, idx) => idx === i ? { ...r, address: e.target.value } : r))}
            />
            <input
              placeholder="Link (opzionale)"
              className="w-full border rounded p-2 text-sm text-gray-900 focus:ring-blue-500 outline-none"
              value={item.url || ""}
              onChange={e => setRestaurants(restaurants.map((r, idx) => idx === i ? { ...r, url: e.target.value } : r))}
            />
            <textarea
              placeholder="Descrizione / consiglio (opzionale)"
              className="w-full border rounded p-2 text-sm text-gray-900 focus:ring-blue-500 outline-none"
              value={item.description || ""}
              onChange={e => setRestaurants(restaurants.map((r, idx) => idx === i ? { ...r, description: e.target.value } : r))}
            />
            <button
              type="button"
              onClick={() => setRestaurants(restaurants.filter((_, idx) => idx !== i))}
              className="text-red-500 hover:text-red-700 text-xs font-medium flex items-center"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Rimuovi
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRestaurants([...restaurants, { name: "" }])}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center"
        >
          <Plus className="w-4 h-4 mr-1" /> Aggiungi ristorante
        </button>
      </section>

      {/* SEZIONE ATTRAZIONI */}
      <section>
        <h3 className="text-xl font-bold text-gray-900 border-b pb-2 mb-4 flex items-center">
          <Landmark className="w-5 h-5 mr-2 text-blue-600" /> Attrazioni e Luoghi da Visitare
        </h3>
        {attractions.map((item, i) => (
          <div key={i} className="border rounded-lg p-3 mb-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Nome attrazione"
                className="border rounded p-2 text-sm text-gray-900 focus:ring-blue-500 outline-none"
                value={item.name}
                onChange={e => setAttractions(attractions.map((r, idx) => idx === i ? { ...r, name: e.target.value } : r))}
              />
              <input
                placeholder="Link (opzionale)"
                className="border rounded p-2 text-sm text-gray-900 focus:ring-blue-500 outline-none"
                value={item.url || ""}
                onChange={e => setAttractions(attractions.map((r, idx) => idx === i ? { ...r, url: e.target.value } : r))}
              />
            </div>
            <input
              placeholder="Indirizzo (opzionale)"
              className="w-full border rounded p-2 text-sm text-gray-900 focus:ring-blue-500 outline-none"
              value={item.address || ""}
              onChange={e => setAttractions(attractions.map((r, idx) => idx === i ? { ...r, address: e.target.value } : r))}
            />
            <textarea
              placeholder="Descrizione (opzionale)"
              className="w-full border rounded p-2 text-sm text-gray-900 focus:ring-blue-500 outline-none"
              value={item.description || ""}
              onChange={e => setAttractions(attractions.map((r, idx) => idx === i ? { ...r, description: e.target.value } : r))}
            />
            <button
              type="button"
              onClick={() => setAttractions(attractions.filter((_, idx) => idx !== i))}
              className="text-red-500 hover:text-red-700 text-xs font-medium flex items-center"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Rimuovi
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setAttractions([...attractions, { name: "" }])}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center"
        >
          <Plus className="w-4 h-4 mr-1" /> Aggiungi attrazione
        </button>
      </section>

      {/* SEZIONE NUMERI UTILI */}
      <section>
        <h3 className="text-xl font-bold text-gray-900 border-b pb-2 mb-4 flex items-center">
          <Phone className="w-5 h-5 mr-2 text-blue-600" /> Numeri Utili
        </h3>
        {usefulNumbers.map((item, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              placeholder="Etichetta (es. Emergenze, Taxi)"
              className="flex-1 border rounded p-2 text-sm text-gray-900 focus:ring-blue-500 outline-none"
              value={item.label}
              onChange={e => setUsefulNumbers(usefulNumbers.map((r, idx) => idx === i ? { ...r, label: e.target.value } : r))}
            />
            <input
              placeholder="Telefono"
              className="flex-1 border rounded p-2 text-sm text-gray-900 focus:ring-blue-500 outline-none"
              value={item.phone}
              onChange={e => setUsefulNumbers(usefulNumbers.map((r, idx) => idx === i ? { ...r, phone: e.target.value } : r))}
            />
            <button
              type="button"
              onClick={() => setUsefulNumbers(usefulNumbers.filter((_, idx) => idx !== i))}
              className="text-red-500 hover:text-red-700 p-2"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setUsefulNumbers([...usefulNumbers, { label: "", phone: "" }])}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center"
        >
          <Plus className="w-4 h-4 mr-1" /> Aggiungi numero
        </button>
      </section>

      {/* SEZIONE NOTE LIBERE */}
      <section>
        <h3 className="text-xl font-bold text-gray-900 border-b pb-2 mb-4">Note e Consigli Extra</h3>
        <textarea
          className="w-full border rounded p-2 text-gray-900 min-h-[120px] focus:ring-blue-500"
          placeholder="Es. I migliori posti per il tramonto, dove parcheggiare, info sul supermercato più vicino..."
          value={guideNotes}
          onChange={e => setGuideNotes(e.target.value)}
        />
      </section>

      {/* SEZIONE SCADENZA PORTAL */}
      <section>
        <h3 className="text-xl font-bold text-gray-900 border-b pb-2 mb-4 flex items-center">
          <MapPin className="w-5 h-5 mr-2 text-blue-600" /> Link Portal Ospite
        </h3>
        <div className="flex items-center gap-4 p-4 border rounded-lg">
          <div className="font-medium text-gray-900">Il link scade</div>
          <input
            type="number"
            min="1"
            max="365"
            className="w-20 border rounded p-2 text-gray-900 focus:ring-blue-500 outline-none"
            value={portalExpiresDays}
            onChange={e => setPortalExpiresDays(Number(e.target.value))}
          />
          <div className="font-medium text-gray-900">giorni dopo il check-out</div>
        </div>
      </section>

      <div className="pt-6 border-t flex justify-end">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center bg-blue-600 text-white px-6 py-2.5 rounded-lg shadow hover:bg-blue-700 transition"
        >
          <Save className="w-5 h-5 mr-2" /> {loading ? "Salvataggio..." : "Salva Guida"}
        </button>
      </div>

    </div>
  );
}
