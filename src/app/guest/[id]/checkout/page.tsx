"use client";

import { useState, useEffect, use, Suspense } from "react";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, Upload, LogOut, Camera, Home, ClipboardList, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

export default function CheckoutWrapper({ params }: { params: Promise<{ id: string }> }) {
  const p = use(params);
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>}>
      <CheckoutPage bookingId={p.id} />
    </Suspense>
  );
}

function CheckoutPage({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [booking, setBooking] = useState<any>(null);
  const [lang, setLang] = useState("it-IT");
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.language) setLang(navigator.language);
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checklist, setChecklist] = useState<{ label: string; done: boolean }[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, properties!inner(name, logo_url, deposit_method, checkout_checklist)")
        .eq("id", bookingId)
        .single();

      if (error || !data) {
        setError("Prenotazione non trovata.");
      } else {
        setBooking(data);
        const items = (data.properties?.checkout_checklist || []) as string[];
        setChecklist(items.map((label: string) => ({ label, done: false })));
      }
      setLoading(false);
    }
    fetchData();
  }, [bookingId]);

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!videoFile) {
      toast.error("Carica un video della casa per completare il check-out.");
      return;
    }
    if (checklist.some((item) => !item.done)) {
      toast.error("Completa tutti gli elementi della checklist.");
      return;
    }

    setSubmitting(true);
    toast.loading("Invio check-out in corso...");

    try {
      const fileExt = videoFile.name.split(".").pop();
      const fileName = `checkout_${bookingId}_${Date.now()}.${fileExt}`;
      const filePath = `checkout_videos/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from("guest_documents")
        .upload(filePath, videoFile);

      if (uploadError) throw new Error("Errore upload video");

      const { data: urlData } = supabase.storage
        .from("guest_documents")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("bookings")
        .update({
          checkout_video_url: urlData.publicUrl,
          checkout_submitted_at: new Date().toISOString(),
          checkout_checklist: checklist,
          checkout_notes: notes.trim() || null,
          status: "completed",
        })
        .eq("id", bookingId);

      if (updateError) throw updateError;

      toast.dismiss();
      toast.success("Check-out inviato con successo!");
      setCompleted(true);
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || "Errore durante l'invio.");
    } finally {
      setSubmitting(false);
    }
  };

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

  if (completed) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Check-out Inviato!</h2>
          <p className="text-gray-500 mb-6">
            Grazie! Il video, le note e la checklist sono stati inviati alla struttura.
            Verrai ricontattato per eventuali comunicazioni sulla cauzione.
          </p>
          <button
            onClick={() => { if (history.length > 1) history.back(); else window.location.href = `/guest/${bookingId}`; }}
            className="bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition"
          >
            Chiudi
          </button>
          <a
            href={`/guest/${bookingId}`}
            className="block mt-3 text-blue-600 text-sm font-semibold hover:underline"
          >
            ← Torna al portal
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-emerald-700 to-emerald-500 rounded-2xl p-6 text-white shadow-lg">
          <a href={`/guest/${bookingId}`} className="inline-flex items-center gap-1 text-emerald-200 hover:text-white text-xs font-bold mb-3 transition">
            <ArrowLeft className="w-3.5 h-3.5" /> Torna al portal
          </a>
          {booking.properties?.logo_url ? (
            <img src={booking.properties.logo_url} alt="Logo struttura" className="w-10 h-10 mb-2 rounded-full bg-white/20 object-cover border border-white/40" />
          ) : (
            <Home className="w-10 h-10 mb-2 opacity-80" />
          )}
          <h1 className="text-2xl font-extrabold">Check-out</h1>
          <p className="text-emerald-100 mt-1">
            {booking.properties?.name} — {new Date(booking.check_out_date).toLocaleDateString(lang)}
          </p>
        </div>

        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-3 border-b pb-4">
            <ClipboardList className="w-6 h-6 text-emerald-600" />
            <h2 className="text-lg font-bold text-gray-900">Checklist di Partenza</h2>
          </div>

          {checklist.length === 0 ? (
            <p className="text-gray-400 italic text-sm">Nessuna istruzione configurata per questa struttura.</p>
          ) : (
            <div className="space-y-3">
              {checklist.map((item, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition ${
                    item.done
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() =>
                      setChecklist((prev) =>
                        prev.map((c, idx) => (idx === i ? { ...c, done: !c.done } : c))
                      )
                    }
                    className="w-5 h-5 mt-0.5 text-emerald-600 rounded"
                  />
                  <span className={`text-sm font-medium ${item.done ? "line-through text-gray-400" : "text-gray-700"}`}>
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 border-b pb-4">
            <Camera className="w-6 h-6 text-emerald-600" />
            <h2 className="text-lg font-bold text-gray-900">Video Verifica</h2>
          </div>
          <p className="text-sm text-gray-500">
            Registra un breve video che mostri lo stato della casa (stanze, angoli, eventuali danni).
            Il video verrà visionato dallo staff per la verifica della cauzione.
          </p>

          <label className="border-2 border-dashed border-gray-300 hover:border-emerald-500 bg-gray-50 hover:bg-emerald-50 transition p-8 rounded-2xl flex flex-col items-center justify-center cursor-pointer text-center">
            {videoPreview ? (
              <video src={videoPreview} controls className="max-h-64 rounded-xl mb-3" />
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400 mb-3" />
                <span className="text-sm font-bold text-gray-700">
                  {videoFile ? videoFile.name : "Carica video (max 100MB)"}
                </span>
              </>
            )}
            <input
              type="file"
              className="hidden"
              accept="video/*"
              onChange={handleVideoChange}
            />
          </label>
        </div>

        <div className="bg-white shadow-sm border border-gray-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-3 border-b pb-4">
            <ClipboardList className="w-6 h-6 text-emerald-600" />
            <h2 className="text-lg font-bold text-gray-900">Note per la struttura</h2>
          </div>
          <p className="text-sm text-gray-500">
            Vuoi comunicarci qualcosa? (es. dettagli sulla casa, orari, problemi) — campo facoltativo.
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Scrivi qui eventuali note..."
            className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-emerald-500 outline-none text-sm"
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl transition shadow-lg flex items-center justify-center disabled:opacity-50 text-lg"
        >
          {submitting ? (
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
          ) : (
            <LogOut className="w-6 h-6 mr-2" />
          )}
          {submitting ? "Invio in corso..." : "Conferma Check-out"}
        </button>
      </div>
    </div>
  );
}
