"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { PlaneLanding, MapPin, CalendarDays, ExternalLink, User } from "lucide-react";
import { formatDateStr, formatCurrency } from "@/lib/format";
import Link from "next/link";

export default function UpcomingArrivalsWidget() {
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArrivals();
  }, []);

  const fetchArrivals = async () => {
    setLoading(true);

    const todayISO = new Date().toISOString().split('T')[0];
    
    const { data } = await supabase.from('bookings')
       .select('id, check_in_date, check_out_date, adults_count, children_count, status, properties(name), contacts(first_name, last_name)')
       .in('status', ['confirmed', 'deposit_paid', 'pending'])
       .gte('check_in_date', todayISO)
       .order('check_in_date', { ascending: true })
       .limit(5);

    setArrivals(data || []);
    setLoading(false);
  };

  if (loading) {
      return <div className="p-10 flex justify-center animate-pulse"><div className="h-4 w-24 bg-gray-200 rounded"></div></div>;
  }

  return (
      <div className="p-5 h-full flex flex-col">
         <div className="flex justify-between items-center mb-6">
             <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <PlaneLanding className="w-5 h-5 text-emerald-600" /> Prossimi Arrivi
             </h3>
             <Link href="/bookings" className="text-xs font-bold text-blue-600 hover:text-blue-800 transition">Vedi Tutti →</Link>
         </div>

         {arrivals.length === 0 ? (
             <div className="flex-1 flex items-center justify-center text-gray-500 text-sm font-medium p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                 Nessun arrivo programmato.
             </div>
         ) : (
             <div className="flex-1 space-y-3">
                 {arrivals.map(b => (
                     <div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition rounded-xl border border-gray-100 group">
                         <div className="flex items-center gap-4">
                             <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold shrink-0">
                                 {new Date(b.check_in_date).getDate()}
                             </div>
                             <div>
                                 <div className="flex items-center gap-2">
                                     <h4 className="text-sm font-bold text-gray-900 uppercase">
                                       {b.contacts ? `${b.contacts.first_name} ${b.contacts.last_name || ''}`.trim() : 'Ospite Sconosciuto'}
                                     </h4>
                                     {b.status === 'pending' && <span className="text-[9px] uppercase font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Da Confermare</span>}
                                     {b.status === 'confirmed' && <span className="text-[9px] uppercase font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">Confermata</span>}
                                 </div>
                                 <div className="flex items-center text-xs text-gray-500 mt-1 gap-3 font-medium">
                                     <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-gray-400"/> {b.properties?.name}</span>
                                     <span className="flex items-center gap-1"><User className="w-3 h-3 text-gray-400"/> {(b.adults_count || 1) + (b.children_count || 0)} Ospiti</span>
                                 </div>
                             </div>
                         </div>
                         <div className="text-right flex flex-col items-end">
                             <span className="text-xs font-bold text-gray-400 flex items-center gap-1 mb-1">
                                <CalendarDays className="w-3 h-3"/> {formatDateStr(b.check_out_date)}
                             </span>
                             <Link href={`/bookings/${b.id}`} className="p-1.5 bg-white text-gray-400 rounded-lg shadow-sm border border-gray-200 hover:text-blue-600 transition opacity-0 group-hover:opacity-100">
                                 <ExternalLink className="w-3 h-3" />
                             </Link>
                         </div>
                     </div>
                 ))}
             </div>
         )}
      </div>
  );
}
