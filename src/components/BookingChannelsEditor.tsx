"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Plus, Trash2, Save, Globe } from "lucide-react";
import toast from "react-hot-toast";

const DEFAULT_CHANNELS = [
  { name: "Booking.com",  commission_pct: 25, tax_pct: 26 },
  { name: "Airbnb",       commission_pct: 20, tax_pct: 26 },
  { name: "Facebook",     commission_pct: 0,  tax_pct: 0  },
  { name: "Subito.it",    commission_pct: 0,  tax_pct: 0  },
  { name: "Sito Web",     commission_pct: 0,  tax_pct: 0  },
];

interface Channel {
  id?: string;
  name: string;
  commission_pct: number;
  tax_pct: number;
  is_active: boolean;
  isNew?: boolean;
}

export default function BookingChannelsEditor({ orgId }: { orgId: string }) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchChannels(); }, [orgId]);

  const fetchChannels = async () => {
    const { data } = await supabase
      .from("booking_channels")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at");
    if (data && data.length > 0) {
      setChannels(data);
    } else {
      // Pre-carica i default se non ci sono ancora portali
      setChannels(DEFAULT_CHANNELS.map(c => ({ ...c, is_active: true, isNew: true })));
    }
    setLoading(false);
  };

  const addRow = () => {
    setChannels(prev => [...prev, { name: "", commission_pct: 0, tax_pct: 0, is_active: true, isNew: true }]);
  };

  const update = (idx: number, field: keyof Channel, value: any) => {
    setChannels(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const removeRow = async (idx: number) => {
    const ch = channels[idx];
    if (ch.id) {
      const { error } = await supabase.from("booking_channels").delete().eq("id", ch.id);
      if (error) { toast.error("Errore eliminazione"); return; }
    }
    setChannels(prev => prev.filter((_, i) => i !== idx));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (const ch of channels) {
        const payload = {
          organization_id: orgId,
          name: ch.name,
          commission_pct: ch.commission_pct,
          tax_pct: ch.tax_pct,
          is_active: ch.is_active,
        };
        if (ch.id) {
          await supabase.from("booking_channels").update(payload).eq("id", ch.id);
        } else {
          await supabase.from("booking_channels").insert(payload);
        }
      }
      toast.success("Portali salvati!");
      fetchChannels();
    } catch (e) {
      toast.error("Errore salvataggio");
    }
    setSaving(false);
  };

  if (loading) return null;

  return (
    <div className="mt-8 bg-white border border-gray-200 rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">Portali di Prenotazione</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={addRow} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700 transition">
            <Plus className="w-3.5 h-3.5" /> Aggiungi
          </button>
          <button onClick={saveAll} disabled={saving} className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition">
            <Save className="w-3.5 h-3.5" /> {saving ? "Salvo..." : "Salva Tutto"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b">
              <th className="text-left pb-2 pr-4">Portale</th>
              <th className="text-center pb-2 px-2 w-32">Commissione %</th>
              <th className="text-center pb-2 px-2 w-32">Cedolare Secca %</th>
              <th className="text-center pb-2 px-2 w-20">Attivo</th>
              <th className="pb-2 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {channels.map((ch, idx) => (
              <tr key={idx} className="group">
                <td className="py-2 pr-4">
                  <input
                    type="text"
                    className="w-full border-b border-transparent group-hover:border-gray-300 focus:border-blue-500 outline-none text-sm text-gray-900 bg-transparent py-0.5"
                    value={ch.name}
                    placeholder="Es. Booking.com"
                    onChange={e => update(idx, "name", e.target.value)}
                  />
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" max="100" step="0.5"
                      className="w-full border rounded p-1 text-center text-sm text-gray-900 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      value={ch.commission_pct}
                      onChange={e => update(idx, "commission_pct", Number(e.target.value))}
                    />
                    <span className="text-gray-400 text-xs">%</span>
                  </div>
                </td>
                <td className="py-2 px-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min="0" max="100" step="0.5"
                      className="w-full border rounded p-1 text-center text-sm text-gray-900 focus:ring-blue-500 focus:border-blue-500 outline-none bg-amber-50 border-amber-200"
                      value={ch.tax_pct}
                      onChange={e => update(idx, "tax_pct", Number(e.target.value))}
                    />
                    <span className="text-gray-400 text-xs">%</span>
                  </div>
                </td>
                <td className="py-2 px-2 text-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded"
                    checked={ch.is_active}
                    onChange={e => update(idx, "is_active", e.target.checked)}
                  />
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => removeRow(idx)}
                    className="p-1 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {channels.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-gray-400 text-sm">Nessun portale. Clicca "Aggiungi".</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-400 mt-3">
        💡 La commissione portale e la cedolare secca vengono calcolate automaticamente al momento della prenotazione.
      </p>
    </div>
  );
}
