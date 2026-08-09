"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { CreditCard, Save, Plus, Trash2, Send, Edit2, Check, X, ShieldCheck, Undo2 } from "lucide-react";
import { formatCurrency, formatDateStr } from "@/lib/format";
import toast from "react-hot-toast";

export default function BookingFinancials({ booking: initialBooking, onBookingUpdate, staffList = [] }: { booking: any, onBookingUpdate: () => void, staffList?: any[] }) {
  const [booking, setBooking] = useState(initialBooking);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // ── Breakdown finanziario editabile ──
  const [fees, setFees] = useState({
    base_price: Number(initialBooking.base_price) || 0,
    cleaning_fee: Number(initialBooking.cleaning_fee) || 0,
    pet_fee: Number(initialBooking.pet_fee) || 0,
    city_tax: Number(initialBooking.city_tax) || 0,
    security_deposit: Number(initialBooking.security_deposit) || 0,
    down_payment: Number(initialBooking.down_payment) || 0,
  });
  const [editingFees, setEditingFees] = useState(false);
  const [savingFees, setSavingFees] = useState(false);

  // ── Extra Services & Property Info ──
  const [extraServices, setExtraServices] = useState<any[]>(initialBooking.extra_services || []);
  const [propertyExtras, setPropertyExtras] = useState<any[]>([]);
  const [propInfo, setPropInfo] = useState<any>(null);
  const [selectedExtraId, setSelectedExtraId] = useState<string>("");
  const [newExtraName, setNewExtraName] = useState("");
  const [newExtraPrice, setNewExtraPrice] = useState("");
  const [newExtraQty, setNewExtraQty] = useState(1);

  const getValidPaymentMethod = (method: string) => {
    if (!method) return "Contante";
    if (method === "Contanti" || method === "Contante all'arrivo") return "Contante";
    if (method === "Bonifico anticipato") return "Bonifico";
    if (method === "Bonifico Istantaneo in loco") return "Bonifico Immediato";
    if (method === "Pos / Carta di Credito in loco" || method === "POS" || method === "Carta di Credito" || method === "Paypal / Stripe") return "Stripe";
    return ["Contante", "Bonifico", "Bonifico Immediato", "Stripe"].includes(method) ? method : "Contante";
  };

  // ── Prima Nota ──
  const [showNewPayment, setShowNewPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({
    amount: "", payment_method: getValidPaymentMethod(initialBooking.payment_method),
    reason: "Saldo", notes: "", status: "completed", staff_member_id: "",
    payment_date: new Date().toISOString().split('T')[0]
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPayments();
    fetchPropertyExtras();
  }, [booking.id, booking.property_id]);

  const fetchPropertyExtras = async () => {
    const { data } = await supabase.from('properties').select('extra_services, city_tax_per_night, city_tax_max_nights, city_tax_child_age').eq('id', booking.property_id).single();
    if (data) {
      if (Array.isArray(data.extra_services)) setPropertyExtras(data.extra_services);
      setPropInfo(data);
    }
  };

  const fetchPayments = async () => {
    const { data } = await supabase.from('cash_transactions').select('*').eq('booking_id', booking.id).order('created_at', { ascending: true });
    if (data) setPayments(data);
    setLoading(false);
  };

  // Calcola il totale di soggiorno dalle fee + extra (NON include caparra/cauzione che sono separati)
  const extraTotal = extraServices.reduce((acc, e) => acc + Number(e.total || 0), 0);
  // city_tax è separata (cash in loco), NON nel totale soggiorno
  const computedTotal = fees.base_price + fees.cleaning_fee + fees.pet_fee + extraTotal;
  const totalPaid = payments.filter(p => p.status === 'confirmed').reduce((acc, p) => acc + Number(p.amount), 0);
  // Il Totale Complessivo Dovuto dal cliente (incluse tasse e cauzione) per il calcolo del saldo
  const grandTotal = computedTotal + Number(fees.city_tax || 0) + Number(fees.security_deposit || 0);
  const balance = grandTotal - totalPaid;

  const handleSaveFees = async () => {
    setSavingFees(true);
    const newTotal = computedTotal;
    const newDownPayment = fees.down_payment; // mantenuto manuale
    
    const { error } = await supabase.from('bookings').update({
      base_price: fees.base_price,
      cleaning_fee: fees.cleaning_fee,
      pet_fee: fees.pet_fee,
      city_tax: fees.city_tax,
      security_deposit: fees.security_deposit,
      down_payment: fees.down_payment,
      total_price: newTotal,
      extra_services: extraServices,
    }).eq('id', booking.id);

    if (error) {
      toast.error("Errore salvataggio finanziario");
    } else {
      toast.success("Scheda finanziaria aggiornata! Rigenero gli incassi...");
      setBooking({ ...booking, total_price: newTotal, extra_services: extraServices, ...fees });
      setEditingFees(false);
      onBookingUpdate();
      // Rigenera automaticamente gli incassi
      await regeneratePayments();
      fetchPayments();
    }
    setSavingFees(false);
  };

  const handleSaveExtraServices = async () => {
    setSaving(true);
    const oldExtraTotal = (initialBooking.extra_services || []).reduce((acc: number, ex: any) => acc + Number(ex.total), 0);
    const newExtraTotal = extraServices.reduce((acc: number, ex: any) => acc + Number(ex.total), 0);
    const newTotalPrice = Number(booking.total_price) - oldExtraTotal + newExtraTotal;

    const { error } = await supabase.from('bookings').update({
      extra_services: extraServices, total_price: newTotalPrice
    }).eq('id', booking.id);

    if (error) { toast.error("Errore salvataggio servizi extra"); }
    else {
      toast.success("Servizi Extra & Importo aggiornati!");
      setBooking({ ...booking, extra_services: extraServices, total_price: newTotalPrice });
      onBookingUpdate();
    }
    setSaving(false);
  };

  const handleUpdateExtraQty = (extraId: string, delta: number) => {
    setExtraServices(extraServices.map(e => {
      if (e.id === extraId) { const newQty = Math.max(1, e.qty + delta); return { ...e, qty: newQty, total: newQty * e.price }; }
      return e;
    }));
  };
  const handleRemoveExtra = (extraId: string) => setExtraServices(extraServices.filter(e => e.id !== extraId));

  const handleResendEmail = async () => {
    toast.loading("Invio email in corso...", { id: "resendM" });
    const res = await fetch(`/api/bookings/${booking.id}/resend`, { method: "POST" });
    if (res.ok) toast.success("Riepilogo inviato al cliente!", { id: "resendM" });
    else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Errore invio email", { id: "resendM" });
    }
  };

  const handleCopyCheckinLink = () => {
    const link = `${window.location.origin}/guest/${booking.id}/checkin`;
    navigator.clipboard.writeText(link);
    toast.success("Link check-in copiato negli appunti!");
  };

  const handleCopyCheckoutLink = () => {
    const link = `${window.location.origin}/guest/${booking.id}/checkout`;
    navigator.clipboard.writeText(link);
    toast.success("Link check-out copiato negli appunti!");
  };

  const handleSendDepositLink = async () => {
    toast.loading("Creazione pre-autorizzazione...", { id: "deposit" });
    try {
      const { error: authErr } = await supabase.auth.getUser();
      if (authErr) throw new Error("Devi effettuare il login");

      const res = await fetch("/api/stripe/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ action: "create", booking_id: booking.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const link = `${window.location.origin}/stripe-pay/${data.payment_intent_id}`;
      await navigator.clipboard.writeText(link);
      toast.success("Link pre-autorizzazione copiato negli appunti!", { id: "deposit" });
    } catch (err: any) {
      toast.error(err.message, { id: "deposit" });
    }
  };

  const handleAddPayment = async () => {
    if (!newPayment.amount || Number(newPayment.amount) <= 0) return toast.error("Inserisci un importo valido");
    setSaving(true);
    
    const isCaparra = newPayment.reason === 'Caparra';
    const isCompleted = newPayment.status === 'completed';
    
    // Insert directly into cash_transactions
    const { error, data: insertedPayment } = await supabase.from('cash_transactions').insert({
      organization_id: booking.organization_id, property_id: booking.property_id,
      booking_id: booking.id, amount: Number(newPayment.amount), payment_method: newPayment.payment_method,
      reason: newPayment.reason, notes: newPayment.notes, 
      status: isCompleted ? 'confirmed' : 'scheduled',
      transaction_type: isCaparra ? 'deposit_collection' : 'stay_balance',
      created_at: newPayment.payment_date ? new Date(newPayment.payment_date).toISOString() : new Date().toISOString(),
      staff_member_id: !isCompleted && newPayment.staff_member_id ? newPayment.staff_member_id : null
    }).select().single();

    if (error) { toast.error("Errore salvataggio!"); }
    else {
      toast.success("Voce Prima Nota registrata!");
      setShowNewPayment(false);
      setNewPayment({ ...newPayment, amount: "", notes: "", status: "confirmed", staff_member_id: "" });
      fetchPayments();
    }
    setSaving(false);
  };

  const handleConfirmPayment = async (id: string) => {
    toast.loading("Conferma in corso...", { id: 'confirmPay' });
    const { data } = await supabase.auth.getSession();
    const res = await fetch(`/api/payments/${id}/confirm`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${data.session?.access_token}` }
    });
    if (res.ok) { toast.success("Pagamento confermato!", { id: 'confirmPay' }); fetchPayments(); }
    else toast.error("Errore conferma pagamento", { id: 'confirmPay' });
  };

  const handleReturnDeposit = async (payment: any) => {
    const bookingId = booking.id;
    if (booking.deposit_status === "authorized" && booking.stripe_payment_intent_id) {
      if (!confirm("Restituire la cauzione? La pre-autorizzazione Stripe verrà annullata.")) return;
      toast.loading("Rilascio pre-autorizzazione...", { id: "ret" });
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/stripe/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
        body: JSON.stringify({ action: "release", payment_intent_id: booking.stripe_payment_intent_id, booking_id: bookingId }),
      });
      if (!res.ok) { toast.error("Errore rilascio", { id: "ret" }); return; }
      await supabase.from("cash_transactions").update({ status: "cancelled" }).eq("id", payment.id);
      toast.success("Cauzione restituita!", { id: "ret" });
    } else {
      if (!confirm("Registrare l'uscita di cassa per la restituzione della cauzione?")) return;
      toast.loading("Registrazione...", { id: "ret" });
      const { error } = await supabase.from("cash_transactions").insert({
        organization_id: booking.organization_id,
        property_id: booking.property_id,
        booking_id: bookingId,
        amount: -Math.abs(payment.amount),
        status: "confirmed",
        payment_method: "Contante",
        reason: "Restituzione Cauzione",
        transaction_type: "expense",
        notes: "Cauzione restituita al check-out",
      });
      if (error) { toast.error("Errore registrazione", { id: "ret" }); return; }
      await supabase.from("cash_transactions").update({ status: "completed" }).eq("id", payment.id);
      toast.success("Uscita registrata!", { id: "ret" });
    }
    fetchPayments();
  };

  const handleRemovePayment = async (id: string) => {
    if (!window.confirm("Cancellare questo pagamento dalla Prima Nota?")) return;
    const { error } = await supabase.from('cash_transactions').delete().eq('id', id);
    if (!error) { fetchPayments(); }
  };

  const handleVoidPayment = async (id: string) => {
    if (!window.confirm("Annullare questo incasso? Tornerà in stato Programmato.")) return;
    const { error } = await supabase.from('cash_transactions').update({ status: 'scheduled' }).eq('id', id);
    if (!error) { toast.success("Incasso annullato, torna in stato programmato"); fetchPayments(); }
  };

  const regeneratePayments = async () => {
    const [propRes] = await Promise.all([
      supabase.from('properties').select('default_checkin_staff_id, deposit_percentage').eq('id', booking.property_id).single(),
    ]);
    const propData = propRes.data as any;
    const defaultStaffId = propData?.default_checkin_staff_id || null;
    const depositPct = propData?.deposit_percentage || 0;

    // Delete existing scheduled payments
    await supabase.from('cash_transactions').delete().eq('booking_id', booking.id).eq('status', 'scheduled');

    // Recreate payments from current fees
    const orgId = initialBooking.organization_id;
    const propId = initialBooking.property_id;
    const bId = booking.id;
    const newPayments: any[] = [];
    const checkInDate = booking.check_in_date;

    if (fees.down_payment > 0) {
      newPayments.push({ organization_id: orgId, property_id: propId, booking_id: bId, amount: fees.down_payment, status: 'scheduled', payment_method: 'Bonifico', reason: 'Caparra', transaction_type: 'deposit_collection', notes: `Caparra (${depositPct}%) — da versare anticipatamente`, created_at: new Date().toISOString() });
    }
    const totalPrice = Number(booking.total_price || fees.base_price + fees.cleaning_fee);
    const cleaningFee = Number(fees.cleaning_fee) || 0;
    // Le spese di pulizia/biancheria restano nel totale preventivo ma si incassano a parte (Stripe online o cash all'arrivo)
    const saldoAmount = totalPrice - Number(fees.down_payment) - cleaningFee;
    if (saldoAmount > 0) {
      const dueDate = new Date(checkInDate);
      dueDate.setDate(dueDate.getDate() - 2);
      newPayments.push({ organization_id: orgId, property_id: propId, booking_id: bId, amount: saldoAmount, status: 'scheduled', payment_method: 'Bonifico', reason: 'Saldo', transaction_type: 'stay_balance', notes: `Saldo soggiorno — da versare entro il ${dueDate.toISOString().split('T')[0].split('-').reverse().join('/')}`, created_at: dueDate.toISOString() });
    }
    if (cleaningFee > 0) {
      newPayments.push({ organization_id: orgId, property_id: propId, booking_id: bId, amount: cleaningFee, status: 'scheduled', payment_method: 'Contante', reason: 'Pulizie', transaction_type: 'stay_balance', notes: "Spese pulizie e biancheria — da incassare a parte", created_at: new Date(checkInDate).toISOString() });
    }
    if (fees.security_deposit > 0) {
      newPayments.push({ organization_id: orgId, property_id: propId, booking_id: bId, amount: fees.security_deposit, status: 'scheduled', payment_method: 'Contante', reason: 'Cauzione Danni', transaction_type: 'stay_balance', notes: "Cauzione danni — cash all'arrivo, restituita al check-out", staff_member_id: defaultStaffId, created_at: new Date(checkInDate).toISOString() });
    }
    if (fees.city_tax > 0) {
      newPayments.push({ organization_id: orgId, property_id: propId, booking_id: bId, amount: fees.city_tax, status: 'scheduled', payment_method: 'Contante', reason: 'Tassa Soggiorno', transaction_type: 'stay_balance', notes: "Tassa di soggiorno — cash all'arrivo", staff_member_id: defaultStaffId, created_at: new Date(checkInDate).toISOString() });
    }

    if (newPayments.length > 0) await supabase.from('cash_transactions').insert(newPayments);
  };

  const handleRegeneratePayments = async () => {
    if (!window.confirm("Rigenerare i pagamenti programmati? Verranno cancellati quelli schedulati esistenti e creati in base al preventivo corrente.")) return;
    toast.loading("Rigenerazione in corso...", { id: "reg" });
    await regeneratePayments();
    toast.success("Pagamenti rigenerati!", { id: "reg" });
    fetchPayments();
  };

  const feeInput = "w-full border border-gray-200 p-2.5 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-400 outline-none text-right";
  const feeRow = (label: string, key: keyof typeof fees, note?: string) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <div>
        <span className="text-sm text-gray-700 font-medium">{label}</span>
        {note && <span className="block text-[10px] text-gray-400">{note}</span>}
      </div>
      {editingFees ? (
        <input type="number" step="0.01" min="0" className={`${feeInput} w-24`}
          value={fees[key]} onChange={e => setFees({ ...fees, [key]: Number(e.target.value) })} />
      ) : (
        <span className="font-bold text-gray-800">{formatCurrency(fees[key])}</span>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-6">
      <div className="flex justify-between items-center border-b border-gray-100 pb-3">
        <h3 className="font-bold flex items-center text-gray-800">
          <CreditCard className="w-5 h-5 mr-2 text-green-600" /> Cassa & Servizi
        </h3>
      </div>

      {/* ─── SCHEDA FINANZIARIA ─── */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Preventivo Soggiorno</h4>
          {editingFees ? (
            <div className="flex gap-2">
              <button onClick={() => { setFees({ base_price: Number(initialBooking.base_price)||0, cleaning_fee: Number(initialBooking.cleaning_fee)||0, pet_fee: Number(initialBooking.pet_fee)||0, city_tax: Number(initialBooking.city_tax)||0, security_deposit: Number(initialBooking.security_deposit)||0, down_payment: Number(initialBooking.down_payment)||0 }); setEditingFees(false); }}
                className="text-xs font-bold text-gray-500 bg-gray-100 px-4 py-2.5 rounded-full hover:bg-gray-200 flex items-center gap-1">
                <X className="w-3 h-3" /> Annulla
              </button>
              <button onClick={handleSaveFees} disabled={savingFees}
                className="text-xs font-bold text-white bg-emerald-600 px-4 py-2.5 rounded-full hover:bg-emerald-700 flex items-center gap-1">
                <Check className="w-3 h-3" /> {savingFees ? 'Salvo...' : 'Salva'}
              </button>
            </div>
          ) : (
            <button onClick={() => setEditingFees(true)}
              className="text-[10px] font-bold text-gray-500 bg-gray-100 px-4 py-2.5 rounded-full hover:bg-gray-200 flex items-center gap-1">
              <Edit2 className="w-3 h-3" /> Modifica
            </button>
          )}
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
          {feeRow('Base Soggiorno', 'base_price', `${booking.nights || '?'} notti`)}
          {feeRow('Spese Pulizie', 'cleaning_fee')}
          {feeRow('Extra Animali', 'pet_fee')}
        

          {/* Servizi Extra */}
          {(extraServices.length > 0 || editingFees) && (
            <div className="py-2 border-b border-gray-100">
              <span className="text-sm text-gray-700 font-medium">Servizi Extra</span>
              <div className="mt-1 space-y-1">
                {extraServices.map(ex => (
                  <div key={ex.id} className="flex items-center justify-between text-xs bg-white border border-gray-100 rounded p-1.5">
                    <span className="text-gray-700">{ex.name} ({formatCurrency(ex.price)} × {ex.qty})</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-gray-100 rounded">
                        <button onClick={() => handleUpdateExtraQty(ex.id, -1)} className="px-2 py-0.5 text-gray-600 hover:bg-gray-200 rounded-l">-</button>
                        <span className="px-2 font-bold">{ex.qty}</span>
                        <button onClick={() => handleUpdateExtraQty(ex.id, 1)} className="px-2 py-0.5 text-gray-600 hover:bg-gray-200 rounded-r">+</button>
                      </div>
                      <span className="font-bold w-12 text-right">{formatCurrency(ex.total)}</span>
                      <button onClick={() => handleRemoveExtra(ex.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-5 h-5"/></button>
                    </div>
                  </div>
                ))}
              </div>
              {/* Aggiungi extra */}
              <div className="flex gap-2 items-center mt-2">
                <select className="text-sm p-2.5 border rounded flex-1 bg-white outline-none" value={selectedExtraId} onChange={e => {
                  setSelectedExtraId(e.target.value);
                  if (e.target.value !== 'custom' && e.target.value !== '') {
                    const ex = propertyExtras.find(p => p.id === e.target.value);
                    if (ex) { setNewExtraName(ex.name); setNewExtraPrice(String(ex.price)); }
                  } else { setNewExtraName(''); setNewExtraPrice(''); }
                }}>
                  <option value="">+ Aggiungi dal listino...</option>
                  {propertyExtras.map(ex => <option key={ex.id} value={ex.id}>{ex.name} ({formatCurrency(ex.price)})</option>)}
                  <option value="custom">Altro (inserimento libero)</option>
                </select>
                {selectedExtraId === 'custom' && (
                  <>
                    <input type="text" className="text-sm p-2.5 border rounded w-1/3" placeholder="Nome" value={newExtraName} onChange={e => setNewExtraName(e.target.value)} />
                    <input type="number" className="text-sm p-2.5 border rounded w-16" placeholder="€" value={newExtraPrice} onChange={e => setNewExtraPrice(e.target.value)} />
                  </>
                )}
                {selectedExtraId !== '' && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-gray-400">Qtà</span>
                    <input type="number" min="1" className="text-sm p-2.5 border rounded w-14" value={newExtraQty} onChange={e => setNewExtraQty(Math.max(1, Number(e.target.value)))} />
                  </div>
                )}
                <button onClick={() => {
                  if (newExtraName && newExtraPrice) {
                    const total = Number(newExtraPrice) * newExtraQty;
                    setExtraServices([...extraServices, { id: selectedExtraId === 'custom' ? 'manual_'+Date.now() : selectedExtraId, name: newExtraName, price: Number(newExtraPrice), qty: newExtraQty, total }]);
                    setNewExtraName(''); setNewExtraPrice(''); setSelectedExtraId(''); setNewExtraQty(1);
                  }
                }} className="bg-blue-600 text-white p-1.5 px-2 rounded text-xs font-bold hover:bg-blue-700">OK</button>
              </div>
            </div>
          )}

          {/* Totale Soggiorno */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200 mt-1">
            <span className="font-bold text-gray-900">TOTALE SOGGIORNO</span>
            <span className="text-xl font-black text-gray-900">{formatCurrency(computedTotal)}</span>
          </div>

          {/* Voci separati: cauzione e caparra */}
          <div className="mt-3 pt-3 border-t border-dashed border-gray-200 space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Voci Separate (non nel totale soggiorno)</p>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-amber-700 font-medium">Caparra Richiesta</span>
                <span className="block text-[10px] text-amber-500">Da versare anticipatamente (bonifico)</span>
              </div>
              {editingFees ? (
                <input type="number" step="0.01" min="0" className={`${feeInput} w-24 border-amber-300`}
                  value={fees.down_payment} onChange={e => setFees({ ...fees, down_payment: Number(e.target.value) })} />
              ) : (
                <span className="font-bold text-amber-700">{formatCurrency(fees.down_payment)}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-red-700 font-medium">Cauzione Danni</span>
                <span className="block text-[10px] text-red-400">Cash all'arrivo → restituita al check-out</span>
              </div>
              {editingFees ? (
                <input type="number" step="0.01" min="0" className={`${feeInput} w-24 border-red-300`}
                  value={fees.security_deposit} onChange={e => setFees({ ...fees, security_deposit: Number(e.target.value) })} />
              ) : (
                <span className="font-bold text-red-700">{formatCurrency(fees.security_deposit)}</span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-amber-700 font-medium">Tassa di Soggiorno</span>
                <span className="block text-[10px] text-amber-500">Cash all'arrivo · max {propInfo?.city_tax_max_nights ?? 10} notti · solo adulti ≥{(propInfo?.city_tax_child_age ?? 11) + 1} anni</span>
              </div>
              {editingFees ? (
                <input type="number" step="0.01" min="0" className={`${feeInput} w-24 border-amber-300`}
                  value={fees.city_tax} onChange={e => setFees({ ...fees, city_tax: Number(e.target.value) })} />
              ) : (
                <span className="font-bold text-amber-700">{formatCurrency(fees.city_tax)}</span>
              )}
            </div>
          </div>
        </div>

        {JSON.stringify(extraServices) !== JSON.stringify(initialBooking.extra_services || []) && !editingFees && (
          <button onClick={handleSaveExtraServices} disabled={saving} className="w-full mt-2 text-xs bg-emerald-600 text-white font-bold py-2.5 rounded-lg hover:bg-emerald-700 transition">
            {saving ? "Salvataggio..." : "Salva Modifiche Extra e Ricalcola"}
          </button>
        )}
      </div>

      {/* ─── PRIMA NOTA PAGAMENTI ─── */}
      <div className="bg-orange-50 -mx-5 px-5 py-4 border-y border-orange-100 space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="font-bold text-orange-800 text-xs uppercase">Prima Nota Pagamenti</h4>
          <div className="flex gap-2">
            <button onClick={handleRegeneratePayments} className="text-xs font-bold bg-orange-100 text-orange-700 px-3 py-2 rounded hover:bg-orange-200">Rigenera</button>
            <button onClick={() => setShowNewPayment(!showNewPayment)} className="text-xs font-bold bg-orange-200 text-orange-800 px-3 py-2 rounded hover:bg-orange-300">+ Aggiungi</button>
          </div>
        </div>

        {loading ? (
          <div className="text-xs text-orange-600">Caricamento pagamenti...</div>
        ) : payments.length === 0 ? (
          <div className="text-xs text-orange-600 border border-dashed border-orange-200 rounded p-2 text-center bg-white/50">Nessuna transazione registrata.</div>
        ) : (
          <div className="space-y-2">
            {payments.map(p => {
              const isPending = p.status === 'scheduled' || p.status === 'cancelled';
              const isCancelled = p.status === 'cancelled';
              return (
                <div key={p.id} className={`p-2 rounded shadow-sm border flex flex-col gap-2 text-xs ${isPending ? (isCancelled ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200') : 'bg-white border-orange-100'}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`font-bold ${isPending ? (isCancelled ? 'text-red-700' : 'text-yellow-800') : 'text-gray-800'} flex items-center`}>
                        {isCancelled ? '🔄 Stornato' : isPending ? '⏳ Da Incassare' : '✅'} - {formatDateStr(p.created_at)} - {formatCurrency(p.amount)}
                      </p>
                      <p className={isPending ? (isCancelled ? 'text-red-600' : 'text-yellow-700') : 'text-gray-500'}>{p.reason} via {p.payment_method} {p.notes && `(${p.notes})`}</p>
                      {isPending && p.staff_member_id && (
                        <p className="text-yellow-600 mt-1 font-semibold text-[10px] uppercase">
                          Assegnato a: {staffList.find(s => s.id === p.staff_member_id)?.name || 'Sconosciuto'}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {!isPending && <button onClick={() => handleVoidPayment(p.id)} className="text-[10px] font-bold text-amber-600 hover:text-amber-800 bg-amber-50 px-2 py-0.5 rounded hover:bg-amber-100">Annulla</button>}
                      <button onClick={() => handleRemovePayment(p.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-5 h-5"/></button>
                      {!isPending && p.reason === "Cauzione Danni" && (
                        <button onClick={() => handleReturnDeposit(p)} className="bg-purple-500 text-white px-3 py-2 rounded text-[10px] font-bold shadow-sm hover:bg-purple-600 uppercase flex items-center gap-1">
                          <Undo2 className="w-3 h-3" /> Restituisci
                        </button>
                      )}
                      {isPending && (
                        <button onClick={() => handleConfirmPayment(p.id)} className="bg-emerald-500 text-white px-3 py-2 rounded text-[10px] font-bold shadow-sm hover:bg-emerald-600 uppercase">
                          {isCancelled ? 'Ri-Conferma Incasso' : 'Conferma Incasso'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {showNewPayment && (
          <div className="mt-3 p-3 bg-white rounded-lg shadow-sm border border-orange-200 space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Stato</label>
                <select className="w-full text-sm p-2.5 border rounded bg-gray-50" value={newPayment.status} onChange={e => setNewPayment({ ...newPayment, status: e.target.value })}>
                  <option value="confirmed">Già Incassato (Definitivo)</option>
                  <option value="scheduled">Da Incassare (Programmato)</option>
                </select>
              </div>
            </div>
            {newPayment.status === 'scheduled' && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-bold uppercase text-orange-500">Incarica Membro Staff</label>
                  <select className="w-full text-sm p-2.5 border border-orange-200 rounded" value={newPayment.staff_member_id} onChange={e => setNewPayment({ ...newPayment, staff_member_id: e.target.value })}>
                    <option value="">Nessuno (Libero)</option>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Importo</label>
                <input type="number" className="w-full text-sm p-2.5 border rounded" value={newPayment.amount} onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })} placeholder="€" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Causale</label>
                <select className="w-full text-sm p-2.5 border rounded" value={newPayment.reason} onChange={e => setNewPayment({ ...newPayment, reason: e.target.value })}>
                  <option>Caparra</option><option>Saldo</option><option>Tassa Soggiorno</option>
                  <option>Cauzione Danni</option><option>Servizi Extra</option><option>Altro</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Metodo</label>
                <select className="w-full text-sm p-2.5 border rounded" value={newPayment.payment_method} onChange={e => setNewPayment({ ...newPayment, payment_method: e.target.value })}>
                  <option>Contante</option><option>Bonifico</option><option>Bonifico Immediato</option><option>Stripe</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase text-gray-500">Data Pagamento</label>
                <input type="date" className="w-full text-sm p-2.5 border rounded" value={newPayment.payment_date} onChange={e => setNewPayment({ ...newPayment, payment_date: e.target.value })} />
              </div>
            </div>
            <div>
              <input type="text" className="w-full text-sm p-2.5 border rounded" placeholder="Note (opzionale)" value={newPayment.notes} onChange={e => setNewPayment({ ...newPayment, notes: e.target.value })} />
            </div>
            <button onClick={handleAddPayment} disabled={saving} className="w-full text-xs font-bold text-white bg-orange-500 py-2.5 rounded hover:bg-orange-600">Salva Pagamento</button>
          </div>
        )}
      </div>

      {/* Totale incassato vs saldo */}
      <div className="pt-2 flex justify-between items-center">
        <div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Totale Incassato</p>
          <div className="text-xl font-bold text-gray-800">{formatCurrency(totalPaid)}</div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Saldo da Incassare</p>
          <div className={`text-2xl font-black ${balance > 0 ? "text-red-600" : balance < 0 ? "text-blue-600" : "text-green-600"}`}>
            {formatCurrency(balance)}
          </div>
        </div>
      </div>
    </div>
  );
}
