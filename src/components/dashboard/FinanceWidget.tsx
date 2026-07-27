"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/utils/supabase/client";
import { TrendingUp, TrendingDown, Euro, X, Percent, Briefcase, Wifi, Receipt, RefreshCw, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import { formatCurrency, formatPercent } from "@/lib/format";

export default function FinanceWidget() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [costModal, setCostModal] = useState<any>(null);
  const [recalcing, setRecalcing] = useState(false);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);

    const today = new Date();
    const currentYear = today.getFullYear();

    const { data: bookings } = await supabase.from('bookings').select('*')
      .gte('check_in_date', `${currentYear - 1}-01-01`);

    const ytdCurrent = bookings?.filter(b => b.check_in_date.startsWith(currentYear.toString())) || [];
    const ytdPrev = bookings?.filter(b => b.check_in_date.startsWith((currentYear - 1).toString())) || [];

    const ytdRev = ytdCurrent.reduce((s, b) => s + (b.total_price || 0), 0);
    const prevRev = ytdPrev.reduce((s, b) => s + (b.total_price || 0), 0);
    const revDiff = prevRev > 0 ? ((ytdRev - prevRev) / prevRev) * 100 : 100;

    const ytdCost = ytdCurrent.reduce((s, b) => s + Number(b.staff_cost || 0) + Number(b.services_cost || 0) + Number(b.commission_amount || 0) + Number(b.tax_amount || 0), 0);
    const prevCost = ytdPrev.reduce((s, b) => s + Number(b.staff_cost || 0) + Number(b.services_cost || 0) + Number(b.commission_amount || 0) + Number(b.tax_amount || 0), 0);

    const costBreakdown = {
      staff: ytdCurrent.reduce((s, b) => s + Number(b.staff_cost || 0), 0),
      services: ytdCurrent.reduce((s, b) => s + Number(b.services_cost || 0), 0),
      commissions: ytdCurrent.reduce((s, b) => s + Number(b.commission_amount || 0), 0),
      taxes: ytdCurrent.reduce((s, b) => s + Number(b.tax_amount || 0), 0),
    };
    const ytdProfit = ytdRev - ytdCost;
    const prevProfit = prevRev - prevCost;
    const ytdMargin = ytdRev > 0 ? (ytdProfit / ytdRev) * 100 : 0;
    const prevMargin = prevRev > 0 ? (prevProfit / prevRev) * 100 : 0;

    setMetrics({ ytdRev, revDiff, ytdCost, ytdProfit, ytdMargin, prevMargin, costBreakdown });
    setLoading(false);
  };

  if (loading || !metrics) {
    return <div className="p-10 flex justify-center animate-pulse"><div className="h-4 w-24 bg-gray-200 rounded"></div></div>;
  }

  return (
    <div className="p-5 h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-600" /> Finanze
        </h3>
        <button
          onClick={async () => {
            setRecalcing(true);
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const token = session?.access_token;
              if (!token) { toast.error("Sessione scaduta"); setRecalcing(false); return; }
              const res = await fetch('/api/bookings/recalc-costs', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
              });
              const data = await res.json();
              if (res.ok) { toast.success(data.message); fetchMetrics(); }
              else { toast.error(data.error || "Errore"); }
            } catch { toast.error("Errore ricalcolo"); }
            finally { setRecalcing(false); }
          }}
          disabled={recalcing}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${recalcing ? 'animate-spin' : ''}`} />
          {recalcing ? 'Ricalcolo...' : 'Ricalcola Costi'}
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Ricavi YTD</span>
            <Euro className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">{formatCurrency(metrics.ytdRev)}</div>
            <div className={`text-xs font-bold mt-1 inline-flex items-center gap-1 ${metrics.revDiff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {metrics.revDiff >= 0 ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
              {formatPercent(Math.abs(metrics.revDiff))} vs a.p.
            </div>
          </div>
        </div>

        <button onClick={() => setCostModal(metrics.costBreakdown)} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between hover:bg-gray-100 transition cursor-pointer text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Costi YTD</span>
            <Euro className="w-4 h-4 text-rose-500" />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">{formatCurrency(metrics.ytdCost)}</div>
            <div className="text-xs font-medium text-gray-500 mt-1">Clicca per dettaglio →</div>
          </div>
        </button>

        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Utile YTD</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">{formatCurrency(metrics.ytdProfit)}</div>
            <div className={`text-xs font-bold mt-1 inline-flex items-center gap-1 ${metrics.ytdProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>Ricavi - Costi</div>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Margine YTD</span>
            <TrendingUp className={`w-4 h-4 ${metrics.ytdMargin >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">
              <span className={metrics.ytdMargin >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatPercent(metrics.ytdMargin)}</span>
            </div>
            <div className={`text-xs font-bold mt-1 inline-flex items-center gap-1 ${metrics.ytdMargin >= metrics.prevMargin ? 'text-emerald-600' : 'text-red-500'}`}>
              {metrics.ytdMargin >= metrics.prevMargin ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
              vs a.p. {formatPercent(metrics.prevMargin)}
            </div>
          </div>
        </div>
      </div>

      {costModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold tracking-tight text-gray-900">Dettaglio Costi YTD</h3>
              <button onClick={() => setCostModal(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-700"><Briefcase className="w-4 h-4 text-amber-500" /> Staff</div>
                <span className="font-bold">{formatCurrency(costModal.staff)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-700"><Wifi className="w-4 h-4 text-orange-500" /> Servizi Extra</div>
                <span className="font-bold">{formatCurrency(costModal.services)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-700"><Percent className="w-4 h-4 text-purple-500" /> Commissioni Portali</div>
                <span className="font-bold">{formatCurrency(costModal.commissions)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-700"><Receipt className="w-4 h-4 text-indigo-500" /> Tasse Portale</div>
                <span className="font-bold">{formatCurrency(costModal.taxes)}</span>
              </div>
              <div className="flex justify-between items-center py-3 text-base font-bold text-gray-900">
                <span>Totale Costi</span>
                <span className="text-rose-600">{formatCurrency(costModal.staff + costModal.services + costModal.commissions + costModal.taxes)}</span>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 flex justify-end rounded-b-2xl border-t border-gray-100">
              <button onClick={() => setCostModal(null)} className="px-5 py-2.5 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-xl font-bold transition">Chiudi</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
