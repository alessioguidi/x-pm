"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { ChevronLeft, ChevronRight, Loader2, CalendarDays, X, Save, MousePointerClick, Layers } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, parseISO, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";
import toast from "react-hot-toast";
import Link from "next/link";

export default function CalendarGridPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("lastCalendarPropertyId") || "";
    return "";
  });
  const [currentProperty, setCurrentProperty] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [overrides, setOverrides] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Sidebar state: array di date
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [sidePrice, setSidePrice] = useState("");
  const [sideMinStay, setSideMinStay] = useState("");
  const [sideMaxStay, setSideMaxStay] = useState("");
  const [sideBlocked, setSideBlocked] = useState<boolean | null>(null);
  const [sideNoIn, setSideNoIn] = useState<boolean | null>(null);
  const [sideNoOut, setSideNoOut] = useState<boolean | null>(null);
  const [savingSide, setSavingSide] = useState(false);

  const [showDeals, setShowDeals] = useState(false);

  // Stop dragging quando il mouse si alza ovunque nello schermo
  useEffect(() => {
    const handleMouseUpGlobal = () => setIsDragging(false);
    window.addEventListener("mouseup", handleMouseUpGlobal);
    return () => window.removeEventListener("mouseup", handleMouseUpGlobal);
  }, []);

  // Fetch properties on mount
  useEffect(() => {
    async function fetchProperties() {
      const { data } = await supabase.from("properties").select("id, name, base_price_per_night, max_guests").order("name");
      if (data && data.length > 0) {
        setProperties(data);
        const saved = localStorage.getItem("lastCalendarPropertyId");
        if (saved && data.some(p => p.id === saved)) {
          setSelectedPropertyId(saved);
        } else {
          setSelectedPropertyId(data[0].id);
        }
      }
    }
    fetchProperties();
  }, []);

  const fetchData = async () => {
    if (!selectedPropertyId) return;
    setLoading(true);
    
    const { data: propData } = await supabase
      .from("properties")
      .select("*")
      .eq("id", selectedPropertyId)
      .single();
    setCurrentProperty(propData);

    const start = format(startOfMonth(currentDate), "yyyy-MM-dd");
    const end = format(endOfMonth(currentDate), "yyyy-MM-dd");

    const { data: overridesData } = await supabase
      .from("calendar_overrides")
      .select("*")
      .eq("property_id", selectedPropertyId)
      .gte("date", start)
      .lte("date", end);

    const validStatuses = showDeals ? ['pending', 'confirmed', 'lead_new', 'lead_qualified', 'quote_sent', 'negotiation'] : ['pending', 'confirmed'];

    const { data: bookingsData } = await supabase
      .from("bookings")
      .select("*")
      .eq("property_id", selectedPropertyId)
      .in("status", validStatuses)
      .gte("check_out_date", start)
      .lte("check_in_date", end);

    setOverrides(overridesData || []);
    setBookings(bookingsData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPropertyId, currentDate, showDeals]);

  // Persisti ultimo immobile selezionato
  useEffect(() => {
    if (selectedPropertyId) localStorage.setItem("lastCalendarPropertyId", selectedPropertyId);
  }, [selectedPropertyId]);

  const nextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1));
    setSelectedDates([]);
  };
  const prevMonth = () => {
    setCurrentDate(subMonths(currentDate, 1));
    setSelectedDates([]);
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate)
  });

  // ---- Mouse Event Handlers per DRAG e MULTISELEZIONE ----
  const handleMouseDown = (day: Date, e: React.MouseEvent) => {
    setIsDragging(true);
    // Se premuto CTRL o CMD, aggiungiamo o rimuoviamo dal set
    if (e.ctrlKey || e.metaKey) {
      const isAlreadySelected = selectedDates.some(d => isSameDay(d, day));
      if (isAlreadySelected) {
        setSelectedDates(prev => prev.filter(d => !isSameDay(d, day)));
      } else {
        setSelectedDates(prev => [...prev, day]);
      }
    } else {
      // Click normale: resetta le date e inizia da questo
      setSelectedDates([day]);
    }
  };

  const handleMouseEnter = (day: Date) => {
    if (isDragging) {
      setSelectedDates(prev => {
        // Se c'è già, non duplicare
        if (prev.some(d => isSameDay(d, day))) return prev;
        return [...prev, day];
      });
    }
  };

  // Compiliamo i campi se ce n'è SOLO UNA di data selezionata, altrimenti campi neutri per modifica bulk
  useEffect(() => {
    if (selectedDates.length === 1) {
      const day = selectedDates[0];
      const ovr = overrides.find(o => isSameDay(parseISO(o.date), day));
      if (ovr) {
        setSidePrice(ovr.price_override !== null && ovr.price_override !== undefined ? String(ovr.price_override) : "");
        setSideMinStay(ovr.min_stay !== null && ovr.min_stay !== undefined ? String(ovr.min_stay) : "");
        setSideMaxStay(ovr.max_stay !== null && ovr.max_stay !== undefined ? String(ovr.max_stay) : "");
        setSideBlocked(ovr.is_blocked ?? null);
        setSideNoIn(ovr.closed_to_arrival ?? null);
        setSideNoOut(ovr.closed_to_departure ?? null);
      } else {
        // Default property params
        setSidePrice("");
        setSideMinStay("");
        setSideMaxStay("");
        setSideBlocked(null);
        setSideNoIn(null);
        setSideNoOut(null);
      }
    } else if (selectedDates.length > 1) {
      // Multipla: tutti neutri — solo i campi compilati verranno applicati
      setSidePrice("");
      setSideMinStay("");
      setSideMaxStay("");
      setSideBlocked(null);
      setSideNoIn(null);
      setSideNoOut(null);
    }
  }, [selectedDates, overrides]);


  const saveMultipleDays = async () => {
    if (selectedDates.length === 0 || !selectedPropertyId) return;
    setSavingSide(true);
    try {
      // Prepara l'array di oggetti UPSERT per tutti i giorni
      const updates = selectedDates.map(day => {
        const record: Record<string, unknown> = {
          property_id: selectedPropertyId,
          date: format(day, "yyyy-MM-dd"),
        };
        // Solo i campi compilati (non null/empty) vengono applicati
        if (sideBlocked !== null) record.is_blocked = sideBlocked;
        if (sideNoIn !== null) record.closed_to_arrival = sideNoIn;
        if (sideNoOut !== null) record.closed_to_departure = sideNoOut;
        if (sidePrice !== "") record.price_override = Number(sidePrice);
        if (sideMinStay !== "") record.min_stay = Number(sideMinStay);
        if (sideMaxStay !== "") record.max_stay = Number(sideMaxStay);
        return record;
      });

      const { error } = await supabase.from('calendar_overrides').upsert(updates, { onConflict: 'property_id, date' });
      if (error) throw error;
      
      toast.success(`Salvato con successo per ${selectedDates.length} ${selectedDates.length === 1 ? 'giorno' : 'giorni'}!`);
      // Riavvia il fetching dei dati griglia
      fetchData(); 
    } catch(e) {
      toast.error("Errore salvataggio multiplo!");
      console.error(e);
    } finally {
      setSavingSide(false);
    }
  };

  const isDaySelected = (day: Date) => selectedDates.some(d => isSameDay(d, day));
  
  const getBookingForDay = (day: Date) => {
    return bookings.find(b => {
      const chin = parseISO(b.check_in_date);
      const chout = parseISO(b.check_out_date);
      // La notte è occupata dal check-in fino alla notte prima del check-out
      return day >= chin && day < chout;
    });
  };

  const sortedDates = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-6rem)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 mt-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 flex items-center">
          <CalendarDays className="mr-2 md:mr-3 w-6 h-6 md:w-8 md:h-8 text-blue-600" />
          Calendario
        </h1>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
             <select 
               className="w-full sm:w-auto appearance-none border-gray-300 border-2 rounded-xl p-2.5 pr-10 text-sm font-bold text-gray-900 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 bg-white shadow-sm transition-all"
               value={selectedPropertyId}
               onChange={(e) => {
                 setSelectedPropertyId(e.target.value);
                 setSelectedDates([]);
               }}
             >
               {properties.map(p => (
                 <option key={p.id} value={p.id}>{p.name}</option>
               ))}
             </select>
             <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                 <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
             </div>
          </div>

          {selectedPropertyId && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 bg-white px-3 py-2.5 rounded-xl border-2 border-gray-100 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors">
                 <input 
                    type="checkbox" 
                    checked={showDeals} 
                    onChange={e => setShowDeals(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-600"
                 />
                 Includi Trattative
              </label>

              <Link 
                href={`/calendar/bulk?propertyId=${selectedPropertyId}`} 
                className="flex items-center justify-center px-4 py-3 bg-blue-50 text-blue-700 text-sm font-bold rounded-xl hover:bg-blue-100 transition-colors border-2 border-blue-100 shadow-sm"
              >
                <Layers className="w-4 h-4 mr-2" />
                Azioni Massive
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 gap-6 min-h-0 overflow-hidden">
        
        {/* Griglia Calendario */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col min-w-0 select-none">
          <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
            <button onClick={prevMonth} className="px-3 md:px-4 py-3 border-2 border-gray-200 rounded-lg hover:bg-white bg-white shadow-sm flex items-center text-sm font-bold text-gray-700 transition-all active:scale-95">
              <ChevronLeft className="w-4 h-4 md:mr-1" /> <span className="hidden md:inline">Prec</span>
            </button>
            <div className="flex flex-col items-center">
              <h2 className="text-lg md:text-xl font-black capitalize text-gray-900 leading-tight">
                {format(currentDate, "MMMM yyyy", { locale: it })}
              </h2>
              <span className="hidden md:block text-[11px] font-medium text-gray-500 mt-1">Trascina per selezione multipla, o usa CTRL+Click</span>
            </div>
            <button onClick={nextMonth} className="px-3 md:px-4 py-3 border-2 border-gray-200 rounded-lg hover:bg-white bg-white shadow-sm flex items-center text-sm font-bold text-gray-700 transition-all active:scale-95">
              <span className="hidden md:inline">Pros</span> <ChevronRight className="w-4 h-4 md:ml-1" />
            </button>
          </div>

          <div className="overflow-x-auto flex-1 pb-4">
            {loading ? (
              <div className="flex justify-center items-center h-64 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead>
                  <tr>
                    <th className="px-4 py-3 bg-gray-100 border-b border-r text-gray-600 font-medium sticky left-0 z-10 w-48 min-w-[200px]">
                      Impostazioni
                    </th>
                    {daysInMonth.map((day, i) => {
                      const selected = isDaySelected(day);
                      return (
                        <th 
                          key={i} 
                          onMouseDown={(e) => handleMouseDown(day, e)}
                          onMouseEnter={() => handleMouseEnter(day)}
                          className={`px-2 py-3 border-b border-r text-center min-w-[64px] cursor-crosshair transition-colors select-none pt-4 ${selected ? 'bg-blue-600 text-white' : 'bg-gray-50 hover:bg-gray-200 group'}`}
                        >
                          <div className={`text-xs ${selected ? 'text-blue-100' : 'text-gray-500 group-hover:text-gray-700 pointer-events-none'}`}>{format(day, "EE", { locale: it })}</div>
                          <div className={`text-xl font-bold ${selected ? 'text-white' : 'text-gray-900 group-hover:text-gray-900 pointer-events-none'}`}>{format(day, "d")}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* PREZZO */}
                  <tr>
                    <td className="px-4 py-3 bg-white border-b border-r text-gray-700 font-medium sticky left-0 z-10">
                      Prezzo Notte (€)
                    </td>
                    {daysInMonth.map((day, i) => {
                      const selected = isDaySelected(day);
                      const ovr = overrides.find(o => isSameDay(parseISO(o.date), day));
                      const price = ovr?.price_override ?? currentProperty?.base_price_per_night;
                      const isCustom = ovr && ovr.price_override !== null;
                      return (
                        <td 
                          key={i} 
                          onMouseDown={(e) => handleMouseDown(day, e)}
                          onMouseEnter={() => handleMouseEnter(day)}
                          className={`px-2 py-4 border-b border-r text-center text-[15px] font-bold cursor-crosshair transition-colors ${selected ? 'bg-blue-50' : (isCustom ? 'text-emerald-700 bg-emerald-50/50' : 'text-gray-700 hover:bg-gray-50')}`}
                        >
                          {price}
                        </td>
                      );
                    })}
                  </tr>

                  {/* STATO DISPONIBILITA */}
                  <tr>
                    <td className="px-4 py-3 bg-white border-b border-r text-gray-700 font-medium sticky left-0 z-10">
                      Stato
                    </td>
                    {daysInMonth.map((day, i) => {
                      const selected = isDaySelected(day);
                      const ovr = overrides.find(o => isSameDay(parseISO(o.date), day));
                      const booking = getBookingForDay(day);
                      const isBlocked = ovr?.is_blocked;
                      return (
                        <td 
                          key={i} 
                          onMouseDown={(e) => {
                            if (booking) {
                              router.push(`/bookings/${booking.id}`);
                              return;
                            }
                            handleMouseDown(day, e);
                          }}
                          onMouseEnter={() => {
                            if (booking) return;
                            handleMouseEnter(day);
                          }}
                          className={`px-2 py-3 border-b border-r text-center ${booking ? 'cursor-pointer' : 'cursor-crosshair'} ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        >
                          {booking ? (() => {
                            const isDeal = ['lead_new', 'lead_qualified', 'quote_sent', 'negotiation'].includes(booking.status);
                            const isPending = booking.status === 'pending';
                            
                            let colorClass = 'text-blue-900 bg-blue-100 border-blue-200';
                            let label = 'Prenotato';
                            if (isPending) {
                                colorClass = 'text-amber-900 bg-amber-100 border-amber-200';
                                label = 'In Attesa';
                            } else if (isDeal) {
                                colorClass = 'text-purple-900 bg-purple-100 border-purple-200';
                                label = 'Trattativa';
                            }

  return (
                              <span className={`inline-flex flex-col w-[68px] overflow-hidden items-center justify-center p-1 text-[9px] uppercase tracking-wider font-bold rounded-lg shrink-0 border ${colorClass}`}>
                                <span className="truncate w-full text-center">{label}</span>
                                <span className="truncate w-full text-center opacity-80">{booking.guest_name}</span>
                              </span>
                            );
                          })() : isBlocked ? (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold text-red-700 bg-red-100 rounded-lg shrink-0">Chiuso</span>
                          ) : (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold text-emerald-700 bg-emerald-100 rounded-lg shrink-0">Aperto</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* MIN / MAX STAY */}
                  <tr>
                    <td className="px-4 py-4 bg-white border-b border-r text-gray-700 font-medium sticky left-0 z-10">
                      Restrizioni (Regole)
                    </td>
                    {daysInMonth.map((day, i) => {
                      const selected = isDaySelected(day);
                      const ovr = overrides.find(o => isSameDay(parseISO(o.date), day));
                      const noArr = ovr?.closed_to_arrival;
                      const noDep = ovr?.closed_to_departure;
                      const hasRule = ovr?.min_stay || ovr?.max_stay;
                      
                      return (
                        <td 
                          key={i} 
                          onMouseDown={(e) => handleMouseDown(day, e)}
                          onMouseEnter={() => handleMouseEnter(day)}
                          className={`px-1 py-2 border-b border-r text-center cursor-crosshair ${selected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                        >
                          <div className="flex flex-col gap-1 items-center justify-center pointer-events-none">
                            {hasRule && (
                              <div className="text-[10px] font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded leading-none">
                                {ovr.min_stay ? `Min ${ovr.min_stay}` : ''} {ovr.max_stay ? `Max ${ovr.max_stay}` : ''}
                              </div>
                            )}
                            {noArr && <div className="text-[10px] font-bold text-orange-800 bg-orange-100 px-1.5 py-0.5 rounded leading-none">No In</div>}
                            {noDep && <div className="text-[10px] font-bold text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded leading-none">No Out</div>}
                            {!hasRule && !noArr && !noDep && <span className="text-gray-300">—</span>}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Sidebar Impostazioni Giorno/Gruppo Singolo */}
        {selectedDates.length > 0 && (
          <div className="w-full md:w-[320px] md:shrink-0 bg-white border border-gray-200 rounded-xl shadow-lg flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-200">
            <div className={`px-5 py-4 border-b border-gray-100 ${selectedDates.length > 1 ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white' : 'bg-gradient-to-r from-blue-50 to-white'}`}>
              <div className="flex items-center justify-between">
                <h3 className={`font-bold ${selectedDates.length > 1 ? 'text-white' : 'text-gray-900'} flex items-center`}>
                  {selectedDates.length > 1 && <MousePointerClick className="w-4 h-4 mr-2 shrink-0" />}
                  {selectedDates.length > 1 ? "Modifica Massiva" : "Modifica Data"}
                </h3>
                <button onClick={() => setSelectedDates([])} className={`p-1.5 rounded-full transition shrink-0 ${selectedDates.length > 1 ? 'text-blue-100 hover:text-white hover:bg-blue-600' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {selectedDates.length >= 1 && (
                  <>
                    <input
                      type="date"
                      value={format(sortedDates[0], "yyyy-MM-dd")}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const newStart = parseISO(e.target.value);
                        const oldEnd = sortedDates[sortedDates.length - 1];
                        const from = newStart <= oldEnd ? newStart : oldEnd;
                        const to = newStart <= oldEnd ? oldEnd : newStart;
                        if (differenceInDays(to, from) > 366) { toast.error("Intervallo massimo 366 giorni"); return; }
                        const days = eachDayOfInterval({ start: from, end: to });
                        setSelectedDates(days);
                      }}
                      className={`text-xs font-bold rounded px-2 py-1 w-[110px] border ${selectedDates.length > 1 ? 'bg-blue-700/30 text-white border-blue-400/50' : 'bg-white text-gray-700 border-gray-300'}`}
                    />
                    <span className={`text-xs font-bold ${selectedDates.length > 1 ? 'text-blue-200' : 'text-gray-400'}`}>→</span>
                    <input
                      type="date"
                      value={format(sortedDates[sortedDates.length - 1], "yyyy-MM-dd")}
                      onChange={(e) => {
                        if (!e.target.value) return;
                        const newEnd = parseISO(e.target.value);
                        const oldStart = sortedDates[0];
                        const from = oldStart <= newEnd ? oldStart : newEnd;
                        const to = oldStart <= newEnd ? newEnd : oldStart;
                        if (differenceInDays(to, from) > 366) { toast.error("Intervallo massimo 366 giorni"); return; }
                        const days = eachDayOfInterval({ start: from, end: to });
                        setSelectedDates(days);
                      }}
                      className={`text-xs font-bold rounded px-2 py-1 w-[110px] border ${selectedDates.length > 1 ? 'bg-blue-700/30 text-white border-blue-400/50' : 'bg-white text-gray-700 border-gray-300'}`}
                    />
                    <span className={`text-xs font-medium shrink-0 ${selectedDates.length > 1 ? 'text-blue-200' : 'text-gray-400'}`}>({selectedDates.length})</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              
              {/* Disponibilità */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 block">Disponibilità In Blocco</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSideBlocked(sideBlocked === false ? null : false)}
                    className={`flex-1 py-2 text-sm font-bold border rounded-lg transition-colors ${sideBlocked === false ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500' : sideBlocked === true ? 'bg-white border-gray-200 text-gray-400' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {sideBlocked === null && <span className="inline-block mr-1 text-gray-400">—</span>}
                    Disponibile
                  </button>
                  <button 
                    onClick={() => setSideBlocked(sideBlocked === true ? null : true)}
                    className={`flex-1 py-2 text-sm font-bold border rounded-lg transition-colors ${sideBlocked === true ? 'bg-red-50 border-red-500 text-red-700 ring-1 ring-red-500' : sideBlocked === false ? 'bg-white border-gray-200 text-gray-400' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {sideBlocked === null && <span className="inline-block mr-1 text-gray-400">—</span>}
                    Bloccato
                  </button>
                </div>
                {sideBlocked === null && <p className="text-[11px] text-gray-400 mt-1">Nessuna modifica (click per impostare)</p>}
              </div>

              <div className="h-px bg-gray-100 w-full" />

              {/* Prezzo */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">Prezzo Giornaliero</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500 font-medium">€</div>
                  <input 
                    type="number"
                    value={sidePrice}
                    onChange={(e) => setSidePrice(e.target.value)}
                    placeholder={selectedDates.length > 1 ? "Inserisci prezzo per tutti" : `Prezzo base: ${currentProperty?.base_price_per_night || 0}`}
                    className="pl-8 w-full border-gray-300 border rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium"
                  />
                </div>
                {selectedDates.length === 1 && (
                  <p className="text-[11px] text-gray-500 mt-1.5 leading-tight">Lascia vuoto per ripristinare il prezzo standard.</p>
                )}
              </div>

              <div className="h-px bg-gray-100 w-full" />

              {/* Regole/Restrizioni */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 block">Regole di Soggiorno</label>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Min. Notti</label>
                    <input 
                      type="number" 
                      value={sideMinStay} onChange={e => setSideMinStay(e.target.value)}
                      placeholder="Nessuno" className="w-full border border-gray-300 rounded p-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-1">Max. Notti</label>
                    <input 
                      type="number" 
                      value={sideMaxStay} onChange={e => setSideMaxStay(e.target.value)}
                      placeholder="Nessuno" className="w-full border border-gray-300 rounded p-2 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-3 mt-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSideNoIn(sideNoIn === true ? null : sideNoIn === false ? true : false)}
                      className={`h-5 w-5 flex items-center justify-center border-2 rounded transition-colors shrink-0 ${sideNoIn === true ? 'bg-blue-600 border-blue-600 text-white' : sideNoIn === false ? 'bg-red-100 border-red-400 text-red-600' : 'border-gray-300 bg-white text-gray-400'}`}
                    >
                      {sideNoIn === true && <span className="text-xs font-bold">✓</span>}
                      {sideNoIn === false && <span className="text-xs font-bold">✕</span>}
                      {sideNoIn === null && <span className="text-xs">—</span>}
                    </button>
                    <span className="text-sm font-medium text-gray-700">Chiuso all'Arrivo</span>
                    {sideNoIn === null && <span className="text-[10px] text-gray-400">nessuna modifica</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSideNoOut(sideNoOut === true ? null : sideNoOut === false ? true : false)}
                      className={`h-5 w-5 flex items-center justify-center border-2 rounded transition-colors shrink-0 ${sideNoOut === true ? 'bg-blue-600 border-blue-600 text-white' : sideNoOut === false ? 'bg-red-100 border-red-400 text-red-600' : 'border-gray-300 bg-white text-gray-400'}`}
                    >
                      {sideNoOut === true && <span className="text-xs font-bold">✓</span>}
                      {sideNoOut === false && <span className="text-xs font-bold">✕</span>}
                      {sideNoOut === null && <span className="text-xs">—</span>}
                    </button>
                    <span className="text-sm font-medium text-gray-700">Chiuso alla Partenza</span>
                    {sideNoOut === null && <span className="text-[10px] text-gray-400">nessuna modifica</span>}
                  </div>
                </div>
              </div>

            </div>
            
            {/* Azioni */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
              <button 
                onClick={saveMultipleDays}
                disabled={savingSide}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center transition disabled:opacity-50"
              >
                {savingSide ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                {savingSide ? 'Salvataggio...' : `Applica a ${selectedDates.length} ${selectedDates.length === 1 ? 'Giorno' : 'Giorni'}`}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
