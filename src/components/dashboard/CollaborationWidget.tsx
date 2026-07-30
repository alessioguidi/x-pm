"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { MessageSquare, Bell, Calendar as CalendarIcon } from "lucide-react";
import { formatDateStr, formatCurrency } from "@/lib/format";
import Link from "next/link";

export default function CollaborationWidget({ propertyIds = [] }: { propertyIds?: string[] }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotes();
  }, [propertyIds]);

  const fetchNotes = async () => {
    setLoading(true);

    let query = supabase.from('bookings')
       .select('id, check_in_date, staff_notes, properties(name), contacts(first_name, last_name)')
       .not('staff_notes', 'is', null)
       .neq('staff_notes', '')
       .order('created_at', { ascending: false })
       .limit(8);
    if (propertyIds.length > 0) query = query.in('property_id', propertyIds);
    const { data } = await query;

    setNotes(data || []);
    setLoading(false);
  };

  if (loading) {
      return <div className="p-10 flex justify-center animate-pulse"><div className="h-4 w-24 bg-gray-200 rounded"></div></div>;
  }

  return (
      <div className="flex flex-col h-full">
         <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
             <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-indigo-500" /> Note e Notifiche Staff
             </h3>
         </div>

         <div className="flex-1 p-5 overflow-y-auto bg-gray-50/50">
           {notes.length === 0 ? (
               <div className="flex items-center justify-center text-gray-500 text-sm font-medium p-6 bg-white rounded-2xl border border-dashed border-gray-200 h-full">
                   Nessuna nota staff presente sulle prenotazioni recenti.
               </div>
           ) : (
               <div className="space-y-4">
                   {notes.map(b => (
                       <Link key={b.id} href={`/bookings/${b.id}`} className="block bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition group relative overflow-hidden">
                           <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                           <div className="flex justify-between items-start mb-2">
                               <div>
                                   <div className="text-xs font-bold text-indigo-600 uppercase flex items-center gap-1 mb-1">
                                      <Bell className="w-3 h-3" /> Notifica su Prenotazione
                                   </div>
                                   <h4 className="text-sm font-bold text-gray-900">
                                     {b.contacts ? `${b.contacts.first_name} ${b.contacts.last_name || ''}`.trim() : 'Ospite Sconosciuto'}
                                   </h4>
                               </div>
                               <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded">
                                  <CalendarIcon className="w-3 h-3"/> {formatDateStr(b.check_in_date)}
                               </span>
                           </div>
                           <p className="text-sm text-gray-600 italic">"{b.staff_notes}"</p>
                           <div className="mt-3 text-xs font-medium text-gray-400 flex items-center justify-between">
                               <span>Casa: {b.properties?.name}</span>
                               <span className="text-indigo-600 opacity-0 group-hover:opacity-100 transition">Vedi Prenotazione →</span>
                           </div>
                       </Link>
                   ))}
               </div>
           )}
         </div>
      </div>
  );
}
