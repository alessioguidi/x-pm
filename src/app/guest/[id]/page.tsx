"use client";

import { useState, useEffect, use, Suspense } from "react";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Home, CalendarDays, Users, Wifi, LogIn, LogOut, Utensils, Landmark, Phone, MapPin, BookOpen, DoorOpen, ShieldCheck, Hourglass, CreditCard, Lock, Key } from "lucide-react";
import { addDays, parseISO, startOfDay, isAfter } from "date-fns";

export default function GuestPortalWrapper({ params }: { params: Promise<{ id: string }> }) {
  const p = use(params);
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>}>
      <GuestPortalPage bookingId={p.id} />
    </Suspense>
  );
}

function GuestPortalPage({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [registeredGuests, setRegisteredGuests] = useState(0);
  const [paying, setPaying] = useState(false);
  const [lang, setLang] = useState("it-IT");

  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.language) setLang(navigator.language);
  }, []);

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, properties!inner(*, organizations(name, logo_url)), organizations(name, logo_url, whatsapp_phone)")
        .eq("id", bookingId)
        .single();

      if (error || !data) {
        setError("Prenotazione non trovata.");
      } else {
        setBooking(data);
      }

      const [pmtRes, guestsRes] = await Promise.all([
        fetch(`/api/portal/pending-payments?booking_id=${bookingId}`).then(r => r.json()),
        supabase.from("booking_guests").select("id", { count: "exact", head: true }).eq("booking_id", bookingId),
      ]);
      setPendingPayments((pmtRes.payments || []).filter((p: any) => Number(p.amount) > 0));
      setRegisteredGuests(guestsRes.count || 0);

      setLoading(false);
    }
    fetchData();

    const onFocus = () => fetchData();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [bookingId]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="flex h-screen items-center justify-center p-4 text-center text-gray-500">
        {error || "Prenotazione non trovata."}
      </div>
    );
  }

  const prop = booking.properties;
  const org = booking.organizations || prop?.organizations;
  const rules = prop?.house_rules || {};
  const wifi = prop?.wifi_info || {};
  const restaurants = prop?.guide_restaurants || [];
  const attractions = prop?.guide_attractions || [];
  const usefulNumbers = prop?.useful_numbers || [];
  const guideNotes = prop?.guide_notes || "";

  const fmt = (d: string) => d ? new Date(d).toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—";

  const expiresDays = prop?.portal_expires_days ?? 7;
  const expiresAt = booking.check_out_date ? addDays(startOfDay(parseISO(booking.check_out_date)), expiresDays) : null;
  const isExpired = expiresAt ? isAfter(startOfDay(new Date()), expiresAt) : false;

  const totalGuests = (booking.adults_count || 0) + (booking.children_count || 0) || booking.guests_count || 1;
  const depositMethod = prop?.deposit_method || "cash";
  const duePayments = pendingPayments.filter(p => !(p.reason === "Cauzione Danni" && depositMethod === "stripe"));
  const pendingTotal = duePayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const checkInCompleted = registeredGuests >= totalGuests;

  const showCheckIn = booking.status !== 'cancelled';
  const showCheckOut = booking.status !== 'cancelled' && booking.checkout_submitted_at === null;
  const checkInEnabled = showCheckIn && pendingTotal <= 0 && booking.checkout_submitted_at === null;
  const checkOutEnabled = showCheckOut && pendingTotal <= 0 && checkInCompleted;

  const handlePay = async () => {
    setPaying(true);
    try {
      const res = await fetch("/api/stripe/pay-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore durante la creazione del pagamento");
      router.push(data.payment_link);
    } catch (err: any) {
      setPaying(false);
      alert(err.message || "Errore durante la creazione del pagamento");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* HERO */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-500 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {prop?.logo_url || org?.logo_url ? (
                <img src={prop?.logo_url || org?.logo_url} alt={prop?.name || org?.name} className="w-10 h-10 rounded-full bg-white/20 object-cover" />
              ) : (
                <Home className="w-10 h-10 opacity-80" />
              )}
              <div>
                <h1 className="text-2xl font-extrabold leading-tight">{prop?.name}</h1>
                <p className="text-blue-100 text-sm">{org?.name}</p>
              </div>
            </div>
            {booking.status === 'confirmed' && (
              <span className="bg-emerald-400/20 border border-emerald-300/40 text-emerald-100 text-xs font-bold px-3 py-1 rounded-full">Confermata</span>
            )}
            {booking.status === 'in_progress' && (
              <span className="bg-blue-400/20 border border-blue-300/40 text-blue-100 text-xs font-bold px-3 py-1 rounded-full">In corso</span>
            )}
            {booking.status === 'completed' && (
              <span className="bg-gray-400/20 border border-gray-300/40 text-gray-100 text-xs font-bold px-3 py-1 rounded-full">Terminata</span>
            )}
            {booking.status === 'pending' && (
              <span className="bg-amber-400/20 border border-amber-300/40 text-amber-100 text-xs font-bold px-3 py-1 rounded-full">In Attesa</span>
            )}
          </div>
          <p className="text-blue-100 mt-4">Ciao {booking.guest_name}!</p>
          <p className="text-blue-50/90 text-sm">Ecco tutto quello che ti serve per il tuo soggiorno.</p>
        </div>

        {isExpired ? (
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-8 text-center">
            <Hourglass className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Link Scaduto</h2>
            <p className="text-gray-500 text-sm">
              Questo link è scaduto ({expiresDays} giorni dopo la fine del soggiorno).
              Per qualsiasi necessità contattaci direttamente.
            </p>
          </div>
        ) : (
          <>
            {/* PRENOTAZIONE */}
            <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 border-b pb-4 mb-4">
                <CalendarDays className="w-6 h-6 text-blue-600" />
                <h2 className="text-lg font-bold text-gray-900">La Tua Prenotazione</h2>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-gray-400 font-semibold uppercase">Check-in</div>
                  <div className="font-bold text-gray-900 mt-0.5">{fmt(booking.check_in_date)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 font-semibold uppercase">Check-out</div>
                  <div className="font-bold text-gray-900 mt-0.5">{fmt(booking.check_out_date)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 font-semibold uppercase">Notti</div>
                  <div className="font-bold text-gray-900 mt-0.5">{booking.nights}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 font-semibold uppercase">Ospiti</div>
                  <div className="font-bold text-gray-900 mt-0.5">
                    {booking.children_count
                      ? `${booking.adults_count || 0} ${(booking.adults_count || 0) === 1 ? "Adulto" : "Adulti"} • ${booking.children_count} ${booking.children_count === 1 ? "Bambino" : "Bambini"}`
                      : `${booking.guests_count || 0} ${(booking.guests_count || 0) === 1 ? "Ospite" : "Ospiti"}`}
                  </div>
                </div>
              </div>
            </div>

            {/* PAGAMENTI IN SOSPESO */}
            {pendingTotal > 0 && (
              <div className="bg-white shadow-sm border-2 border-amber-200 rounded-2xl p-6">
                <div className="flex items-center gap-3 border-b pb-4 mb-4">
                  <CreditCard className="w-6 h-6 text-amber-600" />
                  <h2 className="text-lg font-bold text-gray-900">Pagamenti da Saldare</h2>
                </div>
                <div className="space-y-2 mb-5">
                  {duePayments.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm p-3 bg-amber-50 rounded-xl">
                      <span className="font-medium text-gray-700">{p.reason || "Pagamento"}</span>
                      <span className="font-bold text-gray-900">{Number(p.amount).toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-sm p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="font-bold text-gray-800">Totale</span>
                    <span className="font-black text-lg text-gray-900">{pendingTotal.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}</span>
                  </div>
                </div>
                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-2xl transition shadow-lg flex items-center justify-center disabled:opacity-50"
                >
                  {paying ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <CreditCard className="w-6 h-6 mr-2" />}
                  {paying ? "Creazione pagamento..." : "Paga"}
                </button>
                <p className="text-xs text-gray-400 text-center mt-3">
                  Paga online ora o salda le spese all'arrivo.
                </p>
              </div>
            )}

            {/* CHECK-IN / CHECK-OUT */}
            <div className="grid grid-cols-2 gap-4">
              <a
                href={checkInEnabled ? `/guest/${booking.id}/checkin` : undefined}
                onClick={e => { if (!checkInEnabled) e.preventDefault(); }}
                className={`${checkInEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'} text-white font-bold py-4 rounded-2xl transition flex items-center justify-center ${checkInEnabled ? 'shadow-lg' : 'opacity-70'}`}
                title={checkInEnabled ? undefined : booking.checkout_submitted_at ? "Check-out già inviato" : pendingTotal > 0 ? "Paga le spese in sospeso per attivare il check-in" : "Prenotazione annullata"}
              >
                {checkInEnabled ? <LogIn className="w-6 h-6 mr-2" /> : <Lock className="w-6 h-6 mr-2" />} Check-in
              </a>
              <a
                href={checkOutEnabled ? `/guest/${booking.id}/checkout` : undefined}
                onClick={e => { if (!checkOutEnabled) e.preventDefault(); }}
                className={`${checkOutEnabled ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-300 cursor-not-allowed'} text-white font-bold py-4 rounded-2xl transition flex items-center justify-center ${checkOutEnabled ? 'shadow-lg' : 'opacity-70'}`}
                title={checkOutEnabled ? undefined : pendingTotal > 0 ? "Paga le spese in sospeso per attivare il check-out" : !checkInCompleted ? "Il check-out si attiva dopo aver completato il check-in" : "Completa il check-in per attivare il check-out"}
              >
                {checkOutEnabled ? <LogOut className="w-6 h-6 mr-2" /> : <Lock className="w-6 h-6 mr-2" />} Check-out
              </a>
            </div>

            {/* ARRIVO */}
            <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-3 border-b pb-4">
                <DoorOpen className="w-6 h-6 text-blue-600" />
                <h2 className="text-lg font-bold text-gray-900">Arrivo</h2>
              </div>

              {wifi?.network && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <Wifi className="w-4 h-4 text-blue-600" /> Wi-Fi: {wifi.network}
                  </div>
                  <code className="text-sm font-bold bg-white border border-gray-200 rounded px-2 py-1 text-gray-900">{wifi.password || "—"}</code>
                </div>
              )}

              {prop?.check_in_method && (
                <div>
                  <div className="text-xs text-gray-400 font-semibold uppercase mb-1">Metodo di Check-in</div>
                  <div className="font-medium text-gray-900">{prop.check_in_method}</div>
                  {prop.check_in_method === "Self check-in con cassetta di sicurezza" && prop?.key_locker_code && (
                    <div className="mt-2">
                      {checkInCompleted ? (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                            <Key className="w-4 h-4 text-blue-600" /> Codice Cassetta di Sicurezza
                          </div>
                          <code className="text-lg font-black tracking-widest bg-white border border-gray-200 rounded px-3 py-1 text-gray-900">{prop.key_locker_code}</code>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-xl p-3">
                          <Lock className="w-4 h-4 text-gray-400" /> Codice cassetta disponibile dopo il check-in
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {prop?.check_in_instructions && (
                <div>
                  <div className="text-xs text-gray-400 font-semibold uppercase mb-1">Istruzioni per l'Arrivo</div>
                  <p className="text-gray-700 text-sm whitespace-pre-line">{prop.check_in_instructions}</p>
                </div>
              )}
            </div>

            {/* MANUALE DELLA CASA */}
            {(prop?.house_manual || Object.values(rules).some(Boolean)) && (
              <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-3 border-b pb-4">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                  <h2 className="text-lg font-bold text-gray-900">Manuale della Casa</h2>
                </div>

                {prop?.house_manual && (
                  <p className="text-gray-700 text-sm whitespace-pre-line">{prop.house_manual}</p>
                )}

                {Object.values(rules).some(Boolean) && (
                  <div>
                    <div className="text-xs text-gray-400 font-semibold uppercase mb-2">Regole della Casa</div>
                    <div className="space-y-2">
                      {rules.pets_allowed && <div className="text-sm text-gray-700 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Animali ammessi</div>}
                      {rules.smoking_allowed && <div className="text-sm text-gray-700 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-amber-600" /> Fumo ammesso</div>}
                      {rules.events_allowed && <div className="text-sm text-gray-700 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-purple-600" /> Eventi ammessi</div>}
                      {!rules.pets_allowed && <div className="text-sm text-gray-700 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-gray-400" /> No animali</div>}
                      {!rules.smoking_allowed && <div className="text-sm text-gray-700 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-gray-400" /> No fumo</div>}
                      {!rules.events_allowed && <div className="text-sm text-gray-700 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-gray-400" /> No eventi</div>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* GUIDA RISTORANTI */}
            {restaurants.length > 0 && (
              <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6">
                <div className="flex items-center gap-3 border-b pb-4 mb-4">
                  <Utensils className="w-6 h-6 text-orange-500" />
                  <h2 className="text-lg font-bold text-gray-900">Dove Mangiare</h2>
                </div>
                <div className="space-y-4">
                  {restaurants.map((r: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl border border-gray-100 hover:border-orange-200 transition">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-gray-900">{r.name}</div>
                        {r.phone && (
                          <a href={`tel:${r.phone}`} className="text-blue-600 text-sm font-semibold">{r.phone}</a>
                        )}
                      </div>
                      {r.address && <div className="text-sm text-gray-500 flex items-center gap-1 mt-1"><MapPin className="w-3.5 h-3.5" /> {r.address}</div>}
                      {r.description && <p className="text-sm text-gray-600 mt-1">{r.description}</p>}
                      {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm font-medium mt-1 inline-block">Scopri di più →</a>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* GUIDA ATTRAZIONI */}
            {attractions.length > 0 && (
              <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6">
                <div className="flex items-center gap-3 border-b pb-4 mb-4">
                  <Landmark className="w-6 h-6 text-purple-500" />
                  <h2 className="text-lg font-bold text-gray-900">Cosa Vedere</h2>
                </div>
                <div className="space-y-4">
                  {attractions.map((a: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl border border-gray-100 hover:border-purple-200 transition">
                      <div className="font-bold text-gray-900">{a.name}</div>
                      {a.address && <div className="text-sm text-gray-500 flex items-center gap-1 mt-1"><MapPin className="w-3.5 h-3.5" /> {a.address}</div>}
                      {a.description && <p className="text-sm text-gray-600 mt-1">{a.description}</p>}
                      {a.url && <a href={a.url} target="_blank" rel="noreferrer" className="text-blue-600 text-sm font-medium mt-1 inline-block">Scopri di più →</a>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* NOTE GUIDA */}
            {guideNotes && (
              <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6">
                <div className="flex items-center gap-3 border-b pb-4 mb-4">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                  <h2 className="text-lg font-bold text-gray-900">Consigli degli Host</h2>
                </div>
                <p className="text-gray-700 text-sm whitespace-pre-line">{guideNotes}</p>
              </div>
            )}

            {/* NUMERI UTILI */}
            {usefulNumbers.length > 0 && (
              <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6">
                <div className="flex items-center gap-3 border-b pb-4 mb-4">
                  <Phone className="w-6 h-6 text-emerald-600" />
                  <h2 className="text-lg font-bold text-gray-900">Numeri Utili</h2>
                </div>
                <div className="space-y-2">
                  {usefulNumbers.map((n: any, i: number) => (
                    <a key={i} href={`tel:${n.phone}`} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/50 transition">
                      <span className="font-medium text-gray-700">{n.label}</span>
                      <span className="text-emerald-700 font-bold">{n.phone}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* FOOTER */}
            <div className="text-center text-xs text-gray-400 pb-4">
              <p>{prop?.name} • {org?.name}</p>
              {org?.whatsapp_phone && (
                <p className="mt-1">
                  <a href={`https://wa.me/${org.whatsapp_phone.replace(/[^0-9]/g, '')}`} className="text-emerald-600 font-semibold hover:underline">
                    Hai domande? Scrivici su WhatsApp
                  </a>
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
