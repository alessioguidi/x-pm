"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { TrendingUp, TrendingDown, CalendarDays, Home, BellRing, CheckSquare, Clock, Activity } from "lucide-react";
import { formatPercent } from "@/lib/format";

export default function ActivitiesWidget() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);

    const today = new Date();
    const currentYear = today.getFullYear();
    const todayISO = today.toISOString().split('T')[0];

    const { data: bookings } = await supabase.from('bookings').select('*')
      .gte('check_in_date', `${currentYear - 1}-01-01`);

    const ytdCurrent = bookings?.filter(b => b.check_in_date.startsWith(currentYear.toString())) || [];
    const ytdPrev = bookings?.filter(b => b.check_in_date.startsWith((currentYear - 1).toString())) || [];
    const countDiff = ytdPrev.length > 0 ? ((ytdCurrent.length - ytdPrev.length) / ytdPrev.length) * 100 : 100;

    const activitiesToday = bookings?.filter(b => b.check_in_date === todayISO || b.check_out_date === todayISO) || [];
    const overdue = bookings?.filter(b => b.check_out_date < todayISO && b.status !== 'completed' && b.status !== 'cancelled') || [];
    const activeToday = bookings?.filter(b => b.check_in_date <= todayISO && b.check_out_date >= todayISO && b.status === 'confirmed')?.length || 0;
    const pending = bookings?.filter(b => b.status === 'pending')?.length || 0;

    const { count: totalProperties } = await supabase.from('properties').select('*', { count: 'exact', head: true }).eq('is_active', true);

    setMetrics({
      ytdCount: ytdCurrent.length,
      countDiff,
      activitiesTodayCount: activitiesToday.length,
      overdueCount: overdue.length,
      pendingCount: pending,
      activeToday,
      totalProperties: totalProperties || 0,
    });
    setLoading(false);
  };

  if (loading || !metrics) {
    return <div className="p-10 flex justify-center animate-pulse"><div className="h-4 w-24 bg-gray-200 rounded"></div></div>;
  }

  const occPct = metrics.totalProperties > 0 ? Math.round((metrics.activeToday / metrics.totalProperties) * 100) : 0;

  return (
    <div className="p-5 h-full">
      <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
        <Activity className="w-5 h-5 text-blue-600" /> Attività & Occupazione
      </h3>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase">Prenot. YTD</span>
            <CalendarDays className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900">{metrics.ytdCount}</div>
            <div className={`text-xs font-bold mt-1 inline-flex items-center gap-1 ${metrics.countDiff >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {metrics.countDiff >= 0 ? <TrendingUp className="w-3 h-3"/> : <TrendingDown className="w-3 h-3"/>}
              {formatPercent(Math.abs(metrics.countDiff))} vs a.p.
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
            <div className="text-2xl font-black text-gray-900 tracking-tighter">
              {metrics.activeToday}
              <span className="text-sm font-medium text-gray-400"> / {metrics.totalProperties}</span>
            </div>
            <div className="text-xs font-bold text-purple-600 mt-1 inline-flex items-center gap-1">
              Oggi: {formatPercent(occPct)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
