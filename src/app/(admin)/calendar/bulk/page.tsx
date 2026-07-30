"use client";

import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/utils/supabase/client";
import { CalendarDays, Save, CheckCircle2, ArrowLeft } from "lucide-react";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function BulkCalendarUpdateContent() {
  const searchParams = useSearchParams();
  const initPropertyId = searchParams.get("propertyId") || "";

  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Modulo Dati
  const [propertyId, setPropertyId] = useState(initPropertyId);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  // Variabili da aggiornare
  const [priceOverride, setPriceOverride] = useState("");
  const [minStay, setMinStay] = useState("");
  const [maxStay, setMaxStay] = useState("");
  const [isBlocked, setIsBlocked] = useState<boolean | null>(null);
  const [closedToArrival, setClosedToArrival] = useState<boolean | null>(null);
  const [closedToDeparture, setClosedToDeparture] = useState<boolean | null>(null);
  // Giorni della settimana selezionati (0 = Dom, 1 = Lun, ..., 6 = Sab)
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);

  const WEEKDAYS = [
    { id: 1, label: 'Lun' },
    { id: 2, label: 'Mar' },
    { id: 3, label: 'Mer' },
    { id: 4, label: 'Gio' },
    { id: 5, label: 'Ven' },
    { id: 6, label: 'Sab' },
    { id: 0, label: 'Dom' }
  ];

  // Caricamento proprietà all'avvio
  useEffect(() => {
    async function fetchProperties() {
      const { data } = await supabase.from("properties").select("id, name").order("name");
      if (data) setProperties(data);
    }
    fetchProperties();
  }, []);

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId || !dateFrom || !dateTo) {
      alert("Seleziona immobile e un range di date nuziale valido.");
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      // Calcola tutti i giorni compresi nel range
      const days = eachDayOfInterval({
        start: parseISO(dateFrom),
        end: parseISO(dateTo)
      });

      // Prepara l'array di oggetti da inserire/aggiornare nel database
      const updates = days
        .filter(day => selectedDays.includes(day.getDay()))
        .map(day => {
        const updateObject: any = {
          property_id: propertyId,
          date: format(day, "yyyy-MM-dd"),
        };
        
        if (isBlocked !== null) updateObject.is_blocked = isBlocked;
        if (closedToArrival !== null) updateObject.closed_to_arrival = closedToArrival;
        if (closedToDeparture !== null) updateObject.closed_to_departure = closedToDeparture;
        if (priceOverride !== "") updateObject.price_override = Number(priceOverride);
        if (minStay !== "") updateObject.min_stay = Number(minStay);
        if (maxStay !== "") updateObject.max_stay = Number(maxStay);

        return updateObject;
      });

      if (updates.length === 0) {
        alert("Nessun giorno valido trovato per il periodo e giorni della settimana scelti.");
        setLoading(false);
        return;
      }

      // Upsert: aggiorna se esiste già un record per quella data, altrimenti crea
      const { error } = await supabase
        .from('calendar_overrides')
        .upsert(updates, { onConflict: 'property_id, date' });

      if (error) throw error;
      
      setSuccess(true);
      setPriceOverride("");
      setMinStay("");
      setMaxStay("");
      setIsBlocked(null);
      setClosedToArrival(null);
      setClosedToDeparture(null);

    } catch (err) {
      console.error(err);
      alert("Si è verificato un errore durante l'aggiornamento massivo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/calendar" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition mb-2">
        <ArrowLeft className="w-4 h-4 mr-1"/> Torna al Calendario
      </Link>
      <div className="flex items-center space-x-3">
        <CalendarDays className="w-8 h-8 text-blue-600" />
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Aggiornamento Massivo</h1>
      </div>
      
      <p className="text-gray-500">
        Gestisci chiusure, prezzi e regole di permanenza su ampi range di date. Le impostazioni sovrascriveranno quelle di base.
      </p>

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-md flex items-center">
          <CheckCircle2 className="w-5 h-5 mr-2" />
          Calendario aggiornato con successo!
        </div>
      )}

      <form onSubmit={handleBulkUpdate} className="bg-white border border-gray-200 rounded-lg shadow-sm">
        
        {/* Step 1: Selezione Immobile e Date */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-medium text-gray-900 mb-4">1. Seleziona Immobile e Periodo</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Immobile</label>
              <select 
                required
                className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
                value={propertyId}
                onChange={e => setPropertyId(e.target.value)}
              >
                <option value="">-- Seleziona --</option>
                {properties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Dal giorno</label>
              <input 
                required
                type="date" 
                className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Al giorno</label>
              <input 
                required
                type="date" 
                className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                min={dateFrom} // Impedisce di selezionare una data fine minore dell'inizio
              />
            </div>
          </div>
        </div>

        {/* Step 2: Vincoli */}
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">2. Specifica le Regole</h3>
          <p className="text-sm text-gray-500 mb-6">Lascia vuoti i campi monetari e numerici se non vuoi variare i valori base.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700">Prezzo per Notte (€)</label>
              <input 
                type="number" 
                min="0"
                placeholder="Lascia vuoto per base"
                className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-gray-900"
                value={priceOverride}
                onChange={e => setPriceOverride(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Soggiorno Minimo (Notti)</label>
              <input 
                type="number" 
                min="1"
                placeholder="Es. 7"
                className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={minStay}
                onChange={e => setMinStay(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Soggiorno Massimo (Notti)</label>
              <input 
                type="number" 
                min="1"
                placeholder="Es. 30"
                className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={maxStay}
                onChange={e => setMaxStay(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setIsBlocked(isBlocked === true ? null : isBlocked === false ? true : false)}
                className={`h-5 w-5 flex items-center justify-center border-2 rounded transition-colors ${isBlocked === true ? 'bg-blue-600 border-blue-600 text-white' : isBlocked === false ? 'bg-red-100 border-red-400 text-red-600' : 'border-gray-300 bg-white text-gray-400'}`}
              >
                {isBlocked === true && <span className="text-xs font-bold">✓</span>}
                {isBlocked === false && <span className="text-xs font-bold">✕</span>}
                {isBlocked === null && <span className="text-xs">—</span>}
              </button>
              <label onClick={() => setIsBlocked(isBlocked === true ? null : isBlocked === false ? true : false)} className="ml-2 block text-sm text-gray-900 font-medium cursor-pointer">
                Chiuso per Vendita (Blocca intero calendario per queste date)
              </label>
              {isBlocked === null && <span className="ml-2 text-[10px] text-gray-400">nessuna modifica</span>}
            </div>
            
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setClosedToArrival(closedToArrival === true ? null : closedToArrival === false ? true : false)}
                className={`h-5 w-5 flex items-center justify-center border-2 rounded transition-colors ${closedToArrival === true ? 'bg-blue-600 border-blue-600 text-white' : closedToArrival === false ? 'bg-red-100 border-red-400 text-red-600' : 'border-gray-300 bg-white text-gray-400'}`}
              >
                {closedToArrival === true && <span className="text-xs font-bold">✓</span>}
                {closedToArrival === false && <span className="text-xs font-bold">✕</span>}
                {closedToArrival === null && <span className="text-xs">—</span>}
              </button>
              <label onClick={() => setClosedToArrival(closedToArrival === true ? null : closedToArrival === false ? true : false)} className="ml-2 block text-sm text-gray-900 cursor-pointer">
                Chiuso all'Arrivo <span className="text-gray-500 font-normal">(Non si può effettuare Check-in in queste date)</span>
              </label>
              {closedToArrival === null && <span className="ml-2 text-[10px] text-gray-400">nessuna modifica</span>}
            </div>

            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setClosedToDeparture(closedToDeparture === true ? null : closedToDeparture === false ? true : false)}
                className={`h-5 w-5 flex items-center justify-center border-2 rounded transition-colors ${closedToDeparture === true ? 'bg-blue-600 border-blue-600 text-white' : closedToDeparture === false ? 'bg-red-100 border-red-400 text-red-600' : 'border-gray-300 bg-white text-gray-400'}`}
              >
                {closedToDeparture === true && <span className="text-xs font-bold">✓</span>}
                {closedToDeparture === false && <span className="text-xs font-bold">✕</span>}
                {closedToDeparture === null && <span className="text-xs">—</span>}
              </button>
              <label onClick={() => setClosedToDeparture(closedToDeparture === true ? null : closedToDeparture === false ? true : false)} className="ml-2 block text-sm text-gray-900 cursor-pointer">
                Chiuso alla Partenza <span className="text-gray-500 font-normal">(Non si può effettuare Check-out in queste date)</span>
              </label>
              {closedToDeparture === null && <span className="ml-2 text-[10px] text-gray-400">nessuna modifica</span>}
            </div>
          </div>

          <div className="mt-8 border-t border-gray-200 pt-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Applica ESCLUSIVAMENTE in questi giorni della settimana:
            </label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map(day => {
                const isSelected = selectedDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => {
                      if (isSelected && selectedDays.length === 1) return; // avoid unchecking all
                      if (isSelected) {
                        setSelectedDays(selectedDays.filter(d => d !== day.id));
                      } else {
                        setSelectedDays([...selectedDays, day.id]);
                      }
                    }}
                    className={`px-4 py-2 text-sm rounded border transition-colors ${
                      isSelected 
                        ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium shadow-sm' 
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Nessuna modifica (prezzo o restrizione) verrà inviata ai giorni in grigio per il periodo selezionato.
            </p>
          </div>

        </div>

        {/* Step 3: Conferma */}
        <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-red-600 font-medium">
            Attenzione: i valori sovrascriveranno le configurazioni precedenti.
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Elaborazione...' : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Applica Modifiche
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function BulkCalendarUpdatePage() {
  return (
    <Suspense fallback={<div>Caricamento...</div>}>
      <BulkCalendarUpdateContent />
    </Suspense>
  );
}
