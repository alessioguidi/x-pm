"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, use, Suspense } from "react";
import { supabase } from "@/utils/supabase/client";
import { Loader2, Upload, FileImageIcon, CheckCircle2, User, Calendar, MapPin, Search } from "lucide-react";
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
  residence_country: string;
  residence_city: string;
  residence_address: string;
  document_type: string;
  document_number: string;
  document_issue_country: string;
  document_issue_city: string;
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

const initialForm = (): GuestForm => ({
  type: "17", // Default Capo Famiglia
  first_name: "",
  last_name: "",
  gender: "M",
  birth_date: "",
  citizenship: "100000100", // Italia default
  birth_country: "100000100",
  birth_city: "",
  residence_country: "100000100",
  residence_city: "",
  residence_address: "",
  document_type: "CARTA IDENTITA",
  document_number: "",
  document_issue_country: "100000100",
  document_issue_city: "",
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
        async function fetchBooking() {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, properties(name)')
        .eq('id', bookingId)
        .single();
      
      if (error || !data) {
        setError("Prenotazione non trovata o link scaduto.");
      } else {
        setBooking(data);
        if (editId) {
            const { data: guestData } = await supabase.from('booking_guests').select('*').eq('id', editId).single();
            if (guestData) {
               setForm({
                 ...initialForm(),
                 ...guestData,
                 document_front_file: null,
                 document_back_file: null
               });
            }
        }
      }
      setLoading(false);
    }
    fetchBooking();
  }, [bookingId]);

  const uploadFile = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${bookingId}_${Date.now()}_${Math.random()}.${fileExt}`;
    const filePath = `documents/${fileName}`;
    const { error } = await supabase.storage.from('guest_documents').upload(filePath, file);
    if (error) return null;
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

      // Upload documenti se espliciti
      if (["16", "17", "18"].includes(form.type)) {
        if (!form.document_front_file) throw new Error("Documento fronte obbligatorio per Capofamiglia/Capogruppo/Singolo.");
      }
      
      if (form.document_front_file) {
        const resUrl = await uploadFile(form.document_front_file);
        if (resUrl) frontUrl = resUrl;
      }
      if (form.document_back_file) {
        const backResUrl = await uploadFile(form.document_back_file);
        if (backResUrl) backUrl = backResUrl;
      }

      // Persisti
      const insertPayload = {
        booking_id: bookingId,
        type: form.type,
        first_name: form.first_name,
        last_name: form.last_name,
        gender: form.gender,
        birth_date: form.birth_date,
        citizenship: form.citizenship,
        birth_country: form.birth_country,
        birth_city: form.birth_city,
        residence_country: form.residence_country,
        residence_city: form.residence_city,
        residence_address: form.residence_address,
        document_type: form.document_type,
        document_number: form.document_number,
        document_issue_country: form.document_issue_country,
        document_issue_city: form.document_issue_city,
        document_front_url: frontUrl || null,
        document_back_url: backUrl || null
      };

            if (editId) {
         // Se stiamo modificando, puliamo i dump url
         if (!frontUrl) (insertPayload as any).document_front_url = undefined;
         if (!backUrl) (insertPayload as any).document_back_url = undefined;
         
         const { error: dbError } = await supabase.from('booking_guests').update(insertPayload).eq('id', editId);
         if (dbError) throw dbError;
         
         toast.dismiss();
         toast.success("Ospite aggiornato con successo!");
         setTimeout(() => window.close(), 1500); // chiude la modale/tab dopo l'edit
      } else {
         const { error: dbError } = await supabase.from('booking_guests').insert(insertPayload);
         if (dbError) throw dbError;

         toast.dismiss();
         toast.success("Ospite registrato con successo!");
         
         const newCount = addedCount + 1;
         setAddedCount(newCount);

         if (booking?.guests_count && newCount >= booking.guests_count) {
            setCompleted(true);
         } else {
            setForm(initialForm());
         }
      }
    } catch(err: any) {
      toast.dismiss();
      toast.error(err.message || "Errore sconosciuto.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-50"><Loader2 className="w-10 h-10 animate-spin text-blue-600"/></div>;
  if (error || !booking) return <div className="flex h-screen items-center justify-center p-4 text-center text-gray-500">{error}</div>;

  if (completed) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
         <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
               <CheckCircle2 className="w-8 h-8 text-green-600"/>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Check-in Completato</h2>
            <p className="text-gray-500">Grazie per aver inserito i dati per tutti gli ospiti. Ti aspettiamo presso {booking.properties?.name}!</p>
         </div>
      </div>
    );
  }

  const isLeader = ["16", "17", "18"].includes(form.type);

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-blue-700 to-blue-500 rounded-2xl p-6 mb-8 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10">
             <h1 className="text-2xl font-extrabold mb-1">Registrazione Ospiti Alloggiati</h1>
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
                  <div className="text-blue-200 text-xs uppercase font-bold tracking-wider">Avanzamento</div>
                  <div className="font-bold">{addedCount} / {booking.guests_count} Ospiti Inseriti</div>
               </div>
             </div>
          </div>
          <User className="absolute -right-6 -bottom-10 w-48 h-48 text-white opacity-10 pointer-events-none"/>
        </div>

        <form onSubmit={handleSubmit} className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 md:p-8">
           <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4">Inserisci le generalità dell'ospite {addedCount + 1}</h2>

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
                        <option value="19">Membro Gruppo (19)</option>
                        <option value="20">Familiare (20)</option>
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
                <input type="text" value={form.birth_city} onChange={e=>setForm({...form, birth_city: e.target.value})} placeholder="Es. Brescia (BS)" className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none" />
             </div>

             <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Stato di Residenza *</label>
                <select required value={COMMON_COUNTRIES.find(c => c.code === form.residence_country) ? form.residence_country : "ESTERO_ALTRO"} onChange={e=>{
                   if(e.target.value === "ESTERO_ALTRO") setForm({...form, residence_country: ""});
                   else setForm({...form, residence_country: e.target.value});
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
                <input type="text" required value={form.residence_city} onChange={e=>setForm({...form, residence_city: e.target.value})} placeholder="Es. Roma (RM) oppure CAP Estero" className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none" />
             </div>

             {/* SOLO PER CAPOGRUPPO / CAPOFAMIGLIA */}
             <div className="md:col-span-2 pt-4 border-t border-gray-100 mt-2">
                <h3 className="text-sm font-bold text-gray-800 mb-1">Documento Identità</h3>
                <p className="text-gray-500 text-xs mb-4">Obbligatorio per i capi gruppo/famiglia e ospiti singoli. Opzionale per i restanti.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Tipo Documento {isLeader && '*'}</label>
                      <select required={isLeader} value={form.document_type} onChange={e=>setForm({...form, document_type: e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none">
                         <option value="CARTA IDENTITA">Carta Identità</option>
                         <option value="PASSAPORTO">Passaporto</option>
                         <option value="PATENTE">Patente di Guida</option>
                      </select>
                   </div>
                   <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Numero Documento {isLeader && '*'}</label>
                      <input type="text" required={isLeader} value={form.document_number} onChange={e=>setForm({...form, document_number: e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-blue-500 outline-none uppercase" />
                   </div>
                </div>
             </div>

             <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <label className="border-2 border-dashed border-gray-300 hover:border-blue-500 bg-gray-50 hover:bg-blue-50 transition p-6 rounded-2xl flex flex-col items-center justify-center cursor-pointer text-center h-32">
                   <Upload className="w-6 h-6 text-gray-400 mb-2"/>
                   <span className="text-sm font-bold text-gray-700">Carica Fronte Documento</span>
                   <span className="text-xs text-gray-500 mt-1">{form.document_front_file ? form.document_front_file.name : 'Nessun file'}</span>
                   <input type="file" className="hidden" accept="image/*,application/pdf" onChange={e => e.target.files && setForm({...form, document_front_file: e.target.files[0]})} />
                </label>

                <label className="border-2 border-dashed border-gray-300 hover:border-blue-500 bg-gray-50 hover:bg-blue-50 transition p-6 rounded-2xl flex flex-col items-center justify-center cursor-pointer text-center h-32">
                   <Upload className="w-6 h-6 text-gray-400 mb-2"/>
                   <span className="text-sm font-bold text-gray-700">Carica Retro Documento</span>
                   <span className="text-xs text-gray-500 mt-1">{form.document_back_file ? form.document_back_file.name : 'Opzionale (se patente/CI)'}</span>
                   <input type="file" className="hidden" accept="image/*,application/pdf" onChange={e => e.target.files && setForm({...form, document_back_file: e.target.files[0]})} />
                </label>
             </div>
           </div>

           <button type="submit" disabled={isSubmitting} className="w-full mt-8 bg-gray-900 text-white font-bold text-lg py-4 rounded-xl hover:bg-black transition shadow-lg flex items-center justify-center disabled:opacity-50">
              {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin mr-2"/> : <CheckCircle2 className="w-6 h-6 mr-2"/>}
              {isSubmitting ? 'Salvataggio...' : `Conferma ed Aggiungi Ospite (${addedCount + 1}/${booking.guests_count})`}
           </button>
        </form>
      </div>
    </div>
  );
}
