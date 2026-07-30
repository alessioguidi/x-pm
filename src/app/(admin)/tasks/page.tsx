"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { ChevronLeft, ChevronRight, Loader2, CheckSquare, Calendar as CalendarIcon, User, Layers, Search, MapPin, Plus, Check, Settings, X, Edit2, Trash2, ExternalLink } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import Link from "next/link";
import toast from "react-hot-toast";

interface ActivityType {
  id: string;
  name: string;
  color: string;
  is_system: boolean;
}

interface Task {
  id: string; 
  isVirtual: boolean;
  activity_type_id?: string;
  type: string;
  color: string;
  date: string; // YYYY-MM-DD
  staff_id: string | null;
  staff_name: string | null;
  booking: any;
  property: { id: string; name: string } | null;
  status: 'pending' | 'completed';
  notes?: string;
  completed_at?: string;
  virtual_id_reference?: string;
}

export default function TasksPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("all");
  const [properties, setProperties] = useState<any[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [showCompleted, setShowCompleted] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'all' | 'ops' | 'crm'>('all');
  const [viewMode, setViewMode] = useState<'month' | 'week'>('week');
  const [loading, setLoading] = useState(true);
  
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [activeDeals, setActiveDeals] = useState<any[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [myStaffId, setMyStaffId] = useState<string>("");

  // Modals
  const [taskModal, setTaskModal] = useState<{ open: boolean; task?: Task | null; date?: Date | null }>({ open: false });
  const [settingsModal, setSettingsModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, [currentDate]);

  const fetchData = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    let currentOrgId = "";
    if (user) {
        const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
        if(profile) currentOrgId = profile.organization_id;
        
        // Cerca se esiste un record staff collegato all'utente corrente
        const { data: staffMe } = await supabase.from('staff_members').select('id').eq('user_id', user.id).maybeSingle();
        if (staffMe) setMyStaffId(staffMe.id);
    }
    if (!currentOrgId) {
      const { data: fallback } = await supabase.from('organizations').select('id').limit(1).single();
      if (fallback) currentOrgId = fallback.id;
    }
    setOrgId(currentOrgId);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    // Fetch Staff & Properties & Activity Types & Active Deals
    const [staffRes, propsRes, typesRes, dealsRes] = await Promise.all([
       supabase.from('staff_members').select('id, name, role'),
       supabase.from('properties').select('id, name').order('name'),
       supabase.from('activity_types').select('*').order('created_at'),
       supabase.from('bookings').select('id, guest_name, status, check_in_date').in('status', ['lead_new', 'quote_sent', 'negotiation', 'pending', 'confirmed'])
    ]);

    if (staffRes.data) setStaffMembers(staffRes.data);
    if (propsRes.data) setProperties(propsRes.data);
    if (typesRes.data) setActivityTypes(typesRes.data);
    if (dealsRes.data) setActiveDeals(dealsRes.data);

    const staffMap = new Map();
    staffRes.data?.forEach(s => staffMap.set(s.id, s.name));
    const typeMap = new Map();
    typesRes.data?.forEach(t => typeMap.set(t.name, t));

    const monthStartStr = monthStart.toISOString().split('T')[0];
    const monthEndStr = monthEnd.toISOString().split('T')[0];

    // Fetch DB Tasks Log
    const { data: dbTasks } = await supabase.from('tasks_log')
       .select('*, properties(id, name), bookings(guest_name)')
       .gte('scheduled_date', monthStartStr)
       .lte('scheduled_date', monthEndStr);

    // Fetch Bookings for Virtual Tasks
    const persistedVirtualIds = new Set(dbTasks?.map(t => t.virtual_id_reference).filter(Boolean));

    const { data: bookings } = await supabase.from('bookings')
      .select('*, properties(id, name, default_checkin_staff_id, default_checkout_staff_id, default_cleaning_staff_id, deposit_method)')
      .in('status', ['pending', 'confirmed'])
      .or(`check_in_date.gte.${monthStartStr},check_out_date.gte.${monthStartStr}`);

    const allTasks: Task[] = [];

    // Parse DB Tasks
    dbTasks?.forEach(dt => {
       const aType = typesRes.data?.find(a => a.id === dt.activity_type_id);
       allTasks.push({
         id: dt.id,
         isVirtual: false,
         activity_type_id: dt.activity_type_id,
         type: aType?.name || 'Sconosciuto',
         color: aType?.color || 'bg-gray-100 text-gray-800 border-gray-200',
         date: dt.scheduled_date,
         staff_id: dt.staff_member_id,
         staff_name: dt.staff_member_id ? staffMap.get(dt.staff_member_id) : null,
         property: dt.properties || null,
         booking: dt.bookings || null,
         status: dt.status,
         completed_at: dt.completed_at,
         notes: dt.notes,
         virtual_id_reference: dt.virtual_id_reference
       });
    });

    // Parse Bookings
    bookings?.forEach(b => {
      const p = b.properties;
      if (!p) return;

      const c_in = b.checkin_staff_id || p.default_checkin_staff_id;
      const c_out = b.checkout_staff_id || p.default_checkout_staff_id;
      const c_clean = b.cleaning_staff_id || p.default_cleaning_staff_id;

      const addVirtual = (ref: string, date: string, typeName: string, staff: string) => {
         if (persistedVirtualIds.has(ref)) return; // already exists in DB as completed/edited
         if (date < monthStartStr || date > monthEndStr) return; // out of scope
         
         const aType = typeMap.get(typeName);
         allTasks.push({
           id: ref,
           isVirtual: true,
           activity_type_id: aType?.id,
           type: typeName,
           color: aType?.color || 'bg-gray-100 text-gray-800 border-gray-200',
           date: date,
           staff_id: staff,
           staff_name: staff ? staffMap.get(staff) : null,
           booking: { ...b, guest_name: b.guest_name },
           property: p,
           status: 'pending',
           virtual_id_reference: ref
         });
      };

      addVirtual(`${b.id}-in`, b.check_in_date, 'Check-in', c_in);
      addVirtual(`${b.id}-out`, b.check_out_date, 'Check-out', c_out);
      addVirtual(`${b.id}-clean`, b.check_out_date, 'Pulizie', c_clean);

      // Notification link tasks
      const checkInLinkDate = new Date(b.check_in_date);
      checkInLinkDate.setDate(checkInLinkDate.getDate() - 1);
      addVirtual(`${b.id}-checkin-link`, checkInLinkDate.toISOString().split('T')[0], 'Invio Link Check-in', '');
      if (p.deposit_method === 'stripe') {
        addVirtual(`${b.id}-deposit-link`, b.check_in_date, 'Invio Link Cauzione', '');
      }
      addVirtual(`${b.id}-checkout-link`, b.check_out_date, 'Invio Link Check-out', '');
    });

    setTasks(allTasks);
    setLoading(false);
  };

  const nextPeriod = () => setCurrentDate(viewMode === 'month' ? addMonths(currentDate, 1) : addWeeks(currentDate, 1));
  const prevPeriod = () => setCurrentDate(viewMode === 'month' ? subMonths(currentDate, 1) : subWeeks(currentDate, 1));

  const startDate = viewMode === 'month' ? startOfMonth(currentDate) : startOfWeek(currentDate, { weekStartsOn: 1 });
  const endDate = viewMode === 'month' ? endOfMonth(currentDate) : endOfWeek(currentDate, { weekStartsOn: 1 });

  const startDay = startDate.getDay();
  const paddingDays = startDay === 0 ? 6 : startDay - 1; // 0 is Sunday
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const filteredTasks = tasks.filter(t => {
      if (!showCompleted && t.status === 'completed') return false;

      const isOps = ['Check-in', 'Check-out', 'Pulizie'].includes(t.type);
      if (activeTab === 'ops' && !isOps) return false;
      if (activeTab === 'crm' && isOps) return false;

      const matchStaff = selectedStaffId === 'all' || t.staff_id === selectedStaffId;
      const matchProp = selectedPropertyId === 'all' || t.property?.id === selectedPropertyId;
      const term = searchTerm.toLowerCase();
      const matchSearch = !term || 
        t.booking?.guest_name?.toLowerCase().includes(term) ||
        t.property?.name.toLowerCase().includes(term) ||
        t.type.toLowerCase().includes(term) ||
        t.staff_name?.toLowerCase().includes(term);
        
      return matchStaff && matchProp && matchSearch;
  });

  const getDayTasks = (date: Date) => {
     return filteredTasks.filter(t => isSameDay(parseISO(t.date), date));
  };


  /* --- HANDLERS --- */
  const handleSaveTask = async (e: any) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const notes = fd.get('notes') as string;
    const staffId = fd.get('staff_id') as string;
    const propId = fd.get('property_id') as string;
    const typeId = fd.get('activity_type_id') as string;
    const status = fd.get('status') as string;
    const bookingId = fd.get('booking_id') as string;
    const t = taskModal.task;

    if (!t) {
      // Create new manual task
      const { error } = await supabase.from('tasks_log').insert({
        organization_id: orgId,
        scheduled_date: taskModal.date ? format(taskModal.date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        activity_type_id: typeId,
        property_id: propId || null,
        staff_member_id: staffId || null,
        booking_id: bookingId || null,
        status: status,
        notes: notes,
        completed_at: status === 'completed' ? new Date().toISOString() : null
      });
      if (error) toast.error("Errore salvataggio task");
      else { toast.success("Task creato"); setTaskModal({open: false}); fetchData(); }
    } else {
      // Edit/Complete existing
      if (t.isVirtual) {
         // Create it in DB
         const { error } = await supabase.from('tasks_log').insert({
            organization_id: orgId,
            scheduled_date: t.date,
            activity_type_id: typeId || t.activity_type_id,
            property_id: propId || t.property?.id || null,
            staff_member_id: staffId || t.staff_id || null,
            booking_id: t.booking?.id || null,
            virtual_id_reference: t.virtual_id_reference,
            status: status,
            notes: notes,
            completed_at: status === 'completed' ? new Date().toISOString() : null
         });
         if (error) toast.error("Errore completamento task");
         else { toast.success("Task aggiornato/completato"); setTaskModal({open: false}); fetchData(); }
      } else {
         // Update DB
         const { error } = await supabase.from('tasks_log').update({
            activity_type_id: typeId || t.activity_type_id,
            property_id: propId || t.property?.id || null,
            staff_member_id: staffId || t.staff_id || null,
            booking_id: bookingId || t.booking?.id || null,
            status: status,
            notes: notes,
            completed_at: status === 'completed' && t.status !== 'completed' ? new Date().toISOString() : t.completed_at
         }).eq('id', t.id);
         if (error) toast.error("Errore aggiornamento task");
         else { toast.success("Task aggiornato"); setTaskModal({open: false}); fetchData(); }
      }
    }
  };

  const handleAddActivity = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get('name') as string;
    const color = fd.get('color') as string;
    if (!name || !color) return toast.error("Compila tutti i campi");

    const { error } = await supabase.from('activity_types').insert({
       organization_id: orgId,
       name,
       color,
       is_system: false
    });
    if (error) toast.error("Errore creazione: " + error.message);
    else { toast.success("Attività aggiunta"); fetchData(); (e.target as HTMLFormElement).reset(); }
  };

  const handleDeleteActivity = async (id: string) => {
    if (!window.confirm("Sicuro di voler eliminare questa categoria? I task associati perderanno l'etichetta o verranno cancellati.")) return;
    const { error } = await supabase.from('activity_types').delete().eq('id', id);
    if (error) toast.error("Errore eliminazione");
    else { toast.success("Attività eliminata"); fetchData(); }
  };


  /* --- COMPONENTS --- */
  const TaskBadge = ({ task }: { task: Task }) => {
     const isCompleted = task.status === 'completed';
     const baseColor = isCompleted ? 'bg-gray-100 text-gray-500 border-gray-300 shadow-none opacity-80' : task.color;

     return (
        <div 
           onClick={(e) => { e.stopPropagation(); setTaskModal({ open: true, task }); }}
           className={`p-1.5 mb-1.5 rounded-lg border text-[10px] font-bold shadow-sm ${baseColor} cursor-pointer hover:scale-[1.02] transition-transform`}
        >
           <div className={`flex justify-between items-center mb-0.5 ${isCompleted ? 'line-through decoration-gray-400 opacity-60' : ''}`}>
             <span className="uppercase tracking-wider flex items-center gap-1">
                {isCompleted && <Check className="w-3 h-3"/>}
                {task.type}
             </span>
              {task.booking && <span className="text-gray-500 bg-white/50 px-1 rounded-sm flex items-center gap-1">
                {task.booking.guest_name?.split(' ')[0]}
                <Link href={`/bookings/${task.booking.id}`} onClick={(e) => e.stopPropagation()} className="hover:text-blue-600 transition-colors">
                  <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              </span>}
           </div>
           <div className="flex flex-col gap-0.5">
              {task.property && <span className="truncate flex items-center gap-1"><Layers className="w-2.5 h-2.5 opacity-50"/> {task.property.name}</span>}
              <span className="truncate flex items-center gap-1 opacity-70"><User className="w-2.5 h-2.5"/> {task.staff_name || 'Da assegnare'}</span>
           </div>
        </div>
     );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <CheckSquare className="w-8 h-8 text-blue-600" />
            Agenda
          </h1>
          <p className="text-sm font-medium text-gray-500 mt-1">
             Pianificazione operativa e tracciamento interventi.
          </p>
        </div>
        
        <div className="flex flex-col lg:flex-row items-center gap-3 bg-white p-2 border border-gray-200 shadow-sm rounded-2xl">
           
           {/* Search Filter */}
           <div className="flex items-center gap-2 border-b lg:border-b-0 lg:border-r border-gray-100 pb-2 lg:pb-0 lg:pr-3 w-full lg:w-auto">
              <Search className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
              <input 
                 type="text"
                 placeholder="Cerca ospite/task..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="bg-transparent text-sm text-gray-700 outline-none w-full lg:w-32 py-1 placeholder-gray-400"
              />
           </div>

           {/* Property Filter */}
           <div className="flex items-center gap-2 border-b lg:border-b-0 lg:border-r border-gray-100 pb-2 lg:pb-0 lg:pr-3 w-full lg:w-auto">
              <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
              <select 
                 value={selectedPropertyId} 
                 onChange={(e) => setSelectedPropertyId(e.target.value)}
                 className="bg-transparent text-sm font-bold text-gray-700 outline-none w-full lg:w-32 py-1"
              >
                  <option value="all">Tutti Immobili</option>
                  <option value="" disabled>---</option>
                  {properties.map(p => <option key={p.id} value={p.id} className="truncate">{p.name}</option>)}
              </select>
           </div>

           {/* Staff Filter */}
           <div className="flex items-center gap-2 border-b lg:border-b-0 lg:border-r border-gray-100 pb-2 lg:pb-0 lg:pr-3 w-full lg:w-auto">
              <User className="w-4 h-4 text-gray-400 shrink-0" />
              <select 
                 value={selectedStaffId} 
                 onChange={(e) => setSelectedStaffId(e.target.value)}
                 className="bg-transparent text-sm font-bold text-gray-700 outline-none w-full lg:w-36 py-1"
              >
                  <option value="all">Tutto lo Staff</option>
                  <option value="" disabled>---</option>
                  {staffMembers.map(s => <option key={s.id} value={s.id} className="truncate">{s.name} ({s.role})</option>)}
              </select>
           </div>

           {/* Setup Button */}
           <button onClick={() => setSettingsModal(true)} className="p-2 hover:bg-gray-100 text-gray-600 rounded-xl transition border-r border-gray-100 pr-3">
              <Settings className="w-5 h-5" />
           </button>

           {/* View Mode Toggle */}
           <div className="flex bg-gray-100 p-1 rounded-xl w-full lg:w-auto mt-2 lg:mt-0">
              <button onClick={() => setViewMode('month')} className={`px-5 py-2 text-sm font-bold rounded-lg transition ${viewMode === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Mese</button>
              <button onClick={() => setViewMode('week')} className={`px-5 py-2 text-sm font-bold rounded-lg transition ${viewMode === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Settimana</button>
           </div>

           {/* Nav */}
           <div className="flex items-center gap-2 w-full lg:w-auto px-2 justify-center">
              <button 
                onClick={prevPeriod}
                className="p-2.5 hover:bg-gray-100 text-gray-600 rounded-xl transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h2 className="text-[15px] font-black text-gray-900 capitalize min-w-[140px] text-center">
                {viewMode === 'month' ? format(currentDate, 'MMMM yyyy', { locale: it }) : `${format(startDate, 'd MMM')} - ${format(endDate, 'd MMM yyyy', { locale: it })}`}
              </h2>
              <button 
                onClick={nextPeriod}
                className="p-2.5 hover:bg-gray-100 text-gray-600 rounded-xl transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
           </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
            <button onClick={() => setActiveTab('all')} className={`px-4 py-2.5 text-sm font-bold rounded-lg transition ${activeTab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
               Agenda Globale
            </button>
            <button onClick={() => setActiveTab('ops')} className={`px-4 py-2.5 text-sm font-bold rounded-lg transition ${activeTab === 'ops' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
               🧹 Operazioni Staff
            </button>
            <button onClick={() => setActiveTab('crm')} className={`px-4 py-2.5 text-sm font-bold rounded-lg transition ${activeTab === 'crm' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
               💼 Attività CRM
            </button>
          </div>

          <div className="flex items-center space-x-2">
             <input 
                type="checkbox" 
                id="showCompleted" 
                checked={showCompleted} 
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 outline-none w-4 h-4"
             />
             <label htmlFor="showCompleted" className="text-sm text-gray-600 font-medium cursor-pointer">Includi completate (Storico)</label>
          </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Calendar Header */}
        <div className="hidden md:grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
            <div key={day} className="py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-widest border-r border-gray-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Body */}
        {loading ? (
             <div className="h-96 flex justify-center items-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
             </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-7 auto-rows-[minmax(140px,auto)] bg-gray-100 gap-[1px]">
              {viewMode === 'month' && Array.from({ length: paddingDays }).map((_, i) => (
                <div key={`empty-${i}`} className="hidden md:block bg-gray-50/50 p-2 opacity-50" />
              ))}
              
              {days.map(day => {
                const dayTasks = getDayTasks(day);
                const isToday = isSameDay(day, new Date());
                
                return (
                  <div 
                    key={day.toISOString()} 
                    onClick={() => setTaskModal({ open: true, date: day, task: null })}
                    className={`bg-white p-2 border-t-4 transition-colors cursor-cell ${
                      isToday ? 'border-t-blue-500 bg-blue-50/30' : 'border-t-transparent hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-blue-600 text-white' : 'text-gray-700'
                      }`}>
                        {format(day, 'd')}
                      </span>
                      <span className="md:hidden ml-2 flex-1 font-bold text-gray-600 capitalize text-sm">
                        {format(day, 'EEEE', {locale:it})}
                      </span>
                      {dayTasks.length > 0 && (
                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                          {dayTasks.length}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col">
                       {dayTasks.map(task => (
                          <TaskBadge key={task.id} task={task} />
                       ))}
                    </div>
                  </div>
                );
              })}
              
              {/* Fill remaining days to complete the grid */}
              {Array.from({ length: (7 - ((paddingDays + days.length) % 7)) % 7 }).map((_, i) => (
                <div key={`empty-end-${i}`} className="bg-gray-50/50 p-2 opacity-50" />
              ))}
            </div>
        )}
      </div>

      {/* TASK MODAL */}
      {taskModal.open && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
               <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                  <h2 className="text-xl font-bold flex items-center">
                     {taskModal.task ? <Edit2 className="w-5 h-5 mr-2 text-blue-600"/> : <Plus className="w-5 h-5 mr-2 text-blue-600"/>}
                     {taskModal.task ? 'Gestisci Attività' : 'Nuova Attività'}
                  </h2>
                  <button onClick={() => setTaskModal({open: false})} className="p-2 hover:bg-gray-200 rounded-full"><X className="w-5 h-5"/></button>
               </div>
               <form onSubmit={handleSaveTask} className="p-6 space-y-4">
                  {taskModal.task?.isVirtual && (
                     <div className="bg-blue-50 text-blue-800 p-3 rounded-lg text-sm mb-4 border border-blue-100">
                        Questo task è vincolato alla prenotazione di <strong>{taskModal.task.booking?.guest_name}</strong>. Modificandolo, salverai uno storico separato nel database operativo.
                     </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo Attività</label>
                        <select name="activity_type_id" defaultValue={taskModal.task?.activity_type_id || activityTypes[0]?.id} className="w-full border p-2.5 rounded-xl bg-white" required>
                           {activityTypes.map(at => <option key={at.id} value={at.id}>{at.name}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Data</label>
                        <input type="text" readOnly value={format(taskModal.task?.date ? parseISO(taskModal.task.date) : (taskModal.date as Date), 'dd MMMM yyyy', { locale: it })} className="w-full border p-2.5 rounded-xl bg-gray-50 text-gray-600 font-medium" />
                     </div>
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Operatore Assegnato</label>
                     <select name="staff_id" defaultValue={taskModal.task?.staff_id || myStaffId || ""} className="w-full border p-2.5 rounded-xl bg-white">
                        <option value="">Nessuno (Da Assegnare)</option>
                        {staffMembers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                     </select>
                  </div>
                  
                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Immobile di Riferimento</label>
                     <select name="property_id" defaultValue={taskModal.task?.property?.id || ""} className="w-full border p-2.5 rounded-xl bg-white">
                        <option value="">Nessuno / Attività d'Ufficio</option>
                        {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                     </select>
                  </div>

                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Collega a Prenot.</label>
                      <select name="booking_id" defaultValue={taskModal.task?.booking?.id || ""} className="w-full border p-2.5 rounded-xl bg-white">
                         <option value="">Nessun Collegamento CRM</option>
                         {activeDeals.map(d => (
                             <option key={d.id} value={d.id}>
                                {d.guest_name} ({['pending', 'confirmed'].includes(d.status) ? 'Prenot.' : 'Trattativa'})
                             </option>
                         ))}
                      </select>
                      {taskModal.task?.booking?.id && (
                        <Link href={`/bookings/${taskModal.task.booking.id}`} onClick={() => setTaskModal({open: false})} className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-bold transition-colors">
                          <ExternalLink className="w-3 h-3" /> Apri scheda prenotazione
                        </Link>
                      )}
                   </div>

                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Stato Attività</label>
                     <select name="status" defaultValue={taskModal.task?.status || "pending"} className="w-full border p-2.5 rounded-xl font-bold bg-white">
                        <option value="pending">In Attesa (Da Fare)</option>
                        <option value="completed">COMPLETATO</option>
                     </select>
                  </div>

                  <div>
                     <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Note (Appunti operatore o manager)</label>
                     <textarea name="notes" rows={3} defaultValue={taskModal.task?.notes || ""} className="w-full border p-2.5 rounded-xl resize-none" placeholder="Es. sostituita bombola ed eseguito test cucina..."></textarea>
                  </div>

                  <div className="pt-4 border-t flex gap-3">
                     <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition">Salva Attività</button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* SETTINGS MODAL */}
      {settingsModal && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
               <div className="p-6 border-b flex justify-between items-center bg-gray-50 shrink-0">
                  <h2 className="text-xl font-bold flex items-center">
                     <Settings className="w-5 h-5 mr-2 text-blue-600"/>
                     Gestione Tipi Attività (Categorie)
                  </h2>
                  <button onClick={() => setSettingsModal(false)} className="p-2 hover:bg-gray-200 rounded-full"><X className="w-5 h-5"/></button>
               </div>
               
               <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50 space-y-4">
                  <p className="text-sm text-gray-600 mb-6">Aggiungi etichette per ogni tipologia di intervento. Le categorie "Di Sistema" non possono essere modificate.</p>
                  
                  {/* Nuova Attività Form */}
                  <form onSubmit={handleAddActivity} className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm flex flex-col sm:flex-row gap-3 items-end">
                     <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Nome Categoria</label>
                        <input type="text" name="name" required className="w-full border p-2 rounded-lg" placeholder="es. Riparazioni, Giardinaggio..." />
                     </div>
                     <div className="flex-1">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Colore Etichetta</label>
                        <select name="color" required className="w-full border p-2 rounded-lg bg-gray-50">
                           <option value="bg-gray-100 text-gray-800 border-gray-200">Grigio Chiaro</option>
                           <option value="bg-blue-100 text-blue-800 border-blue-300">Blu (Standard)</option>
                           <option value="bg-emerald-100 text-emerald-800 border-emerald-300">Verde Smeraldo</option>
                           <option value="bg-rose-100 text-rose-800 border-rose-300">Rosso Rosa</option>
                           <option value="bg-amber-100 text-amber-800 border-amber-300">Giallo Ambra</option>
                           <option value="bg-purple-100 text-purple-800 border-purple-300">Viola</option>
                           <option value="bg-orange-100 text-orange-800 border-orange-300">Arancione</option>
                        </select>
                     </div>
                     <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-sm">+</button>
                  </form>

                  <div className="space-y-3 mt-6">
                    {activityTypes.map(at => (
                       <div key={at.id} className="flex items-center justify-between bg-white p-4 rounded-xl border shadow-sm group">
                          <div className="flex items-center gap-3">
                             <div className={`w-6 h-6 rounded border ${at.color.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('border-')).join(' ')}`}></div>
                             <div>
                                <span className={`font-bold ${at.color.split(' ').find(c => c.startsWith('text-')) || 'text-gray-800'}`}>{at.name}</span>
                                {at.is_system && <span className="ml-2 text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Di Sistema</span>}
                             </div>
                          </div>
                          {!at.is_system && (
                             <button onClick={() => handleDeleteActivity(at.id)} className="opacity-0 group-hover:opacity-100 text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition">
                                Elimina
                             </button>
                          )}
                       </div>
                    ))}
                  </div>
               </div>
            </div>
         </div>
      )}

    </div>
  );
}
