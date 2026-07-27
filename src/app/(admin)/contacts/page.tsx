"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Users, Mail, Phone, MapPin, X } from "lucide-react";
import toast from "react-hot-toast";
import { AdvancedDataGrid, ColumnDef, FilterableColumn, BulkAction } from "@/components/ui/AdvancedDataGrid";

interface Contact {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  language: string | null;
  source: string;
  notes: string | null;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('contacts').select('*').order('created_at', { ascending: false });
    if (error) {
      toast.error("Errore caricamento contatti");
    } else {
      setContacts(data || []);
    }
    setLoading(false);
  };

  const handleSaveContact = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const updates = {
      first_name: fd.get('first_name'),
      last_name: fd.get('last_name'),
      email: fd.get('email') || null,
      phone: fd.get('phone') || null,
      city: fd.get('city') || null,
      country: fd.get('country') || null,
      language: fd.get('language') || null,
      notes: fd.get('notes'),
    };

    if (editingContact?.id) {
      // Update
      const { error } = await supabase.from('contacts').update(updates).eq('id', editingContact.id);
      if (error) toast.error("Errore salvataggio");
      else {
        toast.success("Contatto aggiornato");
        setIsEditModalOpen(false);
        fetchContacts();
      }
    } else {
      // Create new
      const { data: { user } } = await supabase.auth.getUser();
      let orgId = "";
      if (user) {
         const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
         orgId = profile?.organization_id;
      }
      if(!orgId) return toast.error("Organizzazione non trovata");

      const { error } = await supabase.from('contacts').insert({ ...updates, organization_id: orgId, source: 'manual' });
      if (error) toast.error("Errore creazione contatto");
      else {
        toast.success("Contatto creato");
        setIsEditModalOpen(false);
        fetchContacts();
      }
    }
  };

  const bulkDelete = async (selectedIds: string[]) => {
    if (!window.confirm(`Selezionati ${selectedIds.length} contatti. Sei sicuro di volerli ELIMINARE DEFINITIVAMENTE?`)) return;
    setLoading(true);
    const { error } = await supabase.from('contacts').delete().in('id', selectedIds);
    if (error) toast.error("Errore durante l'eliminazione.");
    else { toast.success(`${selectedIds.length} contatti eliminati.`); fetchContacts(); }
  };

  const columns: ColumnDef[] = [
    {
      key: 'name_details',
      label: 'Nome e Cognome',
      render: (row: Contact) => (
         <div>
             <span className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                {row.first_name} {row.last_name || ''}
             </span>
             <div className="text-xs font-medium text-gray-400 mt-1 uppercase tracking-wide">
                {row.source === 'legacy_booking' || row.source === 'booking' ? 'Prenotazione' : row.source}
             </div>
         </div>
      )
    },
    {
      key: 'contact_info',
      label: 'Contatti',
      render: (row: Contact) => (
         <div className="flex flex-col gap-1 text-gray-600 text-sm">
            {row.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 opacity-70"/> {row.email}</span>}
            {row.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 opacity-70"/> {row.phone}</span>}
         </div>
      )
    },
    {
      key: 'location',
      label: 'Località',
      render: (row: Contact) => (
         <div className="flex flex-col gap-1 text-gray-600 text-sm">
            {(row.city || row.country) ? (
                <span className="flex items-center gap-1.5">
                   <MapPin className="w-3.5 h-3.5 opacity-70"/> 
                   {row.city} {row.city && row.country ? '-' : ''} {row.country}
                </span>
            ) : <span className="text-gray-400 italic">Non spec.</span>}
            {row.language && <span className="text-[10px] items-center text-center font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded w-max mt-0.5">{row.language.toUpperCase()}</span>}
         </div>
      )
    }
  ];

  const filterableColumns: FilterableColumn[] = [
    { key: 'first_name', label: 'Nome' },
    { key: 'last_name', label: 'Cognome' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Telefono' },
    { key: 'city', label: 'Città' },
    { key: 'country', label: 'Paese' },
    { key: 'source', label: 'Origine' },
  ];

  const bulkActions: BulkAction[] = [
    { label: 'Crea Campagna Marketing (WIP)', onClick: () => toast.success("In arrivo...") },
    { label: 'Elimina', onClick: bulkDelete, variant: 'danger' }
  ];

  return (
    <div className="space-y-6">
      
      <div className="mb-4">
         <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
             <Users className="w-8 h-8 text-blue-600" />
             Anagrafica Contatti
         </h1>
         <p className="text-sm font-medium text-gray-500 mt-1">
             Gestisci Lead e Ospiti per le tue campagne marketing
         </p>
      </div>

      <AdvancedDataGrid 
         data={contacts}
         columns={columns}
         filterableColumns={filterableColumns}
         loading={loading}
         onAddClick={() => { setEditingContact(null); setIsEditModalOpen(true); }}
         addButtonLabel="Nuovo Contatto"
         bulkActions={bulkActions}
         onRowClick={(row) => { setEditingContact(row); setIsEditModalOpen(true); }}
      />

      {isEditModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
             <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                <h2 className="text-xl font-bold">{editingContact ? 'Modifica Contatto' : 'Nuovo Contatto'}</h2>
                <button onClick={() => setIsEditModalOpen(false)} className="p-2.5 hover:bg-gray-200 rounded-full"><X className="w-5 h-5"/></button>
             </div>
             <form onSubmit={handleSaveContact} className="p-6 space-y-4">
                <div className="grid-cols-1 md:grid-cols-2 gap-4 grid">
                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome *</label>
                      <input name="first_name" required defaultValue={editingContact?.first_name} className="w-full border p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cognome</label>
                      <input name="last_name" defaultValue={editingContact?.last_name || ''} className="w-full border p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                      <input name="email" type="email" defaultValue={editingContact?.email || ''} className="w-full border p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefono</label>
                      <input name="phone" defaultValue={editingContact?.phone || ''} className="w-full border p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                   </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Città</label>
                      <input name="city" defaultValue={editingContact?.city || ''} className="w-full border p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Paese</label>
                      <input name="country" defaultValue={editingContact?.country || ''} className="w-full border p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Lingua</label>
                      <input name="language" placeholder="IT, EN..." defaultValue={editingContact?.language || ''} className="w-full border p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />
                   </div>
                </div>
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Dettagli Marketing (Note)</label>
                   <textarea name="notes" rows={2} defaultValue={editingContact?.notes || ''} className="w-full border p-2.5 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
                </div>
                <div className="pt-4 border-t flex gap-3">
                   <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold py-3 rounded-xl transition">Annulla</button>
                   <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition">
                      {editingContact ? 'Aggiorna Anagrafica' : 'Salva Contatto'}
                   </button>
                </div>
             </form>
          </div>
       </div>
      )}
    </div>
  );
}
