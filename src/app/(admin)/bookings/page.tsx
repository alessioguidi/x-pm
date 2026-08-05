"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/utils/supabase/client";
import { Loader2, Calendar, User, MapPin, X, Mail, Phone, Plus, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency, formatDateStr, formatPercent } from "@/lib/format";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { AdvancedDataGrid, ColumnDef, FilterableColumn, BulkAction } from "@/components/ui/AdvancedDataGrid";
import { default as BulkDeleteModal } from "@/components/ui/BulkDeleteModal";

// ──────────────────────────────────────────────
// Wizard "Nuova Prenotazione" — si comporta come il portale web
// Step 1: Scegli Immobile
// Step 2: Date + Ospiti (con calcolo automatico e vincoli)
// Step 3: Contatto (cerca esistente o crea nuovo)
// Step 4: Riepilogo + Salva
// ──────────────────────────────────────────────

const INITIAL_CALC = {
  nights: 0, basePrice: 0, cleaningFee: 0, petFee: 0,
  cityTax: 0, extraTotal: 0, downPayment: 0, securityDeposit: 0, totalPrice: 0,
  commissionAmt: 0, taxAmt: 0
};

export default function BookingsPage() {
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]); // NEW: canali di prenotazione
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState("");

  // Wizard state
  const [createModal, setCreateModal] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  
  // Step 1: Property
  const [selPropId, setSelPropId] = useState("");
  const [propData, setPropData] = useState<any>(null);
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  
  // Step 2: Dates + Guests
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [petsCount, setPetsCount] = useState(0);
  const [status, setStatus] = useState("pending");
  const [selChannelId, setSelChannelId] = useState(""); // NEW
  const [calc, setCalc] = useState({ ...INITIAL_CALC, commissionAmt: 0, taxAmt: 0 }); // UPDATED
  const [dateError, setDateError] = useState("");
  
  // Step 3: Contact
  const [contactSearch, setContactSearch] = useState("");
  const [contactMode, setContactMode] = useState<'search' | 'create'>('search');
  const [selContactId, setSelContactId] = useState("");
  const [newContact, setNewContact] = useState({ first_name: '', last_name: '', email: '', phone: '' });

  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [selectedForBulk, setSelectedForBulk] = useState<string[]>([]);

  // Filter tabs for unified view
  const [filterTab, setFilterTab] = useState<string>('all'); // all, leads, active, closed
  const [filterPropertyId, setFilterPropertyId] = useState<string>("");

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: user } = await supabase.auth.getUser();
    if (user.user) {
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.user.id).single();
      if (profile) setOrgId(profile.organization_id);
    }
    const [bookingsRes, propsRes, contactsRes, channelsRes] = await Promise.all([
      supabase.from('bookings')
        .select('*, properties(name), cash_transactions(amount, status), contacts(*)')
        .in('status', ['lead_new', 'quote_sent', 'negotiation', 'closed_lost', 'pending', 'confirmed', 'cancelled'])
        .order('created_at', { ascending: false }),
      supabase.from('properties')
        .select('id, name, organization_id, base_price_per_night, cleaning_fee, pet_fee, city_tax_per_night, city_tax_max_nights, city_tax_child_age, deposit_percentage, security_deposit, max_guests, extra_services, house_rules, default_checkin_staff_id, default_cleaning_staff_id'),
      supabase.from('contacts')
        .select('id, first_name, last_name, email, phone')
        .order('created_at', { ascending: false }),
      supabase.from('booking_channels') // NEW
        .select('*')
        .eq('is_active', true)
        .order('name')
    ]);
    if (bookingsRes.data) setBookings(bookingsRes.data);
    if (propsRes.data) setProperties(propsRes.data);
    if (contactsRes.data) setContacts(contactsRes.data);
    if (channelsRes.data) setChannels(channelsRes.data);
    setLoading(false);
  };

  // Load property detail + existing bookings when property is selected
  const loadPropertyData = async (propId: string) => {
    const prop = properties.find(p => p.id === propId);
    setPropData(prop || null);
    if (propId) {
      const [bkRes, ovRes] = await Promise.all([
        supabase.from('bookings').select('check_in_date, check_out_date').eq('property_id', propId).in('status', ['pending', 'confirmed']),
        supabase.from('calendar_overrides').select('date, is_blocked, closed_to_arrival, closed_to_departure, min_stay',).eq('property_id', propId),
      ]);
      setActiveBookings(bkRes.data || []);
      setOverrides(ovRes.data || []);
    } else {
      setActiveBookings([]);
      setOverrides([]);
    }
  };

  // Calcolo automatico ogni volta che cambiano date/ospiti/immobile
  useEffect(() => {
    setDateError("");
    if (!propData || !checkIn || !checkOut) { setCalc(INITIAL_CALC); return; }

    const dIn = new Date(checkIn);
    const dOut = new Date(checkOut);
    if (dOut <= dIn) { setDateError("Il check-out deve essere successivo al check-in."); setCalc(INITIAL_CALC); return; }

    const nights = Math.round((dOut.getTime() - dIn.getTime()) / (1000 * 3600 * 24));
    const checkInKey = checkIn;
    const checkOutKey = checkOut;
    const ovIn = overrides.find(o => o.date === checkInKey);
    const ovOut = overrides.find(o => o.date === checkOutKey);

    let errors: string[] = [];

    // Closed to arrival on check-in date
    if (ovIn?.closed_to_arrival) errors.push("Il check-in non è consentito in questa data (chiuso agli arrivi).");
    // Closed to departure on check-out date
    if (ovOut?.closed_to_departure) errors.push("Il check-out non è consentito in questa data (chiuso alle partenze).");

    // Min stay: use override value if present, otherwise property default
    const minStay = ovIn?.min_stay || propData.min_stay || 1;
    if (nights < minStay) errors.push(`Soggiorno minimo richiesto: ${minStay} notti (ne hai selezionate ${nights}).`);

    // Date blocked
    if (ovIn?.is_blocked || ovOut?.is_blocked) errors.push("Una delle date selezionate è bloccata nel calendario.");

    // Overlap with existing bookings
    const overlap = activeBookings.some(b => {
      const bIn = new Date(b.check_in_date).getTime();
      const bOut = new Date(b.check_out_date).getTime();
      const cIn = dIn.getTime();
      const cOut = dOut.getTime();
      return cIn < bOut && cOut > bIn;
    });
    if (overlap) errors.push("⚠️ Le date si sovrappongono con una prenotazione esistente.");

    setDateError(errors.length > 0 ? errors.join(" • ") : "");

    const basePrice = nights * (propData.base_price_per_night || 0);
    const cleaningFee = propData.cleaning_fee || 0;
    const petFee = petsCount * (propData.pet_fee || 0);
    const maxN = propData.city_tax_max_nights ?? 10;
    const taxableNights = Math.min(nights, maxN);
    const cityTax = (propData.city_tax_per_night || 2) * taxableNights * adults;
    // totalPrice = soggiorno SENZA city tax (quest'ultima è cash separata come cauzione)
    const subtotal = basePrice + cleaningFee + petFee;
    const downPayment = propData.deposit_percentage > 0 ? Math.round(subtotal * propData.deposit_percentage / 100 * 100) / 100 : 0;
    const securityDeposit = propData.security_deposit || 0;
    // Calcolo commissioni/tasse sul portale
    const selChannel = channels.find(c => c.id === selChannelId);
    const commissionAmt = selChannel ? Math.round(subtotal * (selChannel.commission_pct || 0) / 100 * 100) / 100 : 0;
    const taxAmt = selChannel ? Math.round(subtotal * (selChannel.tax_pct || 0) / 100 * 100) / 100 : 0;

    setCalc({ nights, basePrice, cleaningFee, petFee, cityTax, extraTotal: 0, downPayment, securityDeposit, totalPrice: subtotal, commissionAmt, taxAmt } as any);
  }, [propData, checkIn, checkOut, adults, children, petsCount, selChannelId, channels]);

  const resetWizard = () => {
    setWizardStep(1); setSelPropId(""); setPropData(null); setActiveBookings([]);
    setCheckIn(""); setCheckOut(""); setAdults(1); setChildren(0); setPetsCount(0); setStatus("pending"); setSelChannelId("");
    setCalc({ ...INITIAL_CALC, commissionAmt: 0, taxAmt: 0 } as any); setDateError("");
    setContactSearch(""); setContactMode('search'); setSelContactId(""); setNewContact({ first_name: '', last_name: '', email: '', phone: '' });
  };

  const handleCreateBooking = async () => {
    if (!selPropId || !checkIn || !checkOut) return toast.error("Completa date e immobile");
    if (!selContactId && contactMode === 'search') return toast.error("Seleziona un contatto");
    if (contactMode === 'create' && !newContact.first_name) return toast.error("Inserisci almeno il nome del contatto");

    toast.loading("Creazione in corso...", { id: 'create' });

    let contactId = selContactId;

    // FETCH COSTI STAFF
    const staffIds = [propData?.default_checkin_staff_id, propData?.default_checkout_staff_id, propData?.default_cleaning_staff_id].filter(Boolean);
    let staffCost = 0;
    if (staffIds.length > 0) {
       const { data: stf } = await supabase.from('staff_members').select('id, cost_per_service').in('id', staffIds);
       if (stf) staffCost = stf.reduce((acc, s) => acc + Number(s.cost_per_service || 0), 0);
    }

    // Crea contatto al volo se necessario
    if (contactMode === 'create') {
      const { data: newC, error: cErr } = await supabase.from('contacts').insert({
        organization_id: orgId,
        first_name: newContact.first_name,
        last_name: newContact.last_name || null,
        email: newContact.email || null,
        phone: newContact.phone || null,
        source: 'manual'
      }).select('id').single();
      if (cErr) { toast.error("Errore creazione contatto: " + cErr.message, { id: 'create' }); return; }
      contactId = newC.id;
    }

    const linkedContact = contacts.find(c => c.id === contactId) || 
      (contactMode === 'create' ? { first_name: newContact.first_name, last_name: newContact.last_name, email: newContact.email, phone: newContact.phone } : null);

    const { data: booking, error } = await supabase.from('bookings').insert({
      organization_id: orgId,
      property_id: selPropId,
      contact_id: contactId,
      guest_name: linkedContact ? `${linkedContact.first_name} ${linkedContact.last_name || ''}`.trim() : 'N/A',
      guest_email: linkedContact?.email || '',
      guest_phone: linkedContact?.phone || '',
      check_in_date: checkIn,
      check_out_date: checkOut,
      nights: calc.nights,
      guests_count: adults + children,
      adults_count: adults,
      children_count: children,
      pets_count: petsCount,
      base_price: calc.basePrice,
      cleaning_fee: calc.cleaningFee,
      pet_fee: calc.petFee,
      city_tax: calc.cityTax,
      security_deposit: calc.securityDeposit,
      down_payment: calc.downPayment,
      total_price: calc.totalPrice,
      status,
      channel_id: selChannelId || null,
      commission_amount: (calc as any).commissionAmt || 0,
      tax_amount: (calc as any).taxAmt || 0,
      extra_services: [],
      checkin_staff_id: propData.default_checkin_staff_id || null,
      checkout_staff_id: propData.default_checkout_staff_id || null,
      cleaning_staff_id: propData.default_cleaning_staff_id || null,
      staff_cost: staffCost,
      services_cost: 0
    }).select('id').single();

    if (error) { toast.error("Errore: " + error.message, { id: 'create' }); return; }

    // Pagamenti pianificati — strutturati con data, metodo e membro staff
    const bId = booking.id;
    const payments: any[] = [];
    // Caparra: anticipata via Bonifico (nessuna data fissa, nessun contact_id nei pagamenti per ora)
    if (calc.downPayment > 0) payments.push({
      booking_id: bId, amount: calc.downPayment, status: 'scheduled',
      payment_method: 'Bonifico', reason: 'Caparra',
      notes: `Caparra (${propData.deposit_percentage}%) — da versare anticipatamente`
    });
    // Cauzione: cash all'arrivo = check-in, legato a check-in staff
    if (calc.securityDeposit > 0) payments.push({
      booking_id: bId, amount: calc.securityDeposit, status: 'scheduled',
      payment_method: 'Contante', reason: 'Cauzione Danni',
      date: checkIn, staff_member_id: propData.default_checkin_staff_id || null,
      notes: "Cauzione danni — cash all'arrivo, restituita al check-out"
    });
    // Tassa soggiorno: cash all'arrivo = check-in, legato a check-in staff
    if (calc.cityTax > 0) payments.push({
      booking_id: bId, amount: calc.cityTax, status: 'scheduled',
      payment_method: 'Contante', reason: 'Tassa Soggiorno',
      date: checkIn, staff_member_id: propData.default_checkin_staff_id || null,
      notes: `Tassa di soggiorno (${adults} adulti × ${Math.min(calc.nights, propData.city_tax_max_nights ?? 10)} notti) — cash all'arrivo`
    });
    
    if (payments.length > 0) {
       const cashTxs = payments.map(p => ({
           organization_id: propData?.organization_id || null,
           property_id: propData?.id || null,
           booking_id: p.booking_id,
           staff_member_id: p.staff_member_id || null,
           amount: p.amount,
           transaction_type: p.reason === 'Caparra' ? 'deposit_collection' : 'stay_balance',
           status: p.status === 'completed' ? 'confirmed' : 'scheduled',
           payment_method: p.payment_method,
           reason: p.reason,
           notes: p.notes,
           created_at: p.date ? new Date(p.date).toISOString() : new Date().toISOString()
       }));
       await supabase.from('cash_transactions').insert(cashTxs);
    }

    toast.success("Prenotazione creata!", { id: 'create' });
    setCreateModal(false);
    resetWizard();
    fetchData();
  };

  const bulkCancel = async () => {
    setLoading(true);
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).in('id', selectedForBulk);
    if (error) toast.error("Errore durante l'annullamento.");
    else { toast.success(`${selectedForBulk.length} prenotazioni annullate.`); fetchData(); }
  };

  const bulkDelete = async () => {
    setLoading(true);
    const { error } = await supabase.from('bookings').delete().in('id', selectedForBulk);
    if (error) toast.error("Errore durante l'eliminazione.");
    else { toast.success(`${selectedForBulk.length} prenotazioni distrutte.`); fetchData(); }
  };

  const filteredContacts = contacts.filter(c => {
    if (!contactSearch) return true;
    const q = contactSearch.toLowerCase();
    return (
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
    );
  });

  const columns: ColumnDef[] = [
    {
      key: 'property_details', label: 'Dettagli Soggiorno',
      render: (row) => (
        <div>
          <p className="font-bold text-gray-900 flex items-center mb-1 group-hover:text-blue-600 transition-colors">
            <MapPin className="w-3.5 h-3.5 mr-1.5 text-gray-400 group-hover:text-blue-500 transition-colors" />
            {row.properties?.name || 'Immobile Eliminato'}
          </p>
          <p className="text-sm font-medium text-gray-600 flex items-center">
            <Calendar className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
            {formatDateStr(row.check_in_date)} → {formatDateStr(row.check_out_date)} <span className="text-gray-400 ml-1">({row.nights} notti)</span>
          </p>
        </div>
      )
    },
    {
      key: 'guest_info', label: 'Contatti',
      render: (row) => (
        <div>
          <p className="font-bold text-blue-800">{row.contacts ? `${row.contacts.first_name} ${row.contacts.last_name || ''}`.trim() : row.guest_name}</p>
          <p className="text-[10px] text-gray-400 font-bold tracking-wider mb-1 uppercase">{row.contact_id ? 'CRM' : 'Manuale'}</p>
          <p className="text-sm text-gray-600 flex items-center"><Mail className="w-3.5 h-3.5 mr-1.5 opacity-60"/> {row.contacts?.email || row.guest_email || 'N/A'}</p>
          <p className="text-sm text-gray-600 mt-0.5 flex items-center"><Phone className="w-3.5 h-3.5 mr-1.5 opacity-60"/> {row.contacts?.phone || row.guest_phone || 'N/A'}</p>
        </div>
      )
    },
    {
      key: 'price_info', label: 'Importo',
      render: (row) => {
        const totalPaid = (row.cash_transactions || []).filter((p: any) => p.status === 'confirmed').reduce((acc: number, p: any) => acc + Number(p.amount), 0);
        const grandTotal = Number(row.total_price) + Number(row.city_tax || 0) + Number(row.security_deposit || 0);
        const balance = grandTotal - totalPaid;
        return (
          <div className="flex flex-col">
            <p className="font-bold text-gray-900">{formatCurrency(Number(row.total_price))}</p>
            <p className="text-[10px] text-gray-500 mt-1">TOTALE</p>
            {balance > 0 ? (
               <div className="mt-2 text-xs"><span className="inline-block px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] font-bold uppercase tracking-wider">Da Incassare: {formatCurrency(balance)}</span></div>
            ) : (
               <div className="mt-2 text-xs"><span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold uppercase tracking-wider">Saldato</span></div>
            )}
          </div>
        );
      }
    },
    {
      key: 'deductions', label: 'Costi & Spese',
      render: (row) => {
        const commission = Number(row.commission_amount || 0);
        const tax = Number(row.tax_amount || 0);
        const staffCost = Number(row.staff_cost || 0);
        const servicesCost = Number(row.services_cost || 0);
        const totalDed = commission + tax + staffCost + servicesCost;
        
        if (totalDed === 0) return <span className="text-[10px] italic text-gray-400">Nessuna spesa</span>;
        
        return (
          <div className="flex flex-col space-y-0.5">
            {commission > 0 && <span className="text-[10px] font-medium text-purple-700" title="Commissione Portale">Com.: - {formatCurrency(commission)}</span>}
            {tax > 0 && <span className="text-[10px] font-medium text-indigo-700" title="Iva Portale">Tax: - {formatCurrency(tax)}</span>}
            {staffCost > 0 && <span className="text-[10px] font-medium text-amber-700" title="Costo Staff (Check-in/Out, Pulizie)">Staff: - {formatCurrency(staffCost)}</span>}
            {servicesCost > 0 && <span className="text-[10px] font-medium text-orange-700" title="Costo Servizi Extra">Serv: - {formatCurrency(servicesCost)}</span>}
          </div>
        );
      }
    },
    {
      key: 'status', label: 'Stato', align: 'right',
      render: (row) => {
        const statusMap: Record<string, { label: string; cls: string }> = {
          'lead_new':      { label: 'Nuovo Lead',     cls: 'bg-gray-100 text-gray-700 border border-gray-200' },
          'quote_sent':    { label: 'Preventivo Inviato', cls: 'bg-sky-100 text-sky-700 border border-sky-200' },
          'negotiation':   { label: 'Trattativa',     cls: 'bg-purple-100 text-purple-700 border border-purple-200' },
          'closed_lost':   { label: 'Persa',          cls: 'bg-gray-200 text-gray-600 border border-gray-300' },
          'pending':       { label: 'In Attesa',      cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
          'confirmed':     { label: 'Confermata',     cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
          'deposit_paid':  { label: 'Caparra Pagata', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
          'cancelled':     { label: 'Annullata',      cls: 'bg-rose-100 text-rose-700 border border-rose-200' },
        };
        const s = statusMap[row.status] || { label: row.status, cls: 'bg-gray-100 text-gray-700 border border-gray-200' };
        return (
          <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${s.cls}`}>
            {s.label}
          </div>
        );
      }
    }
  ];

  const filterableColumns: FilterableColumn[] = [
    { key: 'guest_name', label: 'Nome Ospite' },
    { key: 'guest_email', label: 'Email Ospite' },
    { key: 'properties.name', label: 'Nome Immobile' },
    { key: 'check_in_date', label: 'Data Inizio Soggiorno', type: 'date' },
    { key: 'check_out_date', label: 'Data Fine Soggiorno', type: 'date' },
    { key: 'status', label: 'Stato' }
  ];

  const bulkActions: BulkAction[] = [
    { label: 'Elimina', onClick: (ids) => { setSelectedForBulk(ids); setShowBulkDeleteModal(true); }, variant: 'danger' }
  ];

  const inputCls = "w-full border border-gray-200 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm";
  const labelCls = "block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1";

  // Filter bookings by tab
  const todayStr = new Date().toISOString().split('T')[0];
  const propertyFiltered = filterPropertyId ? bookings.filter(b => b.property_id === filterPropertyId) : bookings;
  const isActiveB = (b: any) => (b.check_in_date >= todayStr || b.check_out_date >= todayStr) && (b.status === 'pending' || b.status === 'confirmed');
  const isPendingB = (b: any) => (b.check_in_date >= todayStr || b.check_out_date >= todayStr) && b.status === 'pending';
  const isClosedB = (b: any) => (b.check_in_date < todayStr && b.check_out_date < todayStr) || b.status === 'cancelled';
  const filteredBookings = propertyFiltered.filter(b => {
    if (filterTab === 'all') return true;
    if (filterTab === 'active') return isActiveB(b);
    if (filterTab === 'pending') return isPendingB(b);
    if (filterTab === 'closed') return isClosedB(b);
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
        {[
          { id: 'all', label: 'Tutte', count: propertyFiltered.length },
          { id: 'active', label: 'Attive', count: propertyFiltered.filter(isActiveB).length },
          { id: 'pending', label: 'In Attesa', count: propertyFiltered.filter(isPendingB).length },
          { id: 'closed', label: 'Chiuse', count: propertyFiltered.filter(isClosedB).length },
        ].map(tab => (
          <button key={tab.id} onClick={() => setFilterTab(tab.id)}
            className={`px-5 py-3 rounded-xl text-sm font-bold transition inline-flex items-center gap-2 ${filterTab === tab.id ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >{tab.label} <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filterTab === tab.id ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700'}`}>{tab.count}</span></button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <select
            value={filterPropertyId}
            onChange={e => setFilterPropertyId(e.target.value)}
            className="border border-gray-200 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-gray-900"
          >
            <option value="">Tutti gli Immobili</option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {filterPropertyId && (
            <button onClick={() => setFilterPropertyId("")} className="p-2.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition" title="Rimuovi filtro">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <AdvancedDataGrid 
         title="Gestione Prenotazioni"
         data={filteredBookings}
         columns={columns}
         filterableColumns={filterableColumns}
         loading={loading}
         onAddClick={() => {
           resetWizard();
           if (filterPropertyId) {
             setSelPropId(filterPropertyId);
             loadPropertyData(filterPropertyId);
           }
           setCreateModal(true);
         }}
         addButtonLabel="Nuova Prenotazione"
         bulkActions={bulkActions}
         onRowClick={(row) => router.push(`/bookings/${row.id}`)}
         renderFooter={(filteredItems) => {
           let totalSoggiorni = 0;
           let totalDaIncassare = 0;
           let totalIncassato = 0;
           let totalCommissioni = 0;
           let totalImposte = 0;
           let totalStaff = 0;
           let totalServizi = 0;

           filteredItems.forEach((row: any) => {
             const rowPaid = (row.cash_transactions || []).filter((p: any) => p.status === 'confirmed').reduce((acc: number, p: any) => acc + Number(p.amount), 0);
             const grandTotal = Number(row.total_price) + Number(row.city_tax || 0) + Number(row.security_deposit || 0);
             const balance = grandTotal - rowPaid;
             
             totalSoggiorni += Number(row.total_price) || 0;
             totalIncassato += rowPaid;
             totalDaIncassare += Math.max(0, balance);
             
             totalCommissioni += Number(row.commission_amount || 0);
             totalImposte += Number(row.tax_amount || 0);
             totalStaff += Number(row.staff_cost || 0);
             totalServizi += Number(row.services_cost || 0);
           });
           
           const netProfit = totalSoggiorni - totalCommissioni - totalImposte - totalStaff - totalServizi;

           return (
             <div className="flex flex-col gap-3">
               <div className="flex flex-wrap items-center justify-end gap-6 text-right w-full pr-4 pb-3 border-b border-gray-200 border-dashed">
                 <div>
                   <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Totale Soggiorni</p>
                   <p className="text-xl font-bold text-gray-900">{formatCurrency(totalSoggiorni)}</p>
                 </div>
                 <div className="pl-6 border-l border-gray-200">
                   <p className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">Tasse e Costi Portale</p>
                   <p className="text-base font-bold text-purple-700">- {formatCurrency(totalCommissioni + totalImposte)}</p>
                 </div>
                 <div className="pl-6 border-l border-gray-200">
                   <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">Costi Logistici & Staff</p>
                   <p className="text-base font-bold text-amber-700">- {formatCurrency(totalStaff)}</p>
                 </div>
                 <div className="pl-6 border-l border-gray-200">
                   <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">Costi Servizi Vivi</p>
                   <p className="text-base font-bold text-orange-700">- {formatCurrency(totalServizi)}</p>
                 </div>
                 <div className="pl-6 border-l border-gray-200">
                   <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Guadagno Netto</p>
                   <p className="text-2xl font-black text-emerald-700">{formatCurrency(netProfit)}</p>
                 </div>
               </div>
               <div className="flex flex-wrap items-center justify-end gap-6 text-right w-full pr-4">
                 <div>
                   <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Totale Incassato / Cash</p>
                   <p className="text-lg font-bold text-gray-700">{formatCurrency(totalIncassato)}</p>
                 </div>
                 <div className="pl-6 border-l border-gray-200">
                   <p className="text-[10px] text-red-500 font-bold uppercase tracking-wider">Residuo da Incassare</p>
                   <p className="text-lg font-bold text-red-500">{formatCurrency(totalDaIncassare)}</p>
                 </div>
               </div>
             </div>
           );
         }}
      />

      {/* WIZARD MODAL */}
      {createModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Header con step indicator */}
            <div className="p-5 border-b bg-gradient-to-r from-blue-600 to-blue-500 text-white flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">Nuova Prenotazione</h2>
                <p className="text-blue-100 text-xs mt-0.5">
                  Step {wizardStep} di 4 — {wizardStep === 1 ? 'Seleziona Immobile' : wizardStep === 2 ? 'Date e Ospiti' : wizardStep === 3 ? 'Contatto' : 'Riepilogo'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5">
                  {[1,2,3,4].map(s => (
                    <div key={s} className={`w-2 h-2 rounded-full transition-all ${s <= wizardStep ? 'bg-white' : 'bg-white/30'}`} />
                  ))}
                </div>
                <button onClick={() => { setCreateModal(false); resetWizard(); }} className="p-2 hover:bg-white/20 rounded-full transition">
                  <X className="w-5 h-5"/>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">

              {/* ── STEP 1: Scegli Immobile ── */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">Seleziona l'immobile per questa prenotazione.</p>
                  <div className="grid grid-cols-1 gap-3 max-h-[55vh] overflow-y-auto pr-1">
                    {properties.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => { setSelPropId(p.id); loadPropertyData(p.id); }}
                        className={`text-left p-4 rounded-2xl border-2 transition-all ${selPropId === p.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-gray-900">{p.name}</p>
                            <p className="text-sm text-gray-500 mt-0.5">
                              € {p.base_price_per_night}/notte · Pulizie € {p.cleaning_fee || 0} · City Tax € {p.city_tax_per_night || 2}/notte/adulto
                            </p>
                          </div>
                          {selPropId === p.id && <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── STEP 2: Date + Ospiti ── */}
              {wizardStep === 2 && propData && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Check-in *</label>
                      <input type="date" required className={inputCls} value={checkIn} min={new Date().toISOString().split('T')[0]}
                        onChange={e => { setCheckIn(e.target.value); if (checkOut && e.target.value >= checkOut) setCheckOut(''); }} />
                    </div>
                    <div>
                      <label className={labelCls}>Check-out *</label>
                      <input type="date" required className={inputCls} value={checkOut} min={checkIn || new Date().toISOString().split('T')[0]}
                        onChange={e => setCheckOut(e.target.value)} />
                    </div>
                  </div>

                  {dateError && (
                    <div className={`flex items-start gap-2 p-3 rounded-xl text-sm font-medium ${dateError.startsWith('⚠️') ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{dateError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className={labelCls}>Adulti &ge;{(propData?.city_tax_child_age || 11) + 1} *</label>
                      <input type="number" min="1" max={propData.max_guests || 20} className={inputCls} value={adults} onChange={e => setAdults(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className={labelCls}>Bambini &le;{propData?.city_tax_child_age || 11}</label>
                      <input type="number" min="0" max={propData.max_guests || 20} className={inputCls} value={children} onChange={e => setChildren(Number(e.target.value))} />
                    </div>
                    <div>
                      <label className={labelCls}>Animali</label>
                      <input type="number" min="0" className={inputCls} value={petsCount} onChange={e => setPetsCount(Number(e.target.value))} />
                    </div>
                  </div>

                  {/* Breakdown prezzi in tempo reale */}
                  {calc.nights > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Calcolo Automatico</p>
                      {[
                        { label: `Base soggiorno (${calc.nights} notti × € ${propData.base_price_per_night})`, val: calc.basePrice },
                        { label: 'Spese Pulizie', val: calc.cleaningFee },
                        { label: `Extra Animali (${petsCount} × € ${propData.pet_fee || 0})`, val: calc.petFee },
                      ].filter(r => r.val > 0).map(r => (
                        <div key={r.label} className="flex justify-between text-sm">
                          <span className="text-gray-600">{r.label}</span>
                          <span className="font-medium">{formatCurrency(r.val)}</span>
                        </div>
                      ))}
                      <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-gray-900">
                        <span>TOTALE SOGGIORNO</span>
                        <span>{formatCurrency(calc.totalPrice)}</span>
                      </div>
                      {((calc as any).commissionAmt > 0 || (calc as any).taxAmt > 0) && (
                        <div className="mt-1 pt-2 border-t border-dashed border-gray-200 space-y-1">
                          <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wide">Spese Deducibili Portale</p>
                          {(calc as any).commissionAmt > 0 && <div className="flex justify-between text-sm text-purple-700"><span>Commissioni</span><span>- {formatCurrency((calc as any).commissionAmt)}</span></div>}
                          {(calc as any).taxAmt > 0 && <div className="flex justify-between text-sm text-purple-700"><span>Cedolare Secca</span><span>- {formatCurrency((calc as any).taxAmt)}</span></div>}
                        </div>
                      )}
                      {calc.downPayment > 0 && (
                        <div className="border-t border-dashed border-blue-200 pt-2 mt-1 space-y-1">
                          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Da versare anticipatamente (Bonifico)</p>
                          <div className="flex justify-between text-sm text-blue-700 font-medium">
                            <span>💳 Caparra ({propData.deposit_percentage}%)</span>
                            <span>{formatCurrency(calc.downPayment)}</span>
                          </div>
                        </div>
                      )}
                      {(calc.securityDeposit > 0 || calc.cityTax > 0) && (
                        <div className="border-t border-dashed border-amber-200 pt-2 mt-1 space-y-1">
                          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Da pagare in loco (cash)</p>
                          {calc.securityDeposit > 0 && (
                            <div className="flex justify-between text-sm text-red-700 font-medium">
                              <span>🔒 Cauzione danni</span>
                              <span>{formatCurrency(calc.securityDeposit)}</span>
                            </div>
                          )}
                          {calc.cityTax > 0 && (
                            <div className="flex justify-between text-sm text-amber-700 font-medium">
                              <span>🏛️ Tassa di soggiorno ({adults} adulti × {Math.min(calc.nights, propData?.city_tax_max_nights ?? 10)} notti)</span>
                              <span>{formatCurrency(calc.cityTax)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className={labelCls}>Portale (Canale di Vendita)</label>
                    <select className={inputCls} value={selChannelId} onChange={e => setSelChannelId(e.target.value)}>
                      <option value="">Diretta / Nessuno</option>
                      {channels.map(c => <option key={c.id} value={c.id}>{c.name} ({c.commission_pct}% Com. / {c.tax_pct}% Tasse)</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Stato Prenotazione</label>
                    <select className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
                      <option value="pending">In Attesa di Conferma</option>
                      <option value="confirmed">Confermata</option>
                    </select>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Contatto ── */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                    <button onClick={() => setContactMode('search')} type="button"
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${contactMode === 'search' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                      Cerca nel CRM
                    </button>
                    <button onClick={() => setContactMode('create')} type="button"
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${contactMode === 'create' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                      Crea Nuovo Contatto
                    </button>
                  </div>

                  {contactMode === 'search' && (
                    <div className="space-y-3">
                      <input type="text" placeholder="Cerca per nome, email o telefono..." className={inputCls}
                        value={contactSearch} onChange={e => setContactSearch(e.target.value)} />
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {filteredContacts.slice(0, 20).map(c => (
                          <button key={c.id} type="button" onClick={() => setSelContactId(c.id)}
                            className={`w-full text-left p-3 rounded-xl border-2 transition-all ${selContactId === c.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-bold text-gray-900 text-sm">{c.first_name} {c.last_name || ''}</p>
                                <p className="text-xs text-gray-500">{c.email || 'Nessuna email'} · {c.phone || 'Nessun telefono'}</p>
                              </div>
                              {selContactId === c.id && <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0" />}
                            </div>
                          </button>
                        ))}
                        {filteredContacts.length === 0 && (
                          <div className="text-center py-6 text-gray-400 text-sm">
                            <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            Nessun contatto trovato. Prova a crearne uno nuovo.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {contactMode === 'create' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Nome *</label>
                        <input type="text" required className={inputCls} value={newContact.first_name} onChange={e => setNewContact({...newContact, first_name: e.target.value})} />
                      </div>
                      <div>
                        <label className={labelCls}>Cognome</label>
                        <input type="text" className={inputCls} value={newContact.last_name} onChange={e => setNewContact({...newContact, last_name: e.target.value})} />
                      </div>
                      <div>
                        <label className={labelCls}>Email</label>
                        <input type="email" className={inputCls} value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} />
                      </div>
                      <div>
                        <label className={labelCls}>Telefono</label>
                        <input type="tel" className={inputCls} value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 4: Riepilogo ── */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  {(() => {
                    const prop = properties.find(p => p.id === selPropId);
                    const contact = selContactId ? contacts.find(c => c.id === selContactId) : (contactMode === 'create' ? newContact : null);
                    return (
                      <>
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-2">
                          <p className="text-xs font-bold text-blue-500 uppercase tracking-wide">Immobile</p>
                          <p className="font-bold text-gray-900">{prop?.name}</p>
                          <p className="text-sm text-gray-600">
                            {formatDateStr(checkIn)} → {formatDateStr(checkOut)} · {calc.nights} notti
                          </p>
                          <p className="text-sm text-gray-600">
                            {adults} adulti · {children} bambini · {petsCount} animali
                          </p>
                        </div>

                        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Finanziario</p>
                          {calc.basePrice > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Base soggiorno</span><span>{formatCurrency(calc.basePrice)}</span></div>}
                          {calc.cleaningFee > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Spese Pulizie</span><span>{formatCurrency(calc.cleaningFee)}</span></div>}
                          {calc.petFee > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Extra Animali</span><span>{formatCurrency(calc.petFee)}</span></div>}
                          <div className="border-t pt-2 flex justify-between font-bold text-gray-900">
                            <span>Totale Soggiorno</span><span>{formatCurrency(calc.totalPrice)}</span>
                          </div>
                          {/* Voci separate */}
                          {calc.downPayment > 0 && (
                            <div className="border-t border-dashed border-blue-200 pt-2 space-y-1">
                              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Da versare anticipatamente (Bonifico)</p>
                              <div className="flex justify-between text-sm text-blue-700 font-medium"><span>💳 Caparra ({prop?.deposit_percentage}%)</span><span>{formatCurrency(calc.downPayment)}</span></div>
                            </div>
                          )}
                          {(calc.securityDeposit > 0 || calc.cityTax > 0) && (
                            <div className="border-t border-dashed border-amber-200 pt-2 space-y-1">
                              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Da pagare in loco (cash)</p>
                              {calc.securityDeposit > 0 && <div className="flex justify-between text-sm text-red-700 font-medium"><span>🔒 Cauzione danni</span><span>{formatCurrency(calc.securityDeposit)}</span></div>}
                              {calc.cityTax > 0 && <div className="flex justify-between text-sm text-amber-700 font-medium"><span>🏛️ Tassa di soggiorno</span><span>{formatCurrency(calc.cityTax)}</span></div>}
                            </div>
                          )}
                        </div>

                        {contact && (
                          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-1">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Contatto</p>
                            <p className="font-bold text-gray-900">{contact.first_name} {contact.last_name || ''}</p>
                            {contact.email && <p className="text-sm text-gray-600">{contact.email}</p>}
                            {contact.phone && <p className="text-sm text-gray-600">{contact.phone}</p>}
                            {contactMode === 'create' && <span className="inline-block text-[10px] font-bold uppercase bg-green-100 text-green-700 px-2 py-0.5 rounded">Nuovo contatto — verrà creato nel CRM</span>}
                          </div>
                        )}

                        {dateError && (
                          <div className="flex items-start gap-2 p-3 rounded-xl text-sm font-medium bg-red-50 text-red-700 border border-red-200">
                            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{dateError}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Footer navigazione wizard */}
            <div className="p-5 border-t bg-gray-50 flex gap-3">
              {wizardStep > 1 && (
                <button type="button" onClick={() => setWizardStep(s => s - 1)}
                  className="flex-1 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold py-3 rounded-xl transition">
                  ← Indietro
                </button>
              )}
              {wizardStep < 4 && (
                <button type="button"
                  disabled={
                    (wizardStep === 1 && !selPropId) ||
                    (wizardStep === 2 && (!checkIn || !checkOut || calc.nights === 0 || dateError.length > 0)) ||
                    (wizardStep === 3 && contactMode === 'search' && !selContactId) ||
                    (wizardStep === 3 && contactMode === 'create' && !newContact.first_name)
                  }
                  onClick={() => setWizardStep(s => s + 1)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2">
                  Avanti <ChevronRight className="w-4 h-4" />
                </button>
              )}
              {wizardStep === 4 && (
                <button type="button" onClick={handleCreateBooking}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Crea Prenotazione
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      <BulkDeleteModal 
         isOpen={showBulkDeleteModal}
         onClose={() => { setShowBulkDeleteModal(false); setSelectedForBulk([]); }}
         onArchive={bulkCancel}
         onPermanentDelete={bulkDelete}
         selectedCount={selectedForBulk.length}
         itemName="prenotazioni"
      />
    </div>
  );
}
