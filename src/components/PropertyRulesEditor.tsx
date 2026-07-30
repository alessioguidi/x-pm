"use client";

import { useState } from "react";
import { supabase } from "@/utils/supabase/client";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function PropertyRulesEditor({ property }: { property: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const initialRules = property.house_rules && Object.keys(property.house_rules).length > 0 ? property.house_rules : {
    pets_allowed: false,
    smoking_allowed: false,
    events_allowed: false,
    quiet_hours_start: "22:00",
    quiet_hours_end: "08:00"
  };

  const initialWifi = property.wifi_info && Object.keys(property.wifi_info).length > 0 ? property.wifi_info : {
    network: "",
    password: ""
  };

  const [rules, setRules] = useState(initialRules);
  const [wifi, setWifi] = useState(initialWifi);
  
  const [cancellationPolicy, setCancellationPolicy] = useState(property.cancellation_policy || "Flessibile");
  const [checkInMethod, setCheckInMethod] = useState(property.check_in_method || "Host welcome");
  const [checkInInstructions, setCheckInInstructions] = useState(property.check_in_instructions || "");
  const [houseManual, setHouseManual] = useState(property.house_manual || "");
  const [minAdvanceDays, setMinAdvanceDays] = useState(property.min_advance_days ?? 2);

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase
      .from("properties")
      .update({
         house_rules: rules,
         wifi_info: wifi,
         cancellation_policy: cancellationPolicy,
         check_in_method: checkInMethod,
         check_in_instructions: checkInInstructions,
         house_manual: houseManual,
         min_advance_days: minAdvanceDays
      })
      .eq("id", property.id);

    if (error) {
      toast.error("Errore salvataggio!");
      console.error(error);
    } else {
      router.refresh();
      toast.success("Dati aggiornati correttamente!");
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm space-y-10 animate-in fade-in">
      
      {/* SEZIONE REGOLE */}
      <section>
        <h3 className="text-xl font-bold text-gray-900 border-b pb-2 mb-6">Regole della casa</h3>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 border rounded-lg hover:border-blue-300 transition-colors">
            <div>
              <div className="font-medium text-gray-900">Animali domestici ammessi</div>
              <div className="text-sm text-gray-500">Ricorda che i cani da assistenza non possono essere rifiutati.</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={rules.pets_allowed} onChange={(e) => setRules({...rules, pets_allowed: e.target.checked})} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg hover:border-blue-300 transition-colors">
            <div>
              <div className="font-medium text-gray-900">Fumatori ammessi</div>
              <div className="text-sm text-gray-500">È consentito fumare all'interno?</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={rules.smoking_allowed} onChange={(e) => setRules({...rules, smoking_allowed: e.target.checked})} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-lg hover:border-blue-300 transition-colors">
            <div>
              <div className="font-medium text-gray-900">Feste o eventi consentiti</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={rules.events_allowed} onChange={(e) => setRules({...rules, events_allowed: e.target.checked})} />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="p-4 border rounded-lg space-y-4 hover:border-blue-300 transition-colors">
            <div className="font-medium text-gray-900">Orari del Silenzio</div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Inizio Orario di Silenzio</label>
                <input type="time" className="w-full border rounded p-2 focus:ring-blue-500" value={rules.quiet_hours_start} onChange={(e) => setRules({...rules, quiet_hours_start: e.target.value})} />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">Fine Orario di Silenzio</label>
                <input type="time" className="w-full border rounded p-2 focus:ring-blue-500" value={rules.quiet_hours_end} onChange={(e) => setRules({...rules, quiet_hours_end: e.target.value})} />
          </div>
        </div>
        </div>

        <div className="p-4 border rounded-lg hover:border-blue-300 transition-colors">
          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-900">Giorni di preavviso per prenotazione</label>
            <input type="number" min="0" max="365" className="w-20 border rounded p-2 text-gray-900 focus:ring-blue-500" value={minAdvanceDays} onChange={e => setMinAdvanceDays(Number(e.target.value))} />
          </div>
        </div>
        </div>
      </section>

      {/* SEZIONE ARRIVO E CHECK-IN */}
      <section>
        <h3 className="text-xl font-bold text-gray-900 border-b pb-2 mb-6">Arrivo e Check-in</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Metodo di Check-in</label>
            <select className="w-full border rounded p-2 text-gray-900 focus:ring-blue-500" value={checkInMethod} onChange={(e) => setCheckInMethod(e.target.value)}>
              <option value="Host welcome">Accoglienza di persona dalla reception</option>
              <option value="Self check-in con tastierino">Self check-in con tastierino alfanumerico</option>
              <option value="Self check-in con cassetta di sicurezza">Self check-in con cassetta chiavi</option>
              <option value="Smart lock">Smart Lock elettronica (Da remoto)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Istruzioni (Guida Arrivo)</label>
            <textarea className="w-full border rounded p-2 text-gray-900 min-h-[100px] focus:ring-blue-500" placeholder="Es. Il codice del cancello è 1234. La cassettina si trova sul muro a destra." value={checkInInstructions} onChange={(e) => setCheckInInstructions(e.target.value)} />
          </div>
        </div>
      </section>

      {/* SEZIONE WIFI E MANUALE */}
      <section>
        <h3 className="text-xl font-bold text-gray-900 border-b pb-2 mb-6">In Casa</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Rete Wi-Fi (SSID)</label>
            <input type="text" className="w-full border rounded p-2 text-gray-900 focus:ring-blue-500" value={wifi.network} onChange={(e) => setWifi({...wifi, network: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Password Wi-Fi</label>
            <input type="text" className="w-full border rounded p-2 text-gray-900 focus:ring-blue-500" value={wifi.password} onChange={(e) => setWifi({...wifi, password: e.target.value})} />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Manuale della Casa (per l'ospite)</label>
          <textarea className="w-full border rounded p-2 text-gray-900 min-h-[150px] focus:ring-blue-500" placeholder="Spiega all'ospite dove si butta la spazzatura, il funzionamento della caldaia ecc..." value={houseManual} onChange={(e) => setHouseManual(e.target.value)} />
        </div>
      </section>

      {/* SEZIONE CAUZIONE E CHECK-OUT */}
      <section>
        <h3 className="text-xl font-bold text-gray-900 border-b pb-2 mb-6">Cauzione e Check-out</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Metodo Cauzione</label>
            <select
              value={property.deposit_method || "cash"}
              onChange={async (e) => {
                const val = e.target.value;
                await supabase.from("properties").update({ deposit_method: val }).eq("id", property.id);
                router.refresh();
                toast.success("Metodo cauzione aggiornato");
              }}
              className="w-full border rounded p-2 text-gray-900 focus:ring-blue-500 outline-none"
            >
              <option value="cash">Contanti in loco</option>
              <option value="stripe">Pre-autorizzazione Stripe</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">Checklist Check-out</label>
            <p className="text-xs text-gray-500 mb-2">Voci da far verificare all'ospite prima di lasciare la struttura.</p>
            {(property.checkout_checklist || []).map((item: string, i: number) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={item}
                  onChange={async (e) => {
                    const list = [...(property.checkout_checklist || [])];
                    list[i] = e.target.value;
                    await supabase.from("properties").update({ checkout_checklist: list }).eq("id", property.id);
                    router.refresh();
                  }}
                  className="flex-1 border rounded p-2 text-sm text-gray-900 focus:ring-blue-500 outline-none"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const list = (property.checkout_checklist || []).filter((_: any, idx: number) => idx !== i);
                    await supabase.from("properties").update({ checkout_checklist: list }).eq("id", property.id);
                    router.refresh();
                    toast.success("Voce rimossa");
                  }}
                  className="text-red-500 hover:text-red-700 p-1"
                >
                  X
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={async () => {
                const list = [...(property.checkout_checklist || []), ""];
                await supabase.from("properties").update({ checkout_checklist: list }).eq("id", property.id);
                router.refresh();
              }}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Aggiungi voce
            </button>
          </div>
        </div>
      </section>

      {/* SEZIONE POLICY */}
      <section>
        <h3 className="text-xl font-bold text-gray-900 border-b pb-2 mb-6">Cancellazione e Penali</h3>
        <div>
          <select className="w-full border rounded p-2 text-gray-900 focus:ring-blue-500" value={cancellationPolicy} onChange={(e) => setCancellationPolicy(e.target.value)}>
            <option value="Flessibile">Flessibile (Rimborso totale fino a 1 giorno prima)</option>
            <option value="Moderato">Moderato (Rimborso totale fino a 5 giorni prima)</option>
            <option value="Rigido">Rigido (Rimborso totale solo entro 48 ore dalla prenotazione)</option>
            <option value="Non rimborsabile">Non rimborsabile e pagamento anticipato</option>
          </select>
        </div>
      </section>

      <div className="pt-6 border-t flex justify-end">
        <button 
          onClick={handleSave} 
          disabled={loading}
          className="flex items-center bg-blue-600 text-white px-6 py-2.5 rounded-lg shadow hover:bg-blue-700 transition"
        >
          <Save className="w-5 h-5 mr-2" /> {loading ? "Salvataggio..." : "Salva Regole"}
        </button>
      </div>

    </div>
  );
}
