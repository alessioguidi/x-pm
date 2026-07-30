"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { MoveLeft, UserCircle2, Send, Save, CreditCard, Building2, MapPin, Loader2, Phone, Mail, FileText, Download, ShieldCheck, Edit3, Trash2, X } from "lucide-react";
import { formatCurrency, formatDateStr, formatDateRange, formatPercent, formatDateTime } from "@/lib/format";
import Link from "next/link";
import toast from "react-hot-toast";
import { use } from "react";
import BookingFinancials from "@/components/BookingFinancials";

export default function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [booking, setBooking] = useState<any>(null);
  const [bookingGuests, setBookingGuests] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State Message
  const [chatType, setChatType] = useState('internal'); // whatsapp, email, internal
  const [chatContent, setChatContent] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  // Guest Edit State
  const [isEditingGuest, setIsEditingGuest] = useState(false);
  const [guestForm, setGuestForm] = useState({ first_name: '', last_name: '', email: '', phone: '' });
  // Booking Edit State
  const [properties, setProperties] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [isEditBookingModal, setIsEditBookingModal] = useState(false);
  const [editBookingForm, setEditBookingForm] = useState<any>({});


  // Form State Staff Tasks
  const [staffConfig, setStaffConfig] = useState<any>({
    checkin_staff_id: "",
    checkout_staff_id: "",
    cleaning_staff_id: "",
    requires_linens: false,
    staff_notes: ""
  });
  const [savingStaff, setSavingStaff] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    // Booking
    const { data: bk, error: bkError } = await supabase
      .from('bookings')
      .select('*, properties(name), organizations(allowed_payment_methods), contacts(*)')
      .eq('id', id)
      .single();
    if (bk) {
       setBooking(bk);
       setGuestForm({ 
           first_name: bk.contacts?.first_name || bk.guest_name?.split(' ')[0] || '', 
           last_name: bk.contacts?.last_name || bk.guest_name?.split(' ').slice(1).join(' ') || '', 
           email: bk.contacts?.email || bk.guest_email || '', 
           phone: bk.contacts?.phone || bk.guest_phone || '' 
       });
        setEditBookingForm({
           property_id: bk.property_id,
           check_in_date: bk.check_in_date,
           check_out_date: bk.check_out_date,
           guests_count: bk.guests_count || 1,
            adults_count: bk.adults_count || bk.guests_count || 1,
            children_count: bk.children_count || 0,
           pets_count: bk.pets_count || 0,
           total_price: bk.total_price || 0,
           channel_id: bk.channel_id || "",
        });
       setStaffConfig({
          checkin_staff_id: bk.checkin_staff_id || "",
          checkout_staff_id: bk.checkout_staff_id || "",
          cleaning_staff_id: bk.cleaning_staff_id || "",
          requires_linens: bk.requires_linens || false,
          staff_notes: bk.staff_notes || ""
       });
    }

    // Messages
    const { data: msgs, error: msgsErr } = await supabase
      .from('booking_messages')
      .select('*')
      .eq('booking_id', id)
      .order('created_at', { ascending: true });
      
    if (msgsErr) console.error("Message Fetch Error:", msgsErr);
    if (msgs) setMessages(msgs);

    // Guests
    const { data: gs } = await supabase.from('booking_guests').select('*').eq('booking_id', id);
    if (gs) setBookingGuests(gs);
      
    if (msgsErr) console.error("Message Fetch Error:", msgsErr);
    if (msgs) setMessages(msgs);

    // Properties
    const { data: props } = await supabase.from('properties').select('id, name');
    if (props) setProperties(props);

    // Staff List
    const { data: st } = await supabase.from('staff_members').select('*');
    if (st) setStaff(st);

    // Channels
    const { data: chs } = await supabase.from('booking_channels').select('*');
    if (chs) setChannels(chs);

    setLoading(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    toast.loading("Aggiornamento stato in corso...", { id: 'status-toast' });
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    
    const res = await fetch(`/api/bookings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
       setBooking({ ...booking, status: newStatus });
       toast.success("Stato e Notifiche aggiornati!", { id: 'status-toast' });
       fetchData(); // ricarica per log messaggi interni
    } else {
       toast.error("Errore aggiornamento", { id: 'status-toast' });
    }
  };

  const handleStaffSave = async () => {
    setSavingStaff(true);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    const res = await fetch(`/api/bookings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        checkin_staff_id: staffConfig.checkin_staff_id || null,
        checkout_staff_id: staffConfig.checkout_staff_id || null,
        cleaning_staff_id: staffConfig.cleaning_staff_id || null,
        requires_linens: staffConfig.requires_linens,
        staff_notes: staffConfig.staff_notes
      })
    });
    if (res.ok) {
      toast.success("Assegnazioni Staff Salvate! (Notifiche inviate se impostate)");
    } else {
      toast.error("Errore salvataggio task");
    }
    setSavingStaff(false);
  };

  const handeSendMessage = async () => {
     if (!chatContent.trim()) return;
     setSendingMsg(true);
     const { data } = await supabase.auth.getSession();
     const token = data.session?.access_token;

     const res = await fetch(`/api/bookings/${id}/messages`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
         body: JSON.stringify({
             channel: chatType,
             content: chatContent
         })
     });

     if (res.ok) {
         toast.success("Messaggio inviato!");
         setChatContent("");
         fetchData();
     } else {
         toast.error("Errore invio messaggio.");
     }
     setSendingMsg(false);
  };

  const handleDeleteGuest = async (guestId: string) => {
     if (!window.confirm("Sei sicuro di voler eliminare questo ospite?")) return;
     toast.loading("Eliminazione in corso...", { id: "delG" });
     const { error } = await supabase.from('booking_guests').delete().eq('id', guestId);
     if (error) {
         toast.error("Errore salvataggio", { id: "delG" });
     } else {
         toast.success("Ospite rimosso", { id: "delG" });
         fetchData();
     }
  };

  const handleSaveBookingParams = async (e: React.FormEvent) => {
     e.preventDefault();
     setLoading(true);

     const dIn = new Date(editBookingForm.check_in_date);
     const dOut = new Date(editBookingForm.check_out_date);
     const nights = Math.max(1, Math.round((dOut.getTime() - dIn.getTime()) / (1000 * 3600 * 24)));

     const selChannel = channels.find(c => c.id === editBookingForm.channel_id);
     const commissionAmount = selChannel ? Math.round(Number(editBookingForm.total_price) * Number(selChannel.commission_pct || 0) / 100 * 100) / 100 : 0;
     const taxAmount = selChannel ? Math.round(Number(editBookingForm.total_price) * Number(selChannel.tax_pct || 0) / 100 * 100) / 100 : 0;

     const { error } = await supabase.from('bookings').update({
        property_id: editBookingForm.property_id,
        check_in_date: editBookingForm.check_in_date,
        check_out_date: editBookingForm.check_out_date,
        guests_count: editBookingForm.guests_count,
         adults_count: editBookingForm.adults_count,
         children_count: editBookingForm.children_count,
        pets_count: editBookingForm.pets_count,
        total_price: editBookingForm.total_price,
        nights: nights,
        channel_id: editBookingForm.channel_id || null,
        commission_amount: commissionAmount,
        tax_amount: taxAmount,
     }).eq('id', id);

     if (error) {
        toast.error("Errore salvataggio modifiche", { id: "editBk" });
        setLoading(false);
     } else {
        toast.success("Dettagli Soggiorno Aggiornati!", { id: "editBk" });
        setIsEditBookingModal(false);
        fetchData();
     }
  };

  const downloadRossXML = () => {
     if (!booking || !bookingGuests.length) return toast.error("Nessun ospite registrato.");
     const checkinStr = booking.check_in_date.replace(/-/g, ''); // 20260411

     let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<movimenti>\n<codice>CODICE_STRUTTURA</codice>\n<prodotto>AltamiraRMS</prodotto>\n`;
     xml += `<movimento>\n<data>${checkinStr}</data>\n`;
     xml += `<struttura>\n<apertura>SI</apertura>\n<camereoccupate>1</camereoccupate>\n<cameredisponibili>1</cameredisponibili>\n<lettidisponibili>${booking.guests_count}</lettidisponibili>\n</struttura>\n`;
     xml += `<arrivi>\n`;

     let capoId = "";
     bookingGuests.forEach(g => {
         if (["16", "17", "18"].includes(g.type)) capoId = g.id.substring(0, 18).replace(/-/g, '');
     });

     bookingGuests.forEach(g => {
         const isLeader = ["16", "17", "18"].includes(g.type);
         const idswh = g.id.substring(0, 18).replace(/-/g, '');
         const capoRef = isLeader ? "" : `<idcapo>${capoId}</idcapo>`;
         const bDate = g.birth_date.replace(/-/g, '');
         
         xml += `  <arrivo>\n`;
         xml += `    <idswh>${idswh}</idswh>\n`;
         xml += `    <tipoalloggiato>${g.type}</tipoalloggiato>\n`;
         if (!isLeader) xml += `    ${capoRef}\n`;
         xml += `    <sesso>${g.gender}</sesso>\n`;
         xml += `    <cittadinanza>${g.citizenship}</cittadinanza>\n`;
         xml += `    <statoresidenza>${g.residence_country}</statoresidenza>\n`;
         if (g.residence_city) xml += `    <luogoresidenza>${g.residence_city}</luogoresidenza>\n`;
         xml += `    <datanascita>${bDate}</datanascita>\n`;
         if (g.birth_country && g.birth_country === "100000100") xml += `    <statonascita>${g.birth_country}</statonascita>\n`;
         if (g.birth_city && g.birth_country === "100000100") xml += `    <comunenascita>${g.birth_city}</comunenascita>\n`;
         xml += `    <tipoturismo>Altro motivo</tipoturismo>\n`;
         xml += `    <mezzotrasporto>Auto</mezzotrasporto>\n`;
         xml += `    <canaleprenotazione>Diretta web</canaleprenotazione>\n`;
         xml += `  </arrivo>\n`;
     });

     xml += `</arrivi>\n</movimento>\n</movimenti>`;

     const blob = new Blob([xml], { type: 'text/xml' });
     const url = window.URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `ross1000_${checkinStr}_${booking.id.substring(0,8)}.xml`;
     a.click();
     window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  if (!booking) return <div>Prenotazione non trovata.</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
       <div className="flex items-center gap-4 border-b border-gray-200 pb-4">
          <Link href="/bookings" className="p-2.5 bg-white rounded-lg border border-gray-200 hover:bg-gray-100 transition shadow-sm">
             <MoveLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center">
                Prenotazione {booking.guest_name}
                <span className={`ml-4 text-xs font-bold px-3 py-1 rounded-full uppercase ${
                     booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                     booking.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                     'bg-rose-100 text-rose-700'
                   }`}>
                   {booking.status}
                </span>
            </h1>
             <p className="text-gray-500 font-medium text-sm flex items-center mt-1">
                <Building2 className="w-4 h-4 mr-1.5 opacity-60" /> {booking.properties?.name} &bull; {formatDateStr(booking.check_in_date)} al {formatDateStr(booking.check_out_date)}
                {booking.channel_id && (() => {
                  const ch = channels.find(c => c.id === booking.channel_id);
                  return ch ? <span className="ml-3 text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{ch.name}</span> : null;
                })()}
             </p>
            <button onClick={() => setIsEditBookingModal(true)} className="text-blue-600 hover:text-blue-800 text-xs font-bold mt-2 flex items-center bg-blue-50 px-4 py-2.5 rounded-full transition">
               <Edit3 className="w-3.5 h-3.5 mr-1" /> Modifica Dettagli Soggiorno
            </button>
          </div>
          
           <div className="ml-auto flex items-center gap-2">
              {booking.status === "confirmed" && (
                <div className="flex flex-wrap gap-1.5 mr-3">
                  <button onClick={() => { const l = `${window.location.origin}/guest/${id}/checkin`; navigator.clipboard.writeText(l); toast.success("Link check-in copiato!"); }} className="text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-700 px-3 py-2 rounded-full hover:bg-blue-100 transition flex items-center">
                    <Send className="w-3 h-3 mr-1" /> Check-in
                  </button>
                  <button onClick={() => { const l = `${window.location.origin}/guest/${id}/checkout`; navigator.clipboard.writeText(l); toast.success("Link check-out copiato!"); }} className="text-[10px] font-bold uppercase tracking-wide bg-purple-50 text-purple-700 px-3 py-2 rounded-full hover:bg-purple-100 transition flex items-center">
                    <Send className="w-3 h-3 mr-1" /> Check-out
                  </button>
                  <button onClick={async () => {
                    toast.loading("Creazione pre-autorizzazione...", { id: "dep" });
                    try {
                      const { error: aErr } = await supabase.auth.getUser();
                      if (aErr) throw new Error("Login richiesto");
                      const res = await fetch("/api/stripe/deposit", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` }, body: JSON.stringify({ action: "create", booking_id: id }) });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error);
                      const l = `${window.location.origin}/stripe-pay/${data.payment_intent_id}`;
                      await navigator.clipboard.writeText(l);
                      toast.success("Link cauzione copiato!", { id: "dep" });
                    } catch (err: any) { toast.error(err.message, { id: "dep" }); }
                  }} className="text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 px-3 py-2 rounded-full hover:bg-emerald-100 transition flex items-center">
                    <ShieldCheck className="w-3 h-3 mr-1" /> Cauzione
                  </button>
                  <button onClick={async () => {
                    toast.loading("Invio email...", { id: "res" });
                    const res = await fetch(`/api/bookings/${id}/resend`, { method: "POST" });
                    if (res.ok) toast.success("Email inviata!", { id: "res" });
                    else { const d = await res.json().catch(() => ({})); toast.error(d.error || "Errore", { id: "res" }); }
                  }} className="text-[10px] font-bold uppercase tracking-wide bg-blue-50 text-blue-700 px-3 py-2 rounded-full hover:bg-blue-100 transition flex items-center">
                    <Send className="w-3 h-3 mr-1" /> Re-invia
                  </button>
                </div>
              )}
              <select
               value={booking.status}
               onChange={(e) => handleStatusChange(e.target.value)}
               className="font-bold text-sm bg-white border border-gray-300 rounded-lg p-2.5 shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
             >
                 <option value="pending">Imposta In Attesa</option>
                 <option value="confirmed">Imposta Confermata (+ Invia Email)</option>
                 <option value="cancelled">Annulla Prenotazione (+ Invia Email)</option>
             </select>
          </div>
       </div>

       <div className="flex flex-col lg:flex-row gap-6 items-start h-full pb-10">
          
          {/* LATO SINISTRO: Dettagli e Assegnazioni Staff */}
          <div className="w-full lg:w-[400px] xl:w-[450px] shrink-0 space-y-6">
              
              {/* Box Ospite */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-4 group">
                  <h3 className="font-bold flex justify-between items-center text-gray-800 border-b border-gray-100 pb-3">
                     <span className="flex items-center"><UserCircle2 className="w-5 h-5 mr-2 text-rose-500" /> Contatti Ospite</span>
                     {!isEditingGuest && (
                        <button onClick={() => setIsEditingGuest(true)} className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded transition">
                           <Edit3 className="w-4 h-4"/>
                        </button>
                     )}
                  </h3>
                  
                  {isEditingGuest ? (
                     <div className="space-y-3">
                        <div className="flex gap-2">
                           <div className="flex-1">
                              <label className="block text-xs font-bold text-gray-500 mb-1">Nome</label>
                              <input type="text" value={guestForm.first_name} onChange={e => setGuestForm({...guestForm, first_name: e.target.value})} className="w-full border p-2 rounded text-sm" />
                           </div>
                           <div className="flex-1">
                              <label className="block text-xs font-bold text-gray-500 mb-1">Cognome</label>
                              <input type="text" value={guestForm.last_name} onChange={e => setGuestForm({...guestForm, last_name: e.target.value})} className="w-full border p-2 rounded text-sm" />
                           </div>
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-gray-500 mb-1">Email</label>
                           <input type="text" value={guestForm.email} onChange={e => setGuestForm({...guestForm, email: e.target.value})} className="w-full border p-2 rounded text-sm" />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-gray-500 mb-1">Telefono</label>
                           <input type="text" value={guestForm.phone} onChange={e => setGuestForm({...guestForm, phone: e.target.value})} className="w-full border p-2 rounded text-sm" />
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-gray-100 mt-2">
                           <button onClick={() => setIsEditingGuest(false)} className="flex-1 bg-white border border-gray-300 text-gray-600 font-bold py-2.5 rounded-lg text-sm">Annulla</button>
                           <button onClick={async () => {
                               if (booking.contact_id) {
                                  const { error } = await supabase.from('contacts').update({
                                     first_name: guestForm.first_name || null,
                                     last_name: guestForm.last_name || null,
                                     email: guestForm.email || null,
                                     phone: guestForm.phone || null
                                  }).eq('id', booking.contact_id);
                                  if (error) toast.error("Errore salvataggio!");
                                  else { toast.success("Contatti aggiornati nel CRM!"); setIsEditingGuest(false); fetchData(); }
                               } else {
                                  toast.error("Nessun contatto CRM collegato a questa prenotazione.");
                               }
                            }} className="flex-1 bg-blue-600 text-white font-bold py-2.5 rounded-lg text-sm">Salva</button>
                        </div>
                     </div>
                  ) : (
                     <div className="space-y-2 text-sm text-gray-600">
                        <p><b>Nome:</b> {booking.contacts ? `${booking.contacts.first_name} ${booking.contacts.last_name || ''}`.trim() : 'Ospite Sconosciuto'}</p>
                        <p><b>Email:</b> {booking.contacts?.email || 'Non fornita'}</p>
                        <p><b>Tel:</b> {booking.contacts?.phone || 'Non fornito'}</p>
                        <p className="pt-2 border-t border-gray-50 text-xs"><b>Adulti:</b> {booking.adults_count || 1} | <b>Bambini:</b> {booking.children_count || 0} | <b>Animali:</b> {booking.pets_count || 0}</p>
                     </div>
                  )}
              </div>

              {/* Box Nuova Gestione Ospiti / Alloggiati */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                     <h3 className="font-bold flex items-center text-gray-800">
                        <ShieldCheck className="w-5 h-5 mr-2 text-indigo-500" /> Scheda Alloggiati
                     </h3>
                     <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {bookingGuests.length} registrati
                     </span>
                  </div>
                  
                  {bookingGuests.length === 0 ? (
                     <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-4 border border-dashed border-gray-200 text-center flex flex-col items-center justify-center space-y-3">
                        <p>Check-in online non ancora effettuato dall'ospite. <br/>Veloce, inviagli l'email di conferma per innescare la richiesta!</p>
                        <a href={`/guest/${id}/checkin`} target="_blank" className="font-bold underline text-indigo-600 block">Compila tu (o usa il tablet in reception)</a>
                     </div>
                  ) : (
                     <div className="space-y-3">
                        {bookingGuests.map((g, i) => (
                            <div key={g.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50 text-xs shadow-sm relative group">
                               <div className="flex justify-between items-start">
                                  <div>
                                     <p className="font-bold text-gray-800 text-sm mb-1">{g.last_name} {g.first_name} <span className="text-gray-400 font-normal">({g.gender})</span></p>
                                     <p className="text-gray-500">Nato il: {formatDateStr(g.birth_date)} • Residenza: {g.residence_city || g.residence_country}</p>
                                     {(g.document_front_url || g.document_back_url) && (
                                        <div className="mt-2 flex gap-2">
                                           {g.document_front_url && <a href={g.document_front_url} target="_blank" className="text-blue-600 font-bold hover:underline">Fronte C.I.</a>}
                                           {g.document_back_url && <a href={g.document_back_url} target="_blank" className="text-blue-600 font-bold hover:underline">Retro C.I.</a>}
                                        </div>
                                     )}
                                  </div>
                                  <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <a href={`/guest/${id}/checkin?edit=${g.id}`} className="bg-white border rounded p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 shadow-sm" title="Modifica Ospite">
                                        <Edit3 className="w-3.5 h-3.5" />
                                     </a>
                                     <button onClick={() => handleDeleteGuest(g.id)} className="bg-white border rounded p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 shadow-sm" title="Elimina Ospite">
                                        <Trash2 className="w-3.5 h-3.5" />
                                     </button>
                                  </div>
                               </div>
                            </div>
                         ))}
                        <div className="text-center w-full">
                           <a href={`/guest/${id}/checkin`} target="_blank" className="text-xs font-bold underline text-indigo-600">Aggiungi altro ospite</a>
                        </div>
                     </div>
                  )}

                  <button onClick={downloadRossXML} disabled={bookingGuests.length === 0} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg flex items-center justify-center transition disabled:opacity-50 disabled:cursor-not-allowed">
                     <Download className="w-4 h-4 mr-2" /> Scarica Tracciato XML (Ross1000)
                  </button>
              </div>

              {/* Box Task Staff */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-4">
                  <h3 className="font-bold flex items-center text-gray-800 border-b border-gray-100 pb-3">
                     <MapPin className="w-5 h-5 mr-2 text-blue-500" /> Assegnazione Personale
                  </h3>
                  <p className="text-xs text-gray-500">Seleziona chi si occupa di questa prenotazione. Ignora per usare i default dell'immobile.</p>
                  
                  <div className="space-y-4 pt-2">
                     <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Incaricato Check-in</label>
                        <select className="w-full border-gray-300 border rounded-lg p-2 text-sm focus:border-blue-500 focus:ring-1"
                          value={staffConfig.checkin_staff_id}
                          onChange={e => setStaffConfig({...staffConfig, checkin_staff_id: e.target.value})}>
                          <option value="">-- Automazione / Default --</option>
                          {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Incaricato Pulizie</label>
                        <select className="w-full border-gray-300 border rounded-lg p-2 text-sm focus:border-blue-500 focus:ring-1"
                          value={staffConfig.cleaning_staff_id}
                          onChange={e => setStaffConfig({...staffConfig, cleaning_staff_id: e.target.value})}>
                          <option value="">-- Automazione / Default --</option>
                          {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Incaricato Check-out</label>
                        <select className="w-full border-gray-300 border rounded-lg p-2 text-sm focus:border-blue-500 focus:ring-1"
                          value={staffConfig.checkout_staff_id}
                          onChange={e => setStaffConfig({...staffConfig, checkout_staff_id: e.target.value})}>
                          <option value="">-- Automazione / Default --</option>
                          {staff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                        </select>
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1 mt-4">Note Pubbliche Personale</label>
                        <textarea className="w-full border-gray-300 border rounded-lg p-2 text-sm text-gray-800" rows={2} value={staffConfig.staff_notes} onChange={e => setStaffConfig({...staffConfig, staff_notes: e.target.value})} placeholder="Es. L'ospite arriva in ritardo..."></textarea>
                     </div>

                     <button disabled={savingStaff} onClick={handleStaffSave} className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center transition">
                        {savingStaff ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salva Assegnazioni
                     </button>
                  </div>
              </div>


              {/* Dettaglio Cassa / Ledger */}
              <BookingFinancials booking={booking} onBookingUpdate={fetchData} staffList={staff} />

          </div>

          {/* LATO DESTRO: Sezione CRM / Chat */}
          <div className="flex-1 w-full bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-140px)]">
             <div className="bg-gray-50 border-b border-gray-200 p-4 shrink-0">
               <h3 className="font-bold text-gray-800 flex items-center">
                 <FileText className="w-5 h-5 mr-2 text-gray-500" />
                 CRM & Chat Prenotazione
               </h3>
               <p className="text-xs text-gray-500">Tutta la storia con l'ospite in un singolo posto.</p>
             </div>

             {/* Area Storico Messaggi */}
             <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-gray-50/50">
               {messages.length === 0 ? (
                 <div className="flex h-full items-center justify-center text-gray-400 text-sm">Nessuna comunicazione in questa pratica.</div>
               ) : (
                 messages.map(msg => {
                    const isSystem = msg.channel === 'system';
                    const isInternal = msg.channel === 'internal';
                    const isOutbound = msg.direction === 'outbound';
                    
                    if (isSystem) {
                      return <div key={msg.id} className="text-center text-xs font-bold text-gray-400 mx-auto w-full my-4 py-2 border-y border-dashed border-gray-200">{msg.content}</div>
                    }

                    if (isInternal) {
                      return <div key={msg.id} className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 w-5/6 mx-auto my-2 text-sm shadow-sm relative">
                         <div className="absolute -top-2 px-2 left-1/2 -translate-x-1/2 bg-amber-200 text-[10px] font-bold rounded-full uppercase">Nota Interna</div>
                         <p className="mt-1">{msg.content}</p>
                          <div className="text-right text-[10px] opacity-60 mt-1">{formatDateTime(msg.created_at)}</div>
                      </div>
                    }

                    return (
                      <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-4`}>
                        <div className={`max-w-[80%] rounded-2xl p-3 text-sm shadow-sm ${
                           isOutbound 
                             ? 'bg-blue-600 text-white rounded-tr-none' 
                             : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none'
                        }`}>
                           <div className={`text-[10px] uppercase font-bold mb-1 flex items-center ${isOutbound ? 'text-blue-200' : 'text-gray-400'}`}>
                              {msg.channel === 'whatsapp' ? <Phone className="w-3 h-3 mr-1" /> : <Mail className="w-3 h-3 mr-1" />}
                              {isOutbound ? 'Da Noi' : 'Dal Cliente'} via {msg.channel}
                           </div>
                           <p className="whitespace-pre-wrap">{msg.content}</p>
                            <div className={`text-right text-[10px] mt-1 ${isOutbound ? 'text-blue-300' : 'text-gray-400'}`}>{formatDateTime(msg.created_at)}</div>
                        </div>
                      </div>
                    );
                 })
               )}
             </div>

             {/* Area Input Chat */}
             <div className="border-t border-gray-200 bg-white p-4 shrink-0">
                <div className="flex mb-3 border-b border-gray-200">
                   <button onClick={() => setChatType('internal')} className={`px-4 py-2.5 text-sm font-bold border-b-2 flex transition-colors ${chatType === 'internal' ? 'border-amber-500 text-amber-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                      Nota Segreta
                   </button>
                   <button onClick={() => setChatType('whatsapp')} className={`px-4 py-2.5 text-sm font-bold border-b-2 flex transition-colors ${chatType === 'whatsapp' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                      <Phone className="w-4 h-4 mr-1.5" /> WhatsApp
                   </button>
                   <button onClick={() => setChatType('email')} className={`px-4 py-2.5 text-sm font-bold border-b-2 flex transition-colors ${chatType === 'email' ? 'border-blue-500 text-blue-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                      <Mail className="w-4 h-4 mr-1.5" /> Email
                   </button>
                </div>
                
                <div className="relative">
                   <textarea 
                     value={chatContent}
                     onChange={e => setChatContent(e.target.value)}
                     disabled={sendingMsg}
                     placeholder={
                       chatType === 'internal' ? 'Scrivi una nota visibile solo ai manager...' :
                       chatType === 'whatsapp' ? 'Scrivi un messaggio chat via Whatsapp...' :
                       'Scrivi una risposta email al cliente...'
                     }
                     className={`w-full border rounded-xl p-3 pr-16 text-sm focus:outline-none focus:ring-2 resize-none h-24 ${
                        chatType === 'internal' ? 'bg-amber-50 border-amber-200 focus:ring-amber-500' :
                        chatType === 'whatsapp' ? 'bg-emerald-50 border-emerald-200 focus:ring-emerald-500' :
                        'bg-blue-50 border-blue-200 focus:ring-blue-500'
                     }`}
                   />
                   <button disabled={sendingMsg || !chatContent.trim()} onClick={handeSendMessage} className={`absolute bottom-3 right-3 p-2.5 rounded-full text-white transition-all shadow-md flex items-center justify-center ${
                      chatType === 'internal' ? 'bg-amber-600 hover:bg-amber-700' :
                      chatType === 'whatsapp' ? 'bg-emerald-600 hover:bg-emerald-700' :
                      'bg-blue-600 hover:bg-blue-700'
                   } disabled:opacity-50 disabled:cursor-not-allowed`}>
                      {sendingMsg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                   </button>
                </div>
              </div>
           </div>
        
     {isEditBookingModal && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
               <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                  <h2 className="text-xl font-bold flex items-center text-gray-800">
                     Modifica Soggiorno
                  </h2>
                  <button onClick={() => setIsEditBookingModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500"><X className="w-5 h-5"/></button>
               </div>
               
               <form onSubmit={handleSaveBookingParams} className="flex flex-col flex-1 overflow-y-auto">
                  <div className="p-6 space-y-4">
                     <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Immobile</label>
                        <select 
                           value={editBookingForm.property_id || ''} 
                           onChange={e => setEditBookingForm({...editBookingForm, property_id: e.target.value})}
                           required className="w-full border border-gray-300 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                           {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                     </div>
                     <div className="flex gap-4">
                        <div className="flex-1">
                           <label className="block text-sm font-bold text-gray-700 mb-1">Check-in</label>
                           <input type="date" value={editBookingForm.check_in_date || ''} onChange={e => setEditBookingForm({...editBookingForm, check_in_date: e.target.value})} required className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="flex-1">
                           <label className="block text-sm font-bold text-gray-700 mb-1">Check-out</label>
                           <input type="date" value={editBookingForm.check_out_date || ''} onChange={e => setEditBookingForm({...editBookingForm, check_out_date: e.target.value})} required className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                     </div>
                      <div className="flex gap-3">
                         <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Adulti (≥ 12 anni)</label>
                            <input type="number" min="1" value={editBookingForm.adults_count || 1} onChange={e => setEditBookingForm({...editBookingForm, adults_count: parseInt(e.target.value)})} required className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                         </div>
                         <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Bambini (&le; {booking?.properties?.city_tax_child_age || 11} anni)</label>
                            <input type="number" min="0" value={editBookingForm.children_count || 0} onChange={e => setEditBookingForm({...editBookingForm, children_count: parseInt(e.target.value)})} required className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                         </div>
                         <div className="flex-1">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Animali</label>
                            <input type="number" min="0" value={editBookingForm.pets_count || 0} onChange={e => setEditBookingForm({...editBookingForm, pets_count: parseInt(e.target.value)})} required className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                         </div>
                      </div>
                      <div>
                         <label className="block text-sm font-bold text-gray-700 mb-1">Prezzo Totale Soggiorno (€)</label>
                         <input type="number" step="0.01" min="0" value={editBookingForm.total_price || 0} onChange={e => setEditBookingForm({...editBookingForm, total_price: parseFloat(e.target.value)})} required className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg font-bold text-blue-800" />
                      </div>
                      <div>
                         <label className="block text-sm font-bold text-gray-700 mb-1">Portale / Canale di provenienza</label>
                         <select
                            value={editBookingForm.channel_id || ''}
                            onChange={e => setEditBookingForm({...editBookingForm, channel_id: e.target.value})}
                            className="w-full border border-gray-300 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 outline-none"
                         >
                            <option value="">-- Nessun canale --</option>
                            {channels.map(c => <option key={c.id} value={c.id}>{c.name} (Com. {c.commission_pct}% / Tax {c.tax_pct}%)</option>)}
                         </select>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-1">
                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Riepilogo Costi & Margine</p>
                        <div className="flex justify-between text-xs text-gray-600"><span>Costo Staff</span><span className="font-medium">{formatCurrency(booking.staff_cost)}</span></div>
                        <div className="flex justify-between text-xs text-gray-600"><span>Costo Servizi</span><span className="font-medium">{formatCurrency(booking.services_cost)}</span></div>
                        {(() => {
                          const ch = channels.find(c => c.id === editBookingForm.channel_id);
                          const tp = Number(editBookingForm.total_price || 0);
                          const comm = ch ? Math.round(tp * Number(ch.commission_pct || 0) / 100 * 100) / 100 : Number(booking.commission_amount || 0);
                          const tax = ch ? Math.round(tp * Number(ch.tax_pct || 0) / 100 * 100) / 100 : Number(booking.tax_amount || 0);
                          const staff = Number(booking.staff_cost || 0);
                          const svc = Number(booking.services_cost || 0);
                          const totalCost = staff + svc + comm + tax;
                          const margin = tp > 0 ? Math.round((tp - totalCost) / tp * 100 * 10) / 10 : 0;
                          return (
                            <>
                              <div className="flex justify-between text-xs text-gray-600"><span>Commissioni</span><span className="font-medium">- {formatCurrency(comm)}</span></div>
                              <div className="flex justify-between text-xs text-gray-600"><span>Tasse</span><span className="font-medium">- {formatCurrency(tax)}</span></div>
                              <div className="flex justify-between text-xs font-bold text-gray-800 pt-1 border-t border-gray-200 mt-1"><span>Costi Totali</span><span>{formatCurrency(totalCost)}</span></div>
                              <div className="flex justify-between text-xs font-bold pt-0.5"><span className={margin >= 0 ? 'text-emerald-700' : 'text-red-700'}>Margine</span><span className={margin >= 0 ? 'text-emerald-700' : 'text-red-700'}>{formatPercent(margin)}</span></div>
                            </>
                          );
                        })()}
                      </div>
                   </div>
                  <div className="p-6 border-t bg-gray-50 flex gap-3">
                     <button type="button" onClick={() => setIsEditBookingModal(false)} className="flex-1 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold py-3 rounded-xl transition">Annulla</button>
                     <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition text-sm">Salva Modifiche</button>
                  </div>
               </form>
            </div>
         </div>
     )}
      </div>
    </div>
  );
}
