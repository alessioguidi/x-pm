"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Users, Loader2, Save, Key, Sparkles, LogOut } from "lucide-react";
import toast from "react-hot-toast";

type StaffMember = {
  id: string;
  name: string;
  role: string;
};

export default function PropertyStaffEditor({ property }: { property: any }) {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // States
  const [checkinDev, setCheckinDev] = useState<string>(property.default_checkin_staff_id || "");
  const [checkoutDev, setCheckoutDev] = useState<string>(property.default_checkout_staff_id || "");
  const [cleaningDev, setCleaningDev] = useState<string>(property.default_cleaning_staff_id || "");

  useEffect(() => {
    async function loadStaff() {
      // Load only staff of the same organization
      const { data, error } = await supabase
        .from("staff_members")
        .select("id, name, role")
        .eq("organization_id", property.organization_id)
        .order("name");

      if (data) setStaffList(data);
      setLoading(false);
    }
    loadStaff();
  }, [property.organization_id]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("properties")
      .update({
        default_checkin_staff_id: checkinDev || null,
        default_checkout_staff_id: checkoutDev || null,
        default_cleaning_staff_id: cleaningDev || null
      })
      .eq("id", property.id);

    setSaving(false);
    if (error) {
      toast.error("Errore salvataggio: " + error.message);
    } else {
      toast.success("Assegnazioni staff aggiornate!");
    }
  };

  if (loading) {
    return <div className="flex p-8 justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm">
      <div className="mb-6 flex items-start justify-between">
         <div>
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" /> Defaults dello Staff
            </h3>
            <p className="text-gray-500 mt-1 text-sm">Assegna un incaricato predefinito per questo immobile. Verrà automaticamente selezionato nelle nuove prenotazioni.</p>
         </div>
      </div>

      <div className="space-y-6 max-w-lg">
        {/* Check-in */}
        <div>
          <label className="flex flex-col gap-1.5 font-bold text-gray-700">
            <span className="flex items-center gap-2"><Key className="w-4 h-4 text-emerald-600" /> Addetto al Check-in</span>
            <select
              value={checkinDev}
              onChange={(e) => setCheckinDev(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 border p-3 py-2 text-gray-900 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Nessuno (Non Assegnato)</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
          </label>
        </div>

        {/* Check-out */}
        <div>
          <label className="flex flex-col gap-1.5 font-bold text-gray-700">
            <span className="flex items-center gap-2"><LogOut className="w-4 h-4 text-rose-600" /> Addetto al Check-out</span>
            <select
              value={checkoutDev}
              onChange={(e) => setCheckoutDev(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 border p-3 py-2 text-gray-900 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Nessuno (Non Assegnato)</option>
              {staffList.map(s => (
                 <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
          </label>
        </div>

        {/* Cleaning */}
        <div>
          <label className="flex flex-col gap-1.5 font-bold text-gray-700">
            <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-cyan-600" /> Addetto alle Pulizie</span>
            <select
              value={cleaningDev}
              onChange={(e) => setCleaningDev(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 border p-3 py-2 text-gray-900 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Nessuno (Non Assegnato)</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
          </label>
        </div>

      </div>

      <div className="pt-6 mt-6 border-t border-gray-100 flex justify-end">
         <button 
           onClick={handleSave}
           disabled={saving}
           className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center transition disabled:opacity-50"
         >
           {saving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="w-5 h-5 mr-2" />}
           Salva Defaults
         </button>
      </div>

    </div>
  );
}
