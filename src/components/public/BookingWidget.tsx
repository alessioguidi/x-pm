"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { eachDayOfInterval, parseISO, subDays, isSameDay, format as formatDate } from "date-fns";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { it } from "date-fns/locale/it";
registerLocale('it', it);

export default function BookingWidget({ property }: { property: any }) {
  const hidePrices = property.hide_prices ?? false;
  const minAdvanceDays = property.min_advance_days ?? 2;
  const minCheckInDate = (() => { const d = new Date(); d.setDate(d.getDate() + minAdvanceDays); d.setHours(0,0,0,0); return d; })();

  const [checkIn, setCheckIn] = useState<string>("");
  const [checkOut, setCheckOut] = useState<string>("");
  const [adults, setAdults] = useState<number>(1);
  const [children, setChildren] = useState<number>(0);
  const [pets, setPets] = useState<number>(0);
  
  const [nights, setNights] = useState<number>(0);
  const [baseTotal, setBaseTotal] = useState<number>(0);
  const [petsTotal, setPetsTotal] = useState<number>(0);
  const [cityTaxTotal, setCityTaxTotal] = useState<number>(0);
  const [grandTotal, setGrandTotal] = useState<number>(0);
  
  const [overrides, setOverrides] = useState<any[]>([]);
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");
  
  // Extra Services State
  const availableExtras = Array.isArray(property.extra_services) ? property.extra_services : [];
  const [selectedExtras, setSelectedExtras] = useState<{id: string, name: string, price: number, qty: number, total: number}[]>([]);
  
  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestNotes, setGuestNotes] = useState("");
  const allowedMethods = property.organizations?.allowed_payment_methods || ["Contante"];
  const [paymentMethod, setPaymentMethod] = useState(allowedMethods[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const fetchAvailability = async () => {
      const [ovrRes, bkRes] = await Promise.all([
        supabase.from('calendar_overrides').select('*').eq('property_id', property.id),
        supabase.from('bookings').select('check_in_date, check_out_date').eq('property_id', property.id).in('status', ['pending', 'confirmed'])
      ]);
      if (ovrRes.data) setOverrides(ovrRes.data);
      if (bkRes.data) setActiveBookings(bkRes.data);
    };
    fetchAvailability();
  }, [property.id]);

  const handleCheckInChange = (val: string) => {
    setCheckIn(val);
    if (checkOut) {
      const dIn = new Date(val);
      const dOut = new Date(checkOut);
      if (dIn >= dOut) setCheckOut("");
    }
  };

  useEffect(() => {
    setErrorMessage("");
    if (checkIn && checkOut) {
      const start = parseISO(checkIn);
      const out = parseISO(checkOut);
      const diffTime = out.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const computedNights = diffDays > 0 ? diffDays : 0;
      
      if (computedNights <= 0) { setNights(0); return; }

      const days = eachDayOfInterval({ start, end: subDays(out, 1) });
      let computedBase = 0;
      let hasError = false;

      const startOvr = overrides.find(o => isSameDay(parseISO(o.date), start));
      if (startOvr?.closed_to_arrival) { setErrorMessage("Data di arrivo non consentita."); hasError = true; }

      const outOvr = overrides.find(o => isSameDay(parseISO(o.date), out));
      if (outOvr?.closed_to_departure) { setErrorMessage("Data di partenza non consentita."); hasError = true; }

      if (startOvr?.min_stay && diffDays < startOvr.min_stay) {
        setErrorMessage(`Soggiorno minimo richiesto: ${startOvr.min_stay} notti.`); hasError = true;
      }
      if (startOvr?.max_stay && diffDays > startOvr.max_stay) {
        setErrorMessage(`Soggiorno massimo: ${startOvr.max_stay} notti.`); hasError = true;
      }

      days.forEach(day => {
        const dTime = day.getTime();
        const isBooked = activeBookings.some(b => {
           const bIn = parseISO(b.check_in_date).getTime();
           const bOut = parseISO(b.check_out_date).getTime();
           return dTime >= bIn && dTime < bOut;
        });
        const ovr = overrides.find(o => isSameDay(parseISO(o.date), day));
        if (isBooked || (ovr && ovr.is_blocked)) {
           setErrorMessage("Alcune date selezionate non sono disponibili."); hasError = true;
        }
        computedBase += (ovr?.price_override ?? property.base_price_per_night);
      });

      if (hasError) { setNights(0); setBaseTotal(0); setPetsTotal(0); setCityTaxTotal(0); setGrandTotal(0); return; }

      setNights(computedNights);
      setBaseTotal(computedBase);

      const computedPets = pets * (property.pet_fee || 0);
      setPetsTotal(computedPets);

      // Tassa di soggiorno: city_tax_per_night × limitato a city_tax_max_nights × adulti
      // NON entra nel totale soggiorno — è separata, pagata in contanti all'arrivo
      const maxN = property.city_tax_max_nights ?? 10;
      const taxableNights = Math.min(computedNights, maxN);
      const computedCityTax = (property.city_tax_per_night || 2) * taxableNights * adults;
      setCityTaxTotal(computedCityTax);

      const extraTotal = selectedExtras.reduce((sum, e) => sum + e.total, 0);
      // grandTotal = solo le voci del soggiorno (NO city tax, caparra, cauzione)
      const total = computedBase + (property.cleaning_fee || 0) + computedPets + extraTotal;
      setGrandTotal(Math.round(total * 100) / 100);
    } else {
      setNights(0); setBaseTotal(0); setPetsTotal(0); setCityTaxTotal(0); setGrandTotal(0);
    }
  }, [checkIn, checkOut, adults, pets, property.base_price_per_night, property.cleaning_fee, property.pet_fee, property.city_tax_per_night, overrides, selectedExtras]);

  const handleExtraChange = (extra: any, isChecked: boolean) => {
    if (isChecked) {
      setSelectedExtras([...selectedExtras, { id: extra.id, name: extra.name, price: extra.price, qty: 1, total: extra.price }]);
    } else {
      setSelectedExtras(selectedExtras.filter(e => e.id !== extra.id));
    }
  };

  const handleExtraQtyChange = (extraId: string, delta: number) => {
    setSelectedExtras(selectedExtras.map(e => {
      if (e.id === extraId) {
        const newQty = Math.max(1, e.qty + delta);
        return { ...e, qty: newQty, total: newQty * e.price };
      }
      return e;
    }));
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: property.organization_id,
          property_id: property.id,
          guest_name: guestName,
          guest_email: guestEmail,
          guest_phone: guestPhone,
          check_in_date: checkIn,
          check_out_date: checkOut,
          nights,
          adults_count: adults,
          children_count: children,
          guests_count: adults + children,
          pets_count: pets,
          base_price: baseTotal,
          city_tax: cityTaxTotal,
          pet_fee: petsTotal,
          total_price: grandTotal,
          extra_services: selectedExtras,
          payment_method: hidePrices ? '' : paymentMethod,
          notes: hidePrices ? guestNotes : "Prenotazione rapida da Marketplace",
          hide_prices: hidePrices
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setIsSuccess(true);
      } else {
        alert("Errore durante la prenotazione: " + data.error);
      }
    } catch (e: any) {
      alert("Errore irreversibile: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const maxGuests = property.max_guests || 10;

  return (
    <div className="sticky top-28 bg-white border border-gray-200 rounded-2xl shadow-xl p-6">
      <div className="mb-6">
        {!hidePrices && nights > 0 ? (
           <>
              <span className="text-xl font-bold text-gray-900 block flex items-baseline gap-2">
                 € {Math.round(baseTotal / nights)} <span className="text-sm font-normal text-gray-500">medi / notte</span>
              </span>
              <span className="text-sm text-gray-500 font-medium">
                 {nights} {nights === 1 ? 'notte' : 'notti'} selezionate
              </span>
           </>
        ) : hidePrices && nights > 0 ? (
           <span className="text-sm text-gray-500 font-medium">
              {nights} {nights === 1 ? 'notte' : 'notti'} selezionate
           </span>
        ) : (
           <h3 className="text-lg font-bold text-gray-900">Seleziona le date</h3>
        )}
      </div>

      <form className="space-y-4">
        {/* Date Selector */}
        <div className="flex border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:border-transparent transition-shadow" style={{ '--tw-ring-color': 'var(--theme-color)' } as React.CSSProperties}>
          <div className="w-1/2 border-r border-gray-300 p-3">
            <label className="block text-[10px] uppercase font-bold text-gray-900">Check-in</label>
            <DatePicker 
              selected={checkIn ? new Date(checkIn) : null}
              onChange={(date: Date | null) => {
                 if (date) handleCheckInChange(formatDate(date, 'yyyy-MM-dd'));
              }}
              dateFormat="dd/MM/yyyy"
              locale="it"
              minDate={minCheckInDate}
              filterDate={(date) => {
                const dTime = date.getTime();
                const isBooked = activeBookings.some(b => dTime >= parseISO(b.check_in_date).getTime() && dTime < parseISO(b.check_out_date).getTime());
                const isOverridden = overrides.some(o => isSameDay(parseISO(o.date), date) && o.is_blocked);
                return !isBooked && !isOverridden;
              }}
              placeholderText="gg/mm/aaaa"
              className="w-full text-sm outline-none bg-transparent text-gray-900 mt-1 cursor-pointer" 
              required 
            />
          </div>
          <div className="w-1/2 p-3">
            <label className="block text-[10px] uppercase font-bold text-gray-900">Check-out</label>
            <DatePicker 
              selected={checkOut ? new Date(checkOut) : null}
              onChange={(date: Date | null) => {
                 if (date) setCheckOut(formatDate(date, 'yyyy-MM-dd'));
                 else setCheckOut("");
              }}
              dateFormat="dd/MM/yyyy"
              locale="it"
              minDate={checkIn ? (() => { const d = parseISO(checkIn); d.setDate(d.getDate() + 1); return d; })() : new Date(minCheckInDate.getTime() + 86400000)}
              maxDate={checkIn ? (
                 activeBookings
                   .map(b => parseISO(b.check_in_date))
                   .filter(d => d.getTime() > parseISO(checkIn).getTime())
                   .sort((a,b) => a.getTime() - b.getTime())[0] || undefined
              ) : undefined}
              filterDate={(date) => {
                const isOverridden = overrides.some(o => isSameDay(parseISO(o.date), date) && o.is_blocked);
                return !isOverridden;
              }}
              disabled={!checkIn}
              placeholderText="gg/mm/aaaa"
              className="w-full text-sm outline-none bg-transparent text-gray-900 mt-1 cursor-pointer pb-2" 
              required 
            />
          </div>
        </div>
        
        {/* Adulti e Bambini */}
        <div className="border border-gray-300 rounded-lg p-3">
          <label className="block text-[10px] uppercase font-bold text-gray-900 mb-2">Composizione Gruppo</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Adulti (≥ {(property.city_tax_child_age || 11) + 1} anni)</label>
              <select
                className="w-full text-sm outline-none bg-gray-50 border border-gray-200 rounded-lg p-2 text-gray-900 cursor-pointer"
                value={adults}
                onChange={(e) => setAdults(Number(e.target.value))}
                required
              >
                {[...Array(maxGuests)].map((_, i) => (
                  <option key={i} value={i + 1}>{i + 1}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Bambini (≤ {property.city_tax_child_age || 11} anni)</label>
              <select
                className="w-full text-sm outline-none bg-gray-50 border border-gray-200 rounded-lg p-2 text-gray-900 cursor-pointer"
                value={children}
                onChange={(e) => setChildren(Number(e.target.value))}
              >
                {[...Array(maxGuests + 1)].map((_, i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Animali */}
        {property.house_rules?.pets_allowed && (
          <div className="border border-gray-300 rounded-lg p-3">
            <label className="block text-[10px] uppercase font-bold text-gray-900">Animali Domestici</label>
            <select 
              className="w-full text-sm outline-none bg-transparent text-gray-900 mt-1 cursor-pointer"
              value={pets}
              onChange={(e) => setPets(Number(e.target.value))}
            >
              <option value="0">Nessuno</option>
              <option value="1">1 Animale{!hidePrices && property.pet_fee > 0 ? ` (+ €${property.pet_fee})` : ''}</option>
              <option value="2">2 Animali{!hidePrices && property.pet_fee > 0 ? ` (+ €${property.pet_fee * 2})` : ''}</option>
              <option value="3">3 Animali{!hidePrices && property.pet_fee > 0 ? ` (+ €${property.pet_fee * 3})` : ''}</option>
            </select>
          </div>
        )}

        {/* Extra Services Selector */}
        {!hidePrices && availableExtras.length > 0 && (
          <div className="border border-gray-300 rounded-lg p-3">
             <label className="block text-[10px] uppercase font-bold text-gray-900 mb-2">Servizi Extra</label>
             <div className="space-y-2">
               {availableExtras.map((extra: any) => {
                 const selected = selectedExtras.find(e => e.id === extra.id);
                 return (
                   <div key={extra.id} className="flex items-center justify-between">
                     <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-gray-800">
                       <input 
                         type="checkbox" 
                         className="rounded text-blue-600 focus:ring-blue-500"
                         checked={!!selected}
                         onChange={(e) => handleExtraChange(extra, e.target.checked)}
                       />
                       <span>{extra.name} (+€{extra.price})</span>
                     </label>
                     {selected && (
                       <div className="flex items-center space-x-2 bg-gray-100 rounded-md p-1">
                         <button type="button" onClick={() => handleExtraQtyChange(extra.id, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:text-gray-900 font-bold">-</button>
                         <span className="text-xs font-bold w-4 text-center">{selected.qty}</span>
                         <button type="button" onClick={() => handleExtraQtyChange(extra.id, 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 hover:text-gray-900 font-bold">+</button>
                       </div>
                     )}
                   </div>
                 );
               })}
             </div>
          </div>
        )}

        {/* Invia Bottone */}
        <button 
          type="button" 
          disabled={!!errorMessage || nights === 0}
          className="w-full text-white font-bold py-3.5 rounded-lg shadow-md hover:shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{ backgroundColor: errorMessage || nights === 0 ? '#9ca3af' : 'var(--theme-color)'}}
          onClick={() => setIsCheckoutOpen(true)}
        >
          {errorMessage ? 'Date non valide' : hidePrices ? 'Richiedi Disponibilità' : 'Invia Richiesta e Prenota'}
        </button>

        {errorMessage && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm font-medium animate-in zoom-in duration-200">
             {errorMessage}
          </div>
        )}

        {/* Breakdown Costi */}
        {!hidePrices && nights > 0 && !errorMessage && (
          <div className="border-t border-gray-100 mt-4 pt-4 space-y-2 animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between text-sm text-gray-600">
              <span className="underline decoration-dotted underline-offset-2">Soggiorno base ({nights} notti)</span>
              <span>€ {baseTotal}</span>
            </div>
            {(property.cleaning_fee || 0) > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span className="underline decoration-dotted underline-offset-2">Spese di Pulizia</span>
                <span>€ {property.cleaning_fee}</span>
              </div>
            )}
            {pets > 0 && petsTotal > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span className="underline decoration-dotted underline-offset-2">Tariffa animali ({pets})</span>
                <span>€ {petsTotal}</span>
              </div>
            )}
            {selectedExtras.map((ex: any) => (
              <div key={ex.id} className="flex justify-between text-sm text-gray-600">
                <span className="underline decoration-dotted underline-offset-2 truncate">Extra: {ex.name} (x{ex.qty})</span>
                <span>€ {ex.total}</span>
              </div>
            ))}
            
            <div className="flex justify-between font-bold text-gray-900 mt-4 pt-4 border-t border-gray-100 text-lg">
              <span>Totale Stimato</span>
              <span>€ {grandTotal}</span>
            </div>
            
            {/* Note separate */}
            {property.deposit_percentage > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2 space-y-1">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-1">Da pagare ORA (anticipatamente)</p>
                <p className="text-xs text-blue-800 font-medium">
                  💳 Caparra ({property.deposit_percentage}%): <strong>€ {Math.round(grandTotal * property.deposit_percentage / 100)}</strong>
                </p>
              </div>
            )}
            {(property.security_deposit > 0 || cityTaxTotal > 0) && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2 space-y-1">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-1">Da pagare separatamente in loco</p>
                {property.security_deposit > 0 && (
                  <p className="text-xs text-amber-800 font-medium">
                    🔒 Cauzione danni: <strong>€ {property.security_deposit}</strong> — cash all'arrivo, restituita al check-out
                  </p>
                )}
                {cityTaxTotal > 0 && (
                  <p className="text-xs text-amber-800 font-medium">
                    🏛️ Tassa di soggiorno ({adults} adulti × {Math.min(nights, property.city_tax_max_nights ?? 10)} notti): <strong>€ {cityTaxTotal}</strong> — cash all'arrivo
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-gray-500 pt-2 font-medium">
          {hidePrices ? "Invia una richiesta di disponibilità, ti risponderemo al più presto." : "Sarai contattato dall'host per confermare la disponibilità prima di pagare."}
        </p>
      </form>

      {/* MODAL CHECKOUT */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-300">
            {isSuccess ? (
              <div className="p-8 text-center space-y-4 shadow-inner bg-green-50">
                 <div className="mx-auto w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mb-2">🎉</div>
                 <h2 className="text-2xl font-bold text-gray-900">{hidePrices ? "Richiesta Inviata!" : "Prenotazione Inoltrata!"}</h2>
                 <p className="text-gray-600">{hidePrices
                   ? `Grazie per la tua richiesta di prenotazione. Ti contatteremo al più presto all'indirizzo ${guestEmail}.`
                   : `Hai inviato con successo la tua richiesta. L'host ti ha appena mandato una email di riepilogo a <b>${guestEmail}</b>.`
                 }</p>
                 <button 
                   onClick={() => window.location.reload()} 
                   className="mt-6 font-bold py-3 px-6 rounded-lg bg-green-600 text-white w-full hover:bg-green-700 transition"
                 >
                   Torna alla vetrina
                 </button>
              </div>
            ) : (
              <form onSubmit={handleCheckout} className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{hidePrices ? "Richiedi Disponibilità" : "Chi viaggia?"}</h2>
                    <p className="text-sm text-gray-500 mt-1">{adults} adulti{children > 0 ? ` + ${children} bambini` : ''}{pets > 0 ? ` + ${pets} animale/i` : ''}</p>
                  </div>
                  <button type="button" onClick={() => setIsCheckoutOpen(false)} className="text-gray-400 hover:text-gray-700 bg-gray-100 w-8 h-8 rounded-full font-bold">×</button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase font-bold text-gray-700 mb-1">Nome e Cognome *</label>
                    <input type="text" required value={guestName} onChange={e => setGuestName(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-xs uppercase font-bold text-gray-700 mb-1">Email *</label>
                    <input type="email" required value={guestEmail} onChange={e => setGuestEmail(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 outline-none transition" />
                  </div>
                  <div>
                    <label className="block text-xs uppercase font-bold text-gray-700 mb-1">Cellulare *</label>
                    <input type="tel" required value={guestPhone} onChange={e => setGuestPhone(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 outline-none transition" />
                  </div>
                  {hidePrices && (
                    <div>
                      <label className="block text-xs uppercase font-bold text-gray-700 mb-1">Note / Messaggio</label>
                      <textarea rows={3} value={guestNotes} onChange={e => setGuestNotes(e.target.value)} placeholder="Eventuali richieste o informazioni..." className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 outline-none transition" />
                    </div>
                  )}
                  {!hidePrices && (
                    <div>
                      <label className="block text-xs uppercase font-bold text-gray-700 mb-1">Metodo Pagamento in Struttura *</label>
                      <select required value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 outline-none transition">
                         {allowedMethods.map((m: string) => (
                             <option key={m} value={m}>{m}</option>
                         ))}
                      </select>
                    </div>
                  )}
                </div>

                {!hidePrices && (
                  <div className="mt-6 pt-4 border-t border-gray-100 space-y-1">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Totale soggiorno:</span><span className="font-bold">€ {grandTotal}</span>
                    </div>
                    {property.deposit_percentage > 0 && (
                      <div className="flex justify-between text-sm text-amber-700">
                        <span>Caparra richiesta ({property.deposit_percentage}%):</span>
                        <span className="font-bold">€ {Math.round(grandTotal * property.deposit_percentage / 100)}</span>
                      </div>
                    )}
                  </div>
                )}

                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full mt-4 text-white font-bold py-4 rounded-xl shadow-md hover:shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50"
                  style={{ backgroundColor: 'var(--theme-color)' }}
                >
                  {isSubmitting ? 'Elaborazione...' : hidePrices ? 'Invia Richiesta' : 'Conferma e Invia Email'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
