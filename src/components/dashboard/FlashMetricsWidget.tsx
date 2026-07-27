"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/utils/supabase/client";
import { TrendingUp, TrendingDown, Users, CalendarDays, Euro, Home, BellRing, CheckSquare, Clock, X, Percent, Briefcase, Wifi, Receipt, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

export default function FlashMetricsWidget() {
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
    const todayISO = today.toISOString().split('T')[0];
    
    // Fetch bookings for current year and previous year for YTD comparisons
    const { data: bookings } = await supabase.from('bookings').select('*, properties(name)')
       .gte('check_in_date', `${currentYear - 1}-01-01`);

    const ytdCurrentBookings = bookings?.filter(b => b.check_in_date.startsWith(currentYear.toString())) || [];
    const ytdPrevBookings = bookings?.filter(b => b.check_in_date.startsWith((currentYear-1).toString())) || [];

    const ytdCurrentRev = ytdCurrentBookings.reduce((sum, b) => sum + (b.total_price || 0), 0);
    const ytdPrevRev = ytdPrevBookings.reduce((sum, b) => sum + (b.total_price || 0), 0);
    const revDiff = ytdPrevRev > 0 ? ((ytdCurrentRev - ytdPrevRev) / ytdPrevRev) * 100 : 100;

    const ytdCurrentCost = ytdCurrentBookings.reduce((sum, b) => sum + Number(b.staff_cost || 0) + Number(b.services_cost || 0) + Number(b.commission_amount || 0) + Number(b.tax_amount || 0), 0);
    const ytdPrevCost = ytdPrevBookings.reduce((sum, b) => sum + Number(b.staff_cost || 0) + Number(b.services_cost || 0) + Number(b.commission_amount || 0) + Number(b.tax_amount || 0), 0);

    const costBreakdown = {
      staff: ytdCurrentBookings.reduce((s, b) => s + Number(b.staff_cost || 0), 0),
      services: ytdCurrentBookings.reduce((s, b) => s + Number(b.services_cost || 0), 0),
      commissions: ytdCurrentBookings.reduce((s, b) => s + Number(b.commission_amount || 0), 0),
      taxes: ytdCurrentBookings.reduce((s, b) => s + Number(b.tax_amount || 0), 0),
    };
    const ytdCurrentProfit = ytdCurrentRev - ytdCurrentCost;
    const ytdPrevProfit = ytdPrevRev - ytdPrevCost;
    const ytdMargin = ytdCurrentRev > 0 ? (ytdCurrentProfit / ytdCurrentRev) * 100 : 0;
    const prevMargin = ytdPrevRev > 0 ? (ytdPrevProfit / ytdPrevRev) * 100 : 0;

    const countDiff = ytdPrevBookings.length > 0 ? ((ytdCurrentBookings.length - ytdPrevBookings.length) / ytdPrevBookings.length) * 100 : 100;

    // Attività Oggi = Bookings starting or ending today
    const activitiesToday = bookings?.filter(b => b.check_in_date === todayISO || b.check_out_date === todayISO) || [];
    
    // Attività Scadute = Bookings ending before today but without explicit status advancement
    const overdueActivities = bookings?.filter(b => b.check_out_date < todayISO && b.status !== 'completed' && b.status !== 'cancelled') || [];

    // Occupazione = active bookings today / total active properties
    const activeToday = bookings?.filter(b => b.check_in_date <= todayISO && b.check_out_date >= todayISO && b.status === 'confirmed')?.length || 0;
    
    // Da Confermare = Bookings with pending status
    const pendingBookingsCount = bookings?.filter(b => b.status === 'pending')?.length || 0;

    const { count: totalProperties } = await supabase.from('properties').select('*', { count: 'exact', head: true }).eq('is_active', true);

    setMetrics({
        ytdRev: ytdCurrentRev,
        revDiff: revDiff.toFixed(1),
        ytdCount: ytdCurrentBookings.length,
        countDiff: countDiff.toFixed(1),
        activitiesTodayCount: activitiesToday.length,
        overdueCount: overdueActivities.length,
        pendingCount: pendingBookingsCount,
        occupiedStr: `${activeToday} / ${totalProperties || 0} (${totalProperties ? Math.round((activeToday/totalProperties)*100) : 0}%)`,
        ytdCost: ytdCurrentCost,
        ytdProfit: ytdCurrentProfit,
        ytdMargin: ytdMargin.toFixed(1),
        prevMargin: prevMargin.toFixed(1),
        costBreakdown
    });
    setLoading(false);
  };

  if (loading || !metrics) {
      return <div className="p-10 flex justify-center animate-pulse"><div className="h-4 w-24 bg-gray-200 rounded"></div></div>;
  }

  return (
      <div className="p-5 h-full">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" /> Metriche Flash
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
                  if (res.ok) {
                    toast.success(data.message);
                    fetchMetrics();
                  } else {
                    toast.error(data.error || "Errore");
                  }
                } catch (e) {
                  toast.error("Errore ricalcolo");
                } finally {
                  setRecalcing(false);
                }
              }}
              disabled={recalcing}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
              title="Ricalcola costi su tutte le prenotazioni"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${recalcing ? 'animate-spin' : ''}`} />
              {recalcing ? 'Ricalcolo...' : 'Ricalcola Costi'}
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-9 gap-3">
            
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between">
               <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">Ricavi YTD</span>
                  <Euro className="w-4 h-4 text-emerald-500" />
               </div>
               <div>
                  <div className="text-2xl font-black text-gray-900">€{metrics.ytdRev.toLocaleString()}</div>
                  <div className={`text-xs font-bold mt-1 inline-flex items-center gap-1 ${parseFloat(metrics.revDiff) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                     {parseFloat(metrics.revDiff) >= 0 ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                     {Math.abs(parseFloat(metrics.revDiff))}% vs a.p.
                  </div>
               </div>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between">
               <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">Prenot. YTD</span>
                  <CalendarDays className="w-4 h-4 text-blue-500" />
               </div>
               <div>
                  <div className="text-2xl font-black text-gray-900">{metrics.ytdCount}</div>
                  <div className={`text-xs font-bold mt-1 inline-flex items-center gap-1 ${parseFloat(metrics.countDiff) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                     {parseFloat(metrics.countDiff) >= 0 ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                     {Math.abs(parseFloat(metrics.countDiff))}% vs a.p.
                  </div>
               </div>
            </div>

            <a href="/bookings" className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex flex-col justify-between hover:bg-blue-100 transition cursor-pointer group">
               <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-blue-600 uppercase">Attività Oggi</span>
                  <CheckSquare className="w-4 h-4 text-blue-600 transform group-hover:scale-110 transition" />
               </div>
               <div>
                  <div className="text-2xl font-black text-blue-900">{metrics.activitiesTodayCount}</div>
                  <div className="text-[10px] text-blue-600 mt-1 uppercase font-bold tracking-wider">Vai ai Dettagli →</div>
               </div>
            </a>

            <a href="/bookings?status=attention" className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex flex-col justify-between hover:bg-rose-100 transition cursor-pointer group">
               <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-rose-600 uppercase">Attività Scadute</span>
                  <BellRing className="w-4 h-4 text-rose-600 transform group-hover:scale-110 transition" />
               </div>
               <div>
                  <div className="text-2xl font-black text-rose-900">{metrics.overdueCount}</div>
                  <div className="text-[10px] text-rose-600 mt-1 uppercase font-bold tracking-wider">Richiedono Controllo →</div>
               </div>
            </a>

            <a href="/bookings?status=pending" className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex flex-col justify-between hover:bg-amber-100 transition cursor-pointer group">
               <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-amber-600 uppercase">Da Confermare</span>
                  <Clock className="w-4 h-4 text-amber-600 transform group-hover:scale-110 transition" />
               </div>
               <div>
                  <div className="text-2xl font-black text-amber-900">{metrics.pendingCount}</div>
                  <div className="text-[10px] text-amber-600 mt-1 uppercase font-bold tracking-wider">In Attesa →</div>
               </div>
            </a>

            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between">
               <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">Occupazione</span>
                  <Home className="w-4 h-4 text-purple-500" />
               </div>
               <div>
                  <div className="text-2xl font-black text-gray-900 tracking-tighter">{metrics.occupiedStr.split(' ')[0]} <span className="text-sm font-medium text-gray-400">/ {metrics.occupiedStr.split(' / ')[1] ? metrics.occupiedStr.split(' / ')[1].split(' ')[0] : '0'}</span></div>
                  <div className="text-xs font-bold text-purple-600 mt-1 inline-flex items-center gap-1">
                     Oggi: {metrics.occupiedStr.split('(')[1]?.replace(')', '') || '0%'}
                  </div>
               </div>
            </div>

            <button onClick={() => setCostModal(metrics.costBreakdown)} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between hover:bg-gray-100 transition cursor-pointer text-left">
               <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">Costi YTD</span>
                  <Euro className="w-4 h-4 text-rose-500" />
               </div>
               <div>
                  <div className="text-2xl font-black text-gray-900">€{metrics.ytdCost.toLocaleString()}</div>
                  <div className="text-xs font-medium text-gray-500 mt-1">Clicca per dettaglio →</div>
               </div>
            </button>

            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between">
               <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">Utile YTD</span>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
               </div>
               <div>
                  <div className="text-2xl font-black text-gray-900">{metrics.ytdProfit >= 0 ? '€' : '-€'}{Math.abs(metrics.ytdProfit).toLocaleString()}</div>
                  <div className={`text-xs font-bold mt-1 inline-flex items-center gap-1 ${metrics.ytdProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                     Ricavi - Costi
                  </div>
               </div>
            </div>

            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between">
               <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-500 uppercase">Margine YTD</span>
                  <TrendingUp className={`w-4 h-4 ${parseFloat(metrics.ytdMargin) >= 0 ? 'text-emerald-500' : 'text-red-500'}`} />
               </div>
               <div>
                  <div className="text-2xl font-black text-gray-900">
                     <span className={parseFloat(metrics.ytdMargin) >= 0 ? 'text-emerald-600' : 'text-red-600'}>{metrics.ytdMargin}%</span>
                  </div>
                  <div className={`text-xs font-bold mt-1 inline-flex items-center gap-1 ${parseFloat(metrics.ytdMargin) >= parseFloat(metrics.prevMargin) ? 'text-emerald-600' : 'text-red-500'}`}>
                     {parseFloat(metrics.ytdMargin) >= parseFloat(metrics.prevMargin) ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
                     vs a.p. {metrics.prevMargin}%
                  </div>
               </div>
            </div>

         </div>

         {costModal && createPortal(
           <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
             <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-gray-100">
               <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                 <h3 className="text-xl font-bold tracking-tight text-gray-900">Dettaglio Costi YTD</h3>
                 <button onClick={() => setCostModal(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition">
                   <X className="w-5 h-5" />
                 </button>
               </div>
               <div className="p-6 space-y-4">
                 <div className="flex justify-between items-center py-2 border-b border-gray-100">
                   <div className="flex items-center gap-2 text-sm text-gray-700">
                     <Briefcase className="w-4 h-4 text-amber-500" /> Staff
                   </div>
                   <span className="font-bold">€{costModal.staff.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between items-center py-2 border-b border-gray-100">
                   <div className="flex items-center gap-2 text-sm text-gray-700">
                     <Wifi className="w-4 h-4 text-orange-500" /> Servizi Extra
                   </div>
                   <span className="font-bold">€{costModal.services.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between items-center py-2 border-b border-gray-100">
                   <div className="flex items-center gap-2 text-sm text-gray-700">
                     <Percent className="w-4 h-4 text-purple-500" /> Commissioni Portali
                   </div>
                   <span className="font-bold">€{costModal.commissions.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between items-center py-2 border-b border-gray-100">
                   <div className="flex items-center gap-2 text-sm text-gray-700">
                     <Receipt className="w-4 h-4 text-indigo-500" /> Tasse Portale
                   </div>
                   <span className="font-bold">€{costModal.taxes.toLocaleString()}</span>
                 </div>
                 <div className="flex justify-between items-center py-3 text-base font-bold text-gray-900">
                   <span>Totale Costi</span>
                   <span className="text-rose-600">€{(costModal.staff + costModal.services + costModal.commissions + costModal.taxes).toLocaleString()}</span>
                 </div>
               </div>
               <div className="px-6 py-4 bg-gray-50 flex justify-end rounded-b-2xl border-t border-gray-100">
                 <button onClick={() => setCostModal(null)} className="px-5 py-2.5 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-xl font-bold transition">
                   Chiudi
                 </button>
               </div>
             </div>
           </div>,
           document.body
         )}
      </div>
  );
}
