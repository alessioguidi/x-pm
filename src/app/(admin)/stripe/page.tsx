"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { supabase } from "@/utils/supabase/client";
import { Loader2, Plus, CreditCard, Link2, Copy, Trash2, Search, X, Check, Send, ExternalLink } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import toast from "react-hot-toast";
import { useSearchParams } from "next/navigation";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: "In attesa", cls: "bg-amber-100 text-amber-800" },
  authorized: { label: "Autorizzata", cls: "bg-blue-100 text-blue-800" },
  processing: { label: "In lavorazione", cls: "bg-indigo-100 text-indigo-800" },
  succeeded: { label: "Pagata", cls: "bg-emerald-100 text-emerald-800" },
  cancelled: { label: "Annullata", cls: "bg-gray-100 text-gray-600" },
};

function StripeInner() {
  const searchParams = useSearchParams();
  const [orgId, setOrgId] = useState<string>("");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    booking_id: "",
    guest_name: "",
    guest_email: "",
    amount: "",
    reason: "",
    capture_method: "automatic",
  });

  const fetchTransactions = useCallback(async (oid: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("stripe_transactions")
      .select("*, properties(name), bookings(guest_name, check_in_date, check_out_date)")
      .eq("organization_id", oid)
      .order("created_at", { ascending: false });
    if (!error) setTransactions(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      let currentOrgId = "";
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
        if (profile) currentOrgId = profile.organization_id;
      }
      if (!currentOrgId) {
        const { data: fallback } = await supabase.from("organizations").select("id").limit(1).single();
        if (fallback) currentOrgId = fallback.id;
      }
      setOrgId(currentOrgId);
      if (currentOrgId) {
        fetchTransactions(currentOrgId);
        const { data: bk } = await supabase
          .from("bookings")
          .select("id, guest_name, guest_email, check_in_date, check_out_date, properties(name)")
          .eq("organization_id", currentOrgId)
          .order("check_in_date", { ascending: false })
          .limit(300);
        setBookings(bk || []);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBookingSelect = (bookingId: string) => {
    const booking = bookings.find(b => b.id === bookingId);
    setForm(f => ({
      ...f,
      booking_id: bookingId,
      guest_name: booking?.guest_name || f.guest_name,
      guest_email: booking?.guest_email || f.guest_email,
    }));
  };

  const handleCreate = async () => {
    const value = parseFloat(form.amount.replace(",", "."));
    if (isNaN(value) || value <= 0) { toast.error("Inserisci un importo valido"); return; }
    if (!form.guest_name.trim()) { toast.error("Inserisci il nome dell'ospite"); return; }
    if (!form.guest_email.trim()) { toast.error("Inserisci l'email dell'ospite"); return; }
    if (!form.reason.trim()) { toast.error("Inserisci la causale"); return; }

    setCreating(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/stripe/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ ...form, amount: value }),
    });
    const data = await res.json();
    setCreating(false);

    if (!res.ok) {
      toast.error(data.error || "Creazione fallita");
      return;
    }

    setCreatedId(data.transaction?.id || null);
    setCreatedLink(data.payment_link);
    toast.success("Link di pagamento creato");
    fetchTransactions(orgId);
  };

  const closeModal = () => {
    setShowModal(false);
    setCreatedLink(null);
    setCreatedId(null);
    setForm({ booking_id: "", guest_name: "", guest_email: "", amount: "", reason: "", capture_method: "automatic" });
  };

  const copyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiato negli appunti");
    } catch {
      toast.error("Copia non riuscita");
    }
  };

  const sendWhatsApp = (link: string, guestName: string) => {
    const text = encodeURIComponent(`Ciao ${guestName}, ecco il link per il pagamento: ${link}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const deleteTransaction = async (id: string) => {
    if (!confirm("Eliminare la transazione? Il link di pagamento verrà annullato se non ancora pagato.")) return;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/stripe/transactions/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.ok) {
      toast.success("Transazione eliminata");
      fetchTransactions(orgId);
    } else {
      toast.error("Eliminazione fallita");
    }
  };

  const searchLower = searchQuery.toLowerCase();
  const filtered = transactions.filter(t =>
    t.guest_name?.toLowerCase().includes(searchLower) ||
    t.guest_email?.toLowerCase().includes(searchLower) ||
    t.reason?.toLowerCase().includes(searchLower) ||
    t.properties?.name?.toLowerCase().includes(searchLower)
  );

  const totalCollected = transactions.filter(t => t.status === "succeeded").reduce((a, t) => a + Number(t.amount), 0);
  const totalPending = transactions.filter(t => ["pending", "authorized", "processing"].includes(t.status)).reduce((a, t) => a + Number(t.amount), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-blue-600" />
            Pagamenti Stripe
          </h1>
          <p className="text-gray-500 mt-1">Genera link di pagamento per i clienti e tieni traccia delle transazioni.</p>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wide">Incassato</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{formatCurrency(totalCollected)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wide">In attesa</div>
          <div className="text-2xl font-black text-amber-500 mt-1">{formatCurrency(totalPending)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="text-sm font-bold text-gray-500 uppercase tracking-wide">Totale link</div>
          <div className="text-2xl font-black text-blue-600 mt-1">{transactions.length}</div>
        </div>
      </div>

      {/* FILTER + NEW */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
          <input type="text" placeholder="Cerca ospite, causale o struttura..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-gray-200 text-sm focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold shadow-sm hover:bg-blue-700 transition">
          <Plus className="w-5 h-5" /> Nuova Transazione
        </button>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-100">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                {createdLink ? "Link di pagamento creato" : "Nuova Transazione"}
              </h3>
              <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {createdLink ? (
              <div className="p-6 space-y-5">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                  <Check className="w-6 h-6 text-emerald-600 shrink-0" />
                  <p className="text-emerald-800 text-sm font-medium">Link generato correttamente. Invialo al cliente per il pagamento.</p>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
                  <Link2 className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-sm text-gray-700 flex-1 break-all">{createdLink}</span>
                  <button onClick={() => copyLink(createdLink)} className="p-2 bg-white border border-gray-200 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Copia link">
                    <Copy className="w-4 h-4" />
                  </button>
                  <a href={createdLink} target="_blank" rel="noopener noreferrer" className="p-2 bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 rounded-lg transition" title="Apri link">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => copyLink(createdLink)} className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">
                    <Copy className="w-5 h-5" /> Copia link
                  </button>
                  <button onClick={() => sendWhatsApp(createdLink, form.guest_name)} className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition">
                    <Send className="w-5 h-5" /> Invia via WhatsApp
                  </button>
                  <button onClick={closeModal} className="flex items-center gap-2 px-5 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition">
                    Fine
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Prenotazione (opzionale)</label>
                  <select value={form.booking_id} onChange={e => handleBookingSelect(e.target.value)} className="w-full border border-gray-300 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">— Nessuna prenotazione —</option>
                    {bookings.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.guest_name} • {b.properties?.name || "Struttura"} • {b.check_in_date} → {b.check_out_date}
                      </option>
                    ))}
                  </select>
                  {form.booking_id && (
                    <p className="text-[11px] text-blue-600 mt-1">Nome ed email ospite compilati automaticamente dalla prenotazione.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Nome ospite *</label>
                    <input type="text" value={form.guest_name} onChange={e => setForm({ ...form, guest_name: e.target.value })} className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Email ospite *</label>
                    <input type="email" value={form.guest_email} onChange={e => setForm({ ...form, guest_email: e.target.value })} className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Causale *</label>
                    <input type="text" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Es. Saldo soggiorno, Caparra, Extra..." className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Importo (€) *</label>
                    <input type="number" step="0.01" min="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-blue-700" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Tipo</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button onClick={() => setForm({ ...form, capture_method: "automatic" })} className={`p-4 rounded-xl border-2 text-left transition ${form.capture_method === "automatic" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <div className="font-bold text-gray-900 text-sm">Addebito diretto</div>
                      <div className="text-xs text-gray-500 mt-1">Il cliente paga subito, l'importo viene incassato.</div>
                    </button>
                    <button onClick={() => setForm({ ...form, capture_method: "manual" })} className={`p-4 rounded-xl border-2 text-left transition ${form.capture_method === "manual" ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <div className="font-bold text-gray-900 text-sm">Pre-autorizzazione</div>
                      <div className="text-xs text-gray-500 mt-1">Solo blocco dell'importo (es. cauzione). Nessun addebito.</div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!createdLink && (
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                <button onClick={closeModal} className="px-5 py-3 text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition">Annulla</button>
                <button onClick={handleCreate} disabled={creating} className="px-5 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-sm hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50">
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {creating ? "Creazione..." : "Crea Link"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TABLE */}
      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-gray-500 flex flex-col items-center bg-white rounded-3xl border border-dashed border-gray-200">
          <CreditCard className="w-12 h-12 text-gray-300 mb-3" />
          Nessuna transazione. Crea il primo link di pagamento.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 font-bold text-gray-700">Data</th>
                  <th className="px-6 py-4 font-bold text-gray-700">Stato</th>
                  <th className="px-6 py-4 font-bold text-gray-700">Ospite</th>
                  <th className="px-6 py-4 font-bold text-gray-700 w-full">Causale</th>
                  <th className="px-6 py-4 font-bold text-gray-700">Struttura</th>
                  <th className="px-6 py-4 font-bold text-gray-700 text-right">Importo</th>
                  <th className="px-6 py-4 font-bold text-gray-700 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(t => {
                  const meta = STATUS_META[t.status] || { label: t.status, cls: "bg-gray-100 text-gray-600" };
                  return (
                    <tr key={t.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-gray-500">{formatDateTime(t.created_at)}</td>
                      <td className="px-6 py-4">
                        <span className={`${meta.cls} text-[10px] font-bold px-2 py-0.5 rounded uppercase`}>{meta.label}</span>
                        {t.capture_method === "manual" && t.status === "authorized" && (
                          <span className="ml-1 text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded uppercase">Pre-auth</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{t.guest_name}</div>
                        <div className="text-xs text-gray-400">{t.guest_email}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-900 font-medium truncate max-w-[220px]" title={t.reason || ""}>
                        {t.reason}
                        {t.bookings && <div className="text-[10px] text-gray-400 font-normal">{t.bookings.guest_name} • {t.bookings.check_in_date} → {t.bookings.check_out_date}</div>}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{t.properties?.name || "—"}</td>
                      <td className={`px-6 py-4 text-right font-black ${t.status === "succeeded" ? "text-emerald-600" : "text-gray-900"}`}>
                        {formatCurrency(t.amount)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          {t.payment_link && (
                            <>
                              <button onClick={() => copyLink(t.payment_link)} className="p-2.5 bg-white border border-gray-200 text-blue-600 hover:bg-blue-50 rounded-lg transition shadow-sm" title="Copia link">
                                <Copy className="w-4 h-4" />
                              </button>
                              <button onClick={() => sendWhatsApp(t.payment_link, t.guest_name)} className="p-2.5 bg-white border border-gray-200 text-emerald-600 hover:bg-emerald-50 rounded-lg transition shadow-sm" title="Invia via WhatsApp">
                                <Send className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button onClick={() => deleteTransaction(t.id)} className="p-2.5 bg-white border border-gray-200 text-red-600 hover:bg-red-50 rounded-lg transition shadow-sm" title="Elimina">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StripePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-600" /></div>}>
      <StripeInner />
    </Suspense>
  );
}
