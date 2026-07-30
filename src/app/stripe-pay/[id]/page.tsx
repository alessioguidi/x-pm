"use client";

import { useState, useEffect } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { use } from "react";
import { Loader2, ShieldCheck, CheckCircle2, AlertCircle, Home, CalendarDays, User } from "lucide-react";

const isLiveMode = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_live_");
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function CheckoutForm({ paymentIntentId, onDone }: { paymentIntentId: string; onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError("");

    const { error: submitError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/stripe-pay/${paymentIntentId}` },
      redirect: "if_required",
    });

    if (submitError) {
      setError(submitError.message || "Errore durante il pagamento");
      setProcessing(false);
    } else if (paymentIntent?.status === "requires_capture") {
      await fetch("/api/stripe/confirm-deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_intent_id: paymentIntentId }),
      });
      onDone();
    } else {
      onDone();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition shadow-lg flex items-center justify-center disabled:opacity-50 text-lg"
      >
        {processing ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <ShieldCheck className="w-6 h-6 mr-2" />}
        {processing ? "Elaborazione..." : "Autorizza Cauzione"}
      </button>
      <p className="text-xs text-gray-400 text-center">
        Solo autorizzazione, nessun addebito. Verrà incassata solo in caso di danni.
      </p>
    </form>
  );
}

function BookingCard({ booking }: { booking: any }) {
  if (!booking) return null;
  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm border border-gray-200">
      <div className="flex items-center gap-2 text-gray-700 font-medium">
        <Home className="w-4 h-4 text-blue-500" /> {booking.properties?.name || "Struttura"}
      </div>
      <div className="flex items-center gap-2 text-gray-600">
        <User className="w-4 h-4 text-blue-400" /> {booking.guest_name || "Ospite"}
      </div>
      <div className="flex items-center gap-2 text-gray-600">
        <CalendarDays className="w-4 h-4 text-blue-400" />
        {new Date(booking.check_in_date).toLocaleDateString("it-IT")} - {new Date(booking.check_out_date).toLocaleDateString("it-IT")}
      </div>
    </div>
  );
}

export default function StripePayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [piInfo, setPiInfo] = useState<any>(null);

  useEffect(() => {
    async function fetchIntent() {
      const res = await fetch(`/api/stripe/intent?id=${id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Link non valido o scaduto");
      } else {
        setPiInfo(data);
        if (data.status === "requires_payment_method") {
          setClientSecret(data.client_secret);
        }
      }
      setLoading(false);
    }
    fetchIntent();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Link non valido</h2>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (piInfo?.status !== "requires_payment_method") {
    const statusLabels: Record<string, string> = {
      succeeded: "Completata",
      canceled: "Annullata",
      processing: "In elaborazione",
    };
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm text-center">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Pre-autorizzazione {statusLabels[piInfo?.status] || piInfo?.status}</h2>
          <p className="text-gray-500">Importo: €{piInfo?.amount?.toFixed(2)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-blue-600 px-6 py-6 text-center text-white relative">
          {isLiveMode !== undefined && (
            <span className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${isLiveMode ? "bg-green-400 text-green-900" : "bg-yellow-300 text-yellow-900"}`}>
              {isLiveMode ? "LIVE" : "TEST"}
            </span>
          )}
          <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-90" />
          <h2 className="text-xl font-bold">Cauzione Danni</h2>
          <p className="text-blue-100 text-sm mt-1">
            Pre-autorizzazione di €{piInfo?.amount?.toFixed(2)} — nessun addebito ora
          </p>
        </div>
        <div className="p-5 space-y-4">
          <BookingCard booking={piInfo?.booking} />
          {clientSecret ? (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
              <CheckoutForm paymentIntentId={id} onDone={() => window.location.reload()} />
            </Elements>
          ) : (
            <p className="text-gray-500 text-center">Elaborazione...</p>
          )}
        </div>
      </div>
    </div>
  );
}
