"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, use, Suspense } from "react";
import { supabase } from "@/utils/supabase/client";
import { Loader2, Upload, FileImageIcon, CheckCircle2, User, Calendar, MapPin, Search, FileText, ArrowLeft, Home } from "lucide-react";
import toast from "react-hot-toast";
import { formatDateRange } from "@/lib/format";

type GuestForm = {
  type: string;
  first_name: string;
  last_name: string;
  gender: string;
  birth_date: string;
  citizenship: string;
  birth_country: string;
  birth_city: string;
  birth_city_code: string;
  residence_country: string;
  residence_city: string;
  residence_city_code: string;
  residence_address: string;
  document_type: string;
  document_number: string;
  document_issue_country: string;
  document_issue_city: string;
  document_issue_city_code: string;
  document_front_url: string;
  document_back_url: string;
  document_front_file: File | null;
  document_back_file: File | null;
};

const COMMON_COUNTRIES = [
  { code: "100000100", name: "Italia" },
  { code: "100000115", name: "Albania" },
  { code: "100000122", name: "Austria" },
  { code: "100000123", name: "Belgio" },
  { code: "100000127", name: "Francia" },
  { code: "100000128", name: "Germania" },
  { code: "100000130", name: "Regno Unito" },
  { code: "100000131", name: "Spagna" },
  { code: "100000132", name: "Svizzera" },
  { code: "100000135", name: "Croazia" },
  { code: "100000139", name: "Grecia" },
  { code: "100000140", name: "Irlanda" },
  { code: "100000142", name: "Olanda/Paesi Bassi" },
  { code: "100000144", name: "Polonia" },
  { code: "100000145", name: "Portogallo" },
  { code: "100000146", name: "Romania" },
  { code: "100000148", name: "Svezia" },
  { code: "100000216", name: "Canada" },
  { code: "100000244", name: "Stati Uniti d'America" },
  { code: "100000314", name: "Giappone" },
  { code: "100000326", name: "Cina" },
  { code: "100000435", name: "Australia" },
];

// Autocomplete comune italiano (codice ISTAT ufficiale per ross1000)
function ComuneAutocomplete({ value, code, onChange }: { value: string; code: string; onChange: (name: string, codice: string) => void }) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setQuery(value);
    setDirty(false);
  }, [value]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      const { data } = await supabase
        .from('comuni_istat')
        .select('codice, descrizione, provincia')
        .ilike('descrizione', `%${query.trim().toUpperCase()}%`)
        .order('descrizione', { ascending: true })
        .limit(12);
      setResults(data || []);
      if (dirty) setOpen(true);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query, dirty]);

  return (
    <div className="relative">
      <input
        type="text"
        required
        value={query}
        onChange={e => { setQuery(e.target.value); setDirty(true); onChange(e.target.value, ""); }}
        onFocus={() => { if (results.length && dirty) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="Digita il comune..."
        className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none"
      />
      {open && results.length > 0 && dirty && (
        <div className="absolute z-20 mt-1 w-full bg-white border-2 border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {results.map(r => (
            <button
              key={r.codice}
              type="button"
              onMouseDown={e => { e.preventDefault(); setQuery(r.descrizione); onChange(r.descrizione, r.codice); setOpen(false); }}
              className={`w-full text-left px-4 py-2 hover:bg-blue-50 text-sm ${r.codice === code ? "bg-blue-50 font-bold" : ""}`}
            >
              {r.descrizione} ({r.provincia}) <span className="text-gray-400 text-xs ml-1">{r.codice}</span>
            </button>
          ))}
        </div>
      )}
      {loading && <p className="text-xs text-gray-400 mt-1">Ricerca...</p>}
      {code && <p className="text-xs text-green-600 font-bold mt-1">Codice: {code}</p>}
    </div>
  );
}

const initialForm = (): GuestForm => ({  type: "17",
  first_name: "",
  last_name: "",
  gender: "M",
  birth_date: "",
  citizenship: "100000100",
  birth_country: "100000100",
  birth_city: "",
  birth_city_code: "",
  residence_country: "100000100",
  residence_city: "",
  residence_city_code: "",
  residence_address: "",
  document_type: "IDELE",
  document_number: "",
  document_issue_country: "100000100",
  document_issue_city: "",
  document_issue_city_code: "",
  document_front_url: "",
  document_back_url: "",
  document_front_file: null,
  document_back_file: null
});

// Wrapper asincrono per params
export default function GuestCheckinWrapper({ params }: { params: Promise<{ id: string }> }) {
  const unwrappedParams = use(params);
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50">Caricamento...</div>}>
       <GuestCheckinPage bookingId={unwrappedParams.id} />
    </Suspense>
  );
}

function GuestCheckinPage({ bookingId }: { bookingId: string }) {
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState<GuestForm>(initialForm());
  const [previewFront, setPreviewFront] = useState<string>("");
  const [previewBack, setPreviewBack] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [completed, setCompleted] = useState(false);

  // Ospiti già registrati per questa prenotazione
  const [existingGuests, setExistingGuests] = useState<any[]>([]);
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  // Quando l'utente vuole aggiungere un nuovo ospite dopo aver visto la lista
  const [showNewForm, setShowNewForm] = useState(false);
  const [docTypes, setDocTypes] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('tipi_documento').select('codice, descrizione').order('descrizione').then(({ data }) => setDocTypes(data || []));
  }, []);

  useEffect(() => {
    async function fetchBooking() {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, properties(name, logo_url)')
        .eq('id', bookingId)
        .single();

      if (error || !data) {
        setError("Prenotazione non trovata o link scaduto.");
        setLoading(false);
        return;
      }
      setBooking(data);

      // Carica ospiti già registrati
      const { data: guests } = await supabase
        .from('booking_guests')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });

      const registered = guests || [];
      setExistingGuests(registered);
      setAddedCount(registered.length);

      // Se ci sono ospiti già registrati e nessun editId, mostra la lista
      if (registered.length > 0 && !editId) {
        setShowNewForm(false); // mostra lista, non il form
      }

      // Se editId è presente, carica quell'ospite
      if (editId) {
        const guestToEdit = registered.find(g => g.id === editId);
        if (guestToEdit) {
          const legacyDocMap: Record<string, string> = { "CARTA IDENTITA": "IDENT", "PASSAPORTO": "PASOR", "PATENTE": "PATEN" };
          const clean: Record<string, any> = {};
          for (const [k, v] of Object.entries(guestToEdit)) {
            clean[k] = v === null ? "" : v;
          }
          setForm({
            ...initialForm(),
            ...clean,
            document_type: legacyDocMap[guestToEdit.document_type] || guestToEdit.document_type || "IDELE",
            document_front_file: null,
            document_back_file: null,
          });
          setEditingGuestId(editId);
          setShowNewForm(true);
        }
      }

      setLoading(false);
    }
    fetchBooking();
  }, [bookingId]);

  const totalGuests = (booking?.adults_count || 0) + (booking?.children_count || 0) || booking?.guests_count || 1;

  // Ridimensiona immagini prima dell'upload (max 1600px, jpeg q=0.8). I PDF restano invariati.
  const resizeImage = async (file: File): Promise<File> => {
    if (!file.type.startsWith("image/")) return file;
    const MAX_DIM = 1600;
    const bitmap = await createImageBitmap(file);
    const ratio = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * ratio));
    const h = Math.max(1, Math.round(bitmap.height * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close(); return file; }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.8));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    const resized = await resizeImage(file);
    const fileExt = resized.name.split('.').pop();
    const fileName = `${bookingId}_${Date.now()}_${Math.random()}.${fileExt}`;
    const filePath = `documents/${fileName}`;
    const { error } = await supabase.storage.from('guest_documents').upload(filePath, resized, { contentType: resized.type });
    if (error) { console.error('Upload error:', error); return null; }
    const { data } = supabase.storage.from('guest_documents').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    toast.loading("Invio dati in corso...");

    try {
      let frontUrl = "";
      let backUrl = "";

      // Validazione anno nascita
      const birthYear = parseInt(form.birth_date?.split("-")[0] || "0");
      if (birthYear < 1900 || birthYear > 2100) throw new Error("Anno di nascita non valido");

      if (["16", "17", "18"].includes(form.type)) {
        if (!form.document_front_file && !form.document_front_url) throw new Error("Documento fronte obbligatorio per Capofamiglia/Capogruppo/Singolo.");
      }

      // Codici ufficiali Polizia per comuni italiani (ross1000 li richiede)
      if (form.residence_country === "100000100" && !form.residence_city_code) throw new Error("Seleziona il comune di residenza dall'elenco (codice ISTAT obbligatorio).");
      if (form.birth_country === "100000100" && form.birth_city && !form.birth_city_code) throw new Error("Seleziona il comune di nascita dall'elenco (codice ISTAT obbligatorio).");
      if (!form.document_type) throw new Error("Seleziona il tipo di documento.");
      
      if (form.document_front_file) {
        const resUrl = await uploadFile(form.document_front_file);
        if (resUrl) frontUrl = resUrl;
        else { toast.dismiss(); throw new Error("Caricamento fronte documento fallito"); }
      }
      if (form.document_back_file) {
        const backResUrl = await uploadFile(form.document_back_file);
        if (backResUrl) backUrl = backResUrl;
        else { toast.dismiss(); throw new Error("Caricamento retro documento fallito"); }
      }

      const payload: Record<string, any> = {
        booking_id: bookingId,
        type: form.type,
        first_name: form.first_name,
        last_name: form.last_name,
        gender: form.gender,
        birth_date: form.birth_date,
        citizenship: form.citizenship,
        birth_country: form.birth_country,
        birth_city: form.birth_city,
        birth_city_code: form.birth_city_code,
        residence_country: form.residence_country,
        residence_city: form.residence_city,
        residence_city_code: form.residence_city_code,
        residence_address: form.residence_address,
        document_type: form.document_type,
        document_number: form.document_number,
        document_issue_country: form.document_issue_country,
        document_issue_city: form.document_issue_city,
        document_issue_city_code: form.document_issue_city_code,
      };

      // Solo se c'è un nuovo upload, aggiorna l'URL
      if (frontUrl) payload.document_front_url = frontUrl;
      if (backUrl) payload.document_back_url = backUrl;

      if (editingGuestId) {
        const { error: dbError } = await supabase.from('booking_guests').update(payload).eq('id', editingGuestId);
        if (dbError) throw dbError;
        toast.dismiss();
        toast.success("Ospite aggiornato!");
      } else {
        const { error: dbError } = await supabase.from('booking_guests').insert(payload);
        if (dbError) throw dbError;
        toast.dismiss();
        toast.success("Ospite registrato!");
      }

      // Ricarica la lista ospiti
      const { data: guests } = await supabase
        .from('booking_guests')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true });
      setExistingGuests(guests || []);
      setAddedCount(guests?.length || 0);

      // Resetta form
      setForm(initialForm());
      setPreviewFront("");
      setPreviewBack("");
      setEditingGuestId(null);
      setShowNewForm(false);

      if (guests && booking?.guests_count && guests.length >= totalGuests) {
        setCompleted(true);
      }
    } catch(err: any) {
      toast.dismiss();
      toast.error(err.message || "Errore sconosciuto.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-50"><Loader2 className="w-10 h-10 animate-spin text-blue-600"/></div>;
  if (error || !booking) return <div className="flex h-screen items-center justify-center p-4 text-center text-gray-500">{error}<br/></div>;

  if (completed) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
         <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
               <CheckCircle2 className="w-8 h-8 text-green-600"/>
            </div>
             <h2 className="text-2xl font-bold text-gray-900 mb-2">Check-in Completato</h2>
              <p className="text-gray-500">Grazie per aver inserito i dati per tutti gli ospiti. Ti aspettiamo presso {booking.properties?.name}!</p>
              <a href={`/guest/${bookingId}`} className="mt-6 inline-flex items-center gap-1 text-blue-600 font-bold hover:underline text-sm">
                <ArrowLeft className="w-3.5 h-3.5" /> Torna al portal
              </a>
         </div>
      </div>
    );
  }

  const isLeader = ["16", "17", "18"].includes(form.type);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-blue-700 to-blue-500 rounded-2xl p-6 mb-8 text-white shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between gap-3 mb-3">
            <a href={`/guest/${bookingId}`} className="inline-flex items-center gap-1 text-blue-200 hover:text-white text-xs font-bold transition">
              <ArrowLeft className="w-3.5 h-3.5" /> Torna al portal
            </a>
          </div>
          <div className="relative z-10">
             <div className="flex items-center gap-3 mb-1">
                {booking.properties?.logo_url ? (
                  <img src={booking.properties.logo_url} alt="Logo struttura" className="w-10 h-10 rounded-full bg-white/20 object-cover border border-white/40" />
                ) : (
                  <Home className="w-10 h-10 opacity-80" />
                )}
               <h1 className="text-2xl font-extrabold">Registrazione Ospiti</h1>
             </div>
             <p className="text-blue-100 font-medium opacity-90"><MapPin className="inline w-4 h-4 mr-1"/> {booking.properties?.name}</p>
             <div className="mt-4 flex flex-col md:flex-row gap-4 divide-y md:divide-y-0 md:divide-x divide-blue-400">
               <div className="pt-2 md:pt-0">
                  <div className="text-blue-200 text-xs uppercase font-bold tracking-wider">Ospite Principale</div>
                  <div className="font-bold">{booking.guest_name}</div>
               </div>
               <div className="pt-2 md:pt-0 md:pl-4">
                  <div className="text-blue-200 text-xs uppercase font-bold tracking-wider">Date Soggiorno</div>
                  <div className="font-bold"><Calendar className="inline w-3.5 h-3.5 mr-1" /> {formatDateRange(booking.check_in_date, booking.check_out_date)}</div>
               </div>
               <div className="pt-2 md:pt-0 md:pl-4">
                  <div className="text-blue-200 text-xs uppercase font-bold tracking-wider">Ospiti Da Registrare</div>
                  <div className="font-bold">{addedCount} / {totalGuests}</div>
                  <div className="text-blue-100 text-xs">Adulti: {booking.adults_count || 1} | Bambini: {booking.children_count || 0}</div>
               </div>
             </div>
          </div>
          <User className="absolute -right-6 -bottom-10 w-48 h-48 text-white opacity-10 pointer-events-none"/>
        </div>

        {/* Lista ospiti già registrati */}
        {existingGuests.length > 0 && !showNewForm && !editingGuestId && (
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Ospiti Registrati</h2>
            <div className="space-y-3">
                  {existingGuests.map(guest => (
                <div key={guest.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-800">{guest.first_name} {guest.last_name}</p>
                      <p className="text-xs text-gray-500">
                        {(docTypes.find(dt => dt.codice === guest.document_type)?.descrizione || guest.document_type)} · {guest.document_number || "N/D"}
                      </p>
                    </div>
                    <button
                      onClick={() => {
          const legacyDocMap: Record<string, string> = { "CARTA IDENTITA": "IDENT", "CARTA IDENTITA' ELETTRONICA": "IDELE", "PASSAPORTO": "PASOR", "PATENTE": "PATEN" };
          const clean: Record<string, any> = {};
          for (const [k, v] of Object.entries(guest)) {
            clean[k] = v === null ? "" : v;
          }
                        setForm({
                          ...initialForm(),
                          ...clean,
                          document_type: legacyDocMap[guest.document_type] || guest.document_type || "IDELE",
                          document_front_file: null,
                          document_back_file: null,
                        });
                        setEditingGuestId(guest.id);
                        setShowNewForm(true);
                      }}
                      className="text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-full hover:bg-blue-100"
                    >
                      Modifica
                    </button>
                  </div>
                  {(guest.document_front_url || guest.document_back_url) && (
                    <div className="flex gap-2 mt-3">
                      {guest.document_front_url && (
                        <a href={guest.document_front_url} target="_blank" rel="noopener noreferrer" className="block relative w-20 h-14 rounded-lg overflow-hidden border border-gray-200 bg-white hover:ring-2 hover:ring-blue-400 transition flex items-center justify-center">
                          {guest.document_front_url.endsWith('.pdf') ? (
                            <FileText className="w-6 h-6 text-red-500" />
                          ) : (
                            <img src={guest.document_front_url} alt="Fronte documento" className="w-full h-full object-cover" />
                          )}
                        </a>
                      )}
                      {guest.document_back_url && (
                        <a href={guest.document_back_url} target="_blank" rel="noopener noreferrer" className="block relative w-20 h-14 rounded-lg overflow-hidden border border-gray-200 bg-white hover:ring-2 hover:ring-blue-400 transition flex items-center justify-center">
                          {guest.document_back_url.endsWith('.pdf') ? (
                            <FileText className="w-6 h-6 text-red-500" />
                          ) : (
                            <img src={guest.document_back_url} alt="Retro documento" className="w-full h-full object-cover" />
                          )}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {addedCount < totalGuests && (
              <button
                onClick={() => {
                  setForm(initialForm());
                  setEditingGuestId(null);
                  setShowNewForm(true);
                }}
                className="w-full mt-4 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition"
              >
                + Aggiungi un altro ospite
              </button>
            )}
          </div>
        )}

        {/* Form di inserimento/modifica */}
        {(showNewForm || editingGuestId) && (
        <form onSubmit={handleSubmit} className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 md:p-8">
           <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">
             {editingGuestId ? `Modifica ${form.first_name} ${form.last_name}` : `Inserisci generalità ospite ${addedCount + 1}`}
           </h2>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 block">Tipo Alloggiato *</label>
                <select value={form.type} onChange={e=>setForm({...form, type: e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:ring-4 focus:ring-blue-500/20 font-bold text-gray-800 outline-none transition">
                   {addedCount === 0 ? (
                      <>
                        <option value="16">Ospite Singolo (16)</option>
                        <option value="17">Capo Famiglia (17)</option>
                        <option value="18">Capo Gruppo (18)</option>
                      </>
                   ) : (
                      <>
                        <option value="17">Capo Famiglia (17)</option>
                        <option value="18">Capo Gruppo (18)</option>
                        <option value="19">Familiare (19)</option>
                        <option value="20">Membro Gruppo (20)</option>
                        <option value="16">Ospite Singolo (16)</option>
                      </>
                   )}
                </select>
             </div>

             <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Nome *</label>
                <input type="text" required value={form.first_name} onChange={e=>setForm({...form, first_name: e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none" />
             </div>
             <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Cognome *</label>
                <input type="text" required value={form.last_name} onChange={e=>setForm({...form, last_name: e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none" />
             </div>
             <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Sesso *</label>
                <select value={form.gender} onChange={e=>setForm({...form, gender: e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none">
                   <option value="M">Maschio</option>
                   <option value="F">Femmina</option>
                </select>
             </div>
             <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Data di Nascita *</label>
                <input type="date" required value={form.birth_date} onChange={e=>setForm({...form, birth_date: e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none" />
             </div>

             <div className="md:col-span-2 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-bold text-gray-800 mb-4">Dati Territoriali (Usa codici se estero)</h3>
             </div>
             <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Cittadinanza *</label>
                <select required value={COMMON_COUNTRIES.find(c => c.code === form.citizenship) ? form.citizenship : "ESTERO_ALTRO"} onChange={e=>{
                   if(e.target.value === "ESTERO_ALTRO") setForm({...form, citizenship: ""});
                   else setForm({...form, citizenship: e.target.value});
                }} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none bg-white">
                   <option value="" disabled>Seleziona Cittadinanza</option>
                   {COMMON_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
                   <option value="ESTERO_ALTRO">Altro (Inserimento manuale)</option>
                </select>
                {(!COMMON_COUNTRIES.find(c => c.code === form.citizenship) && form.citizenship !== "100000100") && (
                   <input type="text" required value={form.citizenship} onChange={e=>setForm({...form, citizenship: e.target.value})} placeholder="Es. 100000185 (Codice Stato)" className="w-full mt-2 border-2 border-orange-200 p-3 rounded-xl focus:border-orange-500 outline-none bg-orange-50" />
                )}
             </div>
              <div>
                 <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Comune di Nascita</label>
                 {form.birth_country === "100000100" ? (
                    <ComuneAutocomplete value={form.birth_city} code={form.birth_city_code} onChange={(name, codice) => setForm({...form, birth_city: name, birth_city_code: codice})} />
                 ) : (
                    <input type="text" value={form.birth_city} onChange={e=>setForm({...form, birth_city: e.target.value, birth_city_code: ""})} placeholder="Es. Nome località estera" className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none" />
                 )}
              </div>

             <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Stato di Residenza *</label>
                <select required value={COMMON_COUNTRIES.find(c => c.code === form.residence_country) ? form.residence_country : "ESTERO_ALTRO"} onChange={e=>{
                   if(e.target.value === "ESTERO_ALTRO") setForm({...form, residence_country: "", residence_city: "", residence_city_code: ""});
                   else setForm({...form, residence_country: e.target.value, residence_city: "", residence_city_code: ""});
                }} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none bg-white">
                   <option value="" disabled>Seleziona Stato</option>
                   {COMMON_COUNTRIES.map(c => <option key={`res_${c.code}`} value={c.code}>{c.name} ({c.code})</option>)}
                   <option value="ESTERO_ALTRO">Altro (Inserimento manuale)</option>
                </select>
                {(!COMMON_COUNTRIES.find(c => c.code === form.residence_country) && form.residence_country !== "100000100") && (
                   <input type="text" required value={form.residence_country} onChange={e=>setForm({...form, residence_country: e.target.value})} placeholder="Es. 100000185 (Codice Stato)" className="w-full mt-2 border-2 border-orange-200 p-3 rounded-xl focus:border-orange-500 outline-none bg-orange-50" />
                )}
             </div>
              <div>
                 <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Comune di Residenza *</label>
                 {form.residence_country === "100000100" ? (
                    <ComuneAutocomplete value={form.residence_city} code={form.residence_city_code} onChange={(name, codice) => setForm({...form, residence_city: name, residence_city_code: codice})} />
                 ) : (
                    <input type="text" required value={form.residence_city} onChange={e=>setForm({...form, residence_city: e.target.value, residence_city_code: ""})} placeholder="CAP Estero" className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none" />
                 )}
              </div>

             {/* SOLO PER CAPOGRUPPO / CAPOFAMIGLIA */}
             <div className="md:col-span-2 pt-4 border-t border-gray-100 mt-2">
                <h3 className="text-sm font-bold text-gray-800 mb-1">Documento Identità</h3>
                <p className="text-gray-500 text-xs mb-4">Obbligatorio per i capi gruppo/famiglia e ospiti singoli. Opzionale per i restanti.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Tipo Documento {isLeader && '*'}</label>
                      <select required={isLeader} value={form.document_type} onChange={e=>setForm({...form, document_type: e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none">
                         <option value="" disabled>Seleziona</option>
                         {docTypes.map(dt => <option key={dt.codice} value={dt.codice}>{dt.codice} — {dt.descrizione}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Numero Documento {isLeader && '*'}</label>
                      <input type="text" required={isLeader} value={form.document_number} onChange={e=>setForm({...form, document_number: e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none uppercase" />
                   </div>
                   <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Stato di Rilascio {isLeader && '*'}</label>
                      <select required={isLeader} value={COMMON_COUNTRIES.find(c => c.code === form.document_issue_country) ? form.document_issue_country : "ESTERO_ALTRO"} onChange={e=>{
                         if(e.target.value === "ESTERO_ALTRO") setForm({...form, document_issue_country: "", document_issue_city: "", document_issue_city_code: ""});
                         else setForm({...form, document_issue_country: e.target.value, document_issue_city: "", document_issue_city_code: ""});
                      }} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none bg-white">
                         <option value="" disabled>Seleziona Stato</option>
                         {COMMON_COUNTRIES.map(c => <option key={`drel_${c.code}`} value={c.code}>{c.name} ({c.code})</option>)}
                         <option value="ESTERO_ALTRO">Altro (Inserimento manuale)</option>
                      </select>
                      {(!COMMON_COUNTRIES.find(c => c.code === form.document_issue_country) && form.document_issue_country !== "100000100") && (
                         <input type="text" required={isLeader} value={form.document_issue_country} onChange={e=>setForm({...form, document_issue_country: e.target.value})} placeholder="Es. 100000185 (Codice Stato)" className="w-full mt-2 border-2 border-orange-200 p-3 rounded-xl focus:border-orange-500 outline-none bg-orange-50" />
                      )}
                   </div>
                   <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Comune di Rilascio {isLeader && '*'}</label>
                      {form.document_issue_country === "100000100" ? (
                         <ComuneAutocomplete value={form.document_issue_city} code={form.document_issue_city_code} onChange={(name, codice) => setForm({...form, document_issue_city: name, document_issue_city_code: codice})} />
                      ) : (
                         <input type="text" required={isLeader} value={form.document_issue_city} onChange={e=>setForm({...form, document_issue_city: e.target.value, document_issue_city_code: ""})} placeholder="Luogo di rilascio estero" className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none" />
                      )}
                   </div>
                </div>
             </div>

              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <label className="border-2 border-dashed border-gray-300 rounded-2xl p-4 bg-gray-50 min-h-[8rem] flex flex-col items-center justify-center text-center cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition">
                   {(form.document_front_url && !form.document_front_file) || previewFront ? (
                     <>
                       {(previewFront || form.document_front_url).endsWith('.pdf') ? (
                         <FileText className="w-10 h-10 text-red-400 mb-2" />
                       ) : (
                         <img src={previewFront || form.document_front_url} alt="Fronte documento" className="max-h-24 object-contain mb-2 rounded" />
                       )}
                     </>
                   ) : (
                     <Upload className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                   )}
                   <span className="text-sm font-bold text-gray-700 block">
                     {form.document_front_file ? form.document_front_file.name : form.document_front_url ? 'Clicca per cambiare' : 'Carica Fronte Documento'}
                   </span>
                   <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => {
                     if (e.target.files) {
                       const file = e.target.files[0];
                       setForm({...form, document_front_file: file});
                       if (file) setPreviewFront(URL.createObjectURL(file));
                     }
                   }} />
                </label>

                <label className="border-2 border-dashed border-gray-300 rounded-2xl p-4 bg-gray-50 min-h-[8rem] flex flex-col items-center justify-center text-center cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition">
                   {(form.document_back_url && !form.document_back_file) || previewBack ? (
                     <>
                       {(previewBack || form.document_back_url).endsWith('.pdf') ? (
                         <FileText className="w-10 h-10 text-red-400 mb-2" />
                       ) : (
                         <img src={previewBack || form.document_back_url} alt="Retro documento" className="max-h-24 object-contain mb-2 rounded" />
                       )}
                     </>
                   ) : (
                     <Upload className="w-6 h-6 mx-auto mb-1 text-gray-400" />
                   )}
                   <span className="text-sm font-bold text-gray-700 block">
                     {form.document_back_file ? form.document_back_file.name : form.document_back_url ? 'Clicca per cambiare' : 'Carica Retro Documento'}
                   </span>
                   <input type="file" className="hidden" accept="image/*,.pdf" onChange={e => {
                     if (e.target.files) {
                       const file = e.target.files[0];
                       setForm({...form, document_back_file: file});
                       if (file) setPreviewBack(URL.createObjectURL(file));
                     }
                   }} />
                </label>
             </div>
           </div>

           <div className="flex gap-3 mt-8">
              {editingGuestId && (
               <button type="button" onClick={() => { setForm(initialForm()); setPreviewFront(""); setPreviewBack(""); setEditingGuestId(null); setShowNewForm(false); }}
                 className="flex-1 bg-gray-200 text-gray-700 font-bold text-lg py-4 rounded-xl hover:bg-gray-300 transition">
                 Annulla
               </button>
             )}
             <button type="submit" disabled={isSubmitting} className={`${editingGuestId ? 'flex-1' : 'w-full'} bg-gray-900 text-white font-bold text-lg py-4 rounded-xl hover:bg-black transition shadow-lg flex items-center justify-center disabled:opacity-50`}>
               {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin mr-2"/> : <CheckCircle2 className="w-6 h-6 mr-2"/>}
               {isSubmitting ? 'Salvataggio...' : editingGuestId ? 'Salva Modifiche' : `Conferma e Aggiungi Ospite (${addedCount + 1}/${totalGuests})`}
             </button>
           </div>
        </form>
        )}

        {/* Stato iniziale: nessun ospite ancora registrato, mostra pulsante per iniziare */}
        {existingGuests.length === 0 && !showNewForm && !editingGuestId && (
          <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-12 text-center">
            <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Nessun ospite registrato</h2>
            <p className="text-gray-500 mb-6">Inizia inserendo i dati del primo ospite.</p>
            <button
              onClick={() => setShowNewForm(true)}
              className="bg-blue-600 text-white font-bold px-8 py-4 rounded-xl hover:bg-blue-700 transition text-lg"
            >
              Inizia Registrazione
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
