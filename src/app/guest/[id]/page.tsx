"use client";

import { useState, useEffect, use, Suspense } from "react";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, Home, CalendarDays, Users, Euro, Wifi, LogIn, LogOut, Utensils, Landmark, Phone, MapPin, BookOpen, DoorOpen, ShieldCheck, Hourglass } from "lucide-react";
import { addDays, parseISO, startOfDay, isAfter, format } from "date-fns";

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
      setLoading(false);
    }
    fetchData();
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

  const fmt = (d: string) => d ? format(parseISO(d), "EEEE d MMMM yyyy") : "—";
  const fmtShort = (d: string) => d ? format(parseISO(d), "dd/MM/yyyy") : "—";

  const expiresDays = prop?.portal_expires_days ?? 7;
  const expiresAt = booking.check_out_date ? addDays(startOfDay(parseISO(booking.check_out_date)), expiresDays) : null;
  const isExpired = expiresAt ? isAfter(startOfDay(new Date()), expiresAt) : false;

  const showCheckIn = booking.status !== 'cancelled';
  const showCheckOut = booking.status !== 'cancelled' && booking.checkout_submitted_at === null;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* HERO */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-500 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {org?.logo_url ? (
                <img src={org.logo_url} alt={org.name} className="w-10 h-10 rounded-full bg-white/20 object-cover" />
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
                  <div className="font-bold text-gray-900 mt-0.5">{booking.guests_count}</div>
                </div>
                {booking.total_price > 0 && (
                  <div className="col-span-2 border-t pt-3 mt-1 flex items-center justify-between">
                    <div className="text-xs text-gray-400 font-semibold uppercase">Totale Soggiorno</div>
                    <div className="text-lg font-extrabold text-gray-900">€{Number(booking.total_price).toLocaleString("it-IT")}</div>
                  </div>
                )}
              </div>
            </div>

            {/* CHECK-IN / CHECK-OUT */}
            <div className="grid grid-cols-2 gap-4">
              <a
                href={`/guest/${booking.id}/checkin`}
                className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition shadow-lg flex items-center justify-center ${showCheckIn ? '' : 'opacity-40 pointer-events-none'}`}
              >
                <LogIn className="w-6 h-6 mr-2" /> Check-in
              </a>
              <a
                href={`/guest/${booking.id}/checkout`}
                className={`bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition shadow-lg flex items-center justify-center ${showCheckOut ? '' : 'opacity-40 pointer-events-none'}`}
              >
                <LogOut className="w-6 h-6 mr-2" /> Check-out
              </a>
            </div>

            {/* ARRIVO E CASA */}
            <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-3 border-b pb-4">
                <DoorOpen className="w-6 h-6 text-blue-600" />
                <h2 className="text-lg font-bold text-gray-900">Arrivo e Soggiorno</h2>
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
                </div>
              )}

              {prop?.check_in_instructions && (
                <div>
                  <div className="text-xs text-gray-400 font-semibold uppercase mb-1">Istruzioni per l'Arrivo</div>
                  <p className="text-gray-700 text-sm whitespace-pre-line">{prop.check_in_instructions}</p>
                </div>
              )}

              {prop?.house_manual && (
                <div>
                  <div className="text-xs text-gray-400 font-semibold uppercase mb-1">Manuale della Casa</div>
                  <p className="text-gray-700 text-sm whitespace-pre-line">{prop.house_manual}</p>
                </div>
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
