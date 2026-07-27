"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { ArrowLeft, Save, Building2 } from "lucide-react";
import Link from "next/link";

export default function NewPropertyPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    organization_id: "",
    name: "",
    slug: "",
    city: "",
    base_price_per_night: 0,
    bedrooms: 1,
    max_guests: 2
  });

  useEffect(() => {
    async function fetchOrgs() {
      const { data } = await supabase.from("organizations").select("id, name");
      if (data && data.length > 0) {
        setOrganizations(data);
        setFormData(prev => ({ ...prev, organization_id: data[0].id }));
      }
    }
    fetchOrgs();
  }, []);

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: insertError } = await supabase.from("properties").insert([
      {
        organization_id: formData.organization_id,
        name: formData.name,
        slug: formData.slug || generateSlug(formData.name),
        city: formData.city,
        base_price_per_night: formData.base_price_per_night,
        bedrooms: formData.bedrooms,
        max_guests: formData.max_guests,
        is_active: false // Parte sempre come bozza
      }
    ]);

    if (insertError) {
      console.error(insertError);
      setError("Errore durante il salvataggio. Assicurati di aver clonato lo schema su Supabase.");
      setLoading(false);
    } else {
      router.push("/properties");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/properties" className="p-2.5 text-gray-500 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Nuovo Immobile</h1>
      </div>

      <form onSubmit={handleCreate} className="bg-white p-6 border border-gray-200 rounded-lg shadow-sm space-y-6">
        
        {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md">{error}</div>}

        {/* B2B / SaaS Context */}
        <div className="bg-blue-50 p-4 rounded-md border border-blue-100 mb-6">
          <label className="flex items-center text-sm font-medium text-blue-900 mb-2">
            <Building2 className="w-4 h-4 mr-2" />
            Assegna all'Organizzazione (Contesto Multi-Tenant)
          </label>
          <select 
            required
            className="block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm bg-white text-gray-900"
            value={formData.organization_id}
            onChange={e => setFormData({...formData, organization_id: e.target.value})}
          >
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome Struttura</label>
            <input 
              required
              type="text" 
              placeholder="Es: Villa Belvedere"
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-gray-900"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Identificativo URL (Slug)</label>
            <input 
              type="text" 
              placeholder="Lascia vuoto per generare in automatico"
              className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm bg-gray-50 sm:text-sm text-gray-900"
              value={formData.slug}
              onChange={e => setFormData({...formData, slug: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Città</label>
              <input 
                required
                type="text" 
                className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={formData.city}
                onChange={e => setFormData({...formData, city: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Prezzo Notte (Base) €</label>
              <input 
                required
                type="number" 
                min="0"
                className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={formData.base_price_per_night}
                onChange={e => setFormData({...formData, base_price_per_night: Number(e.target.value)})}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Numero Camere</label>
              <input 
                type="number" 
                min="1"
                className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={formData.bedrooms}
                onChange={e => setFormData({...formData, bedrooms: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Ospiti Massimi</label>
              <input 
                type="number" 
                min="1"
                className="mt-1 block w-full rounded-md border-gray-300 border p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={formData.max_guests}
                onChange={e => setFormData({...formData, max_guests: Number(e.target.value)})}
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <button 
            type="submit" 
            disabled={loading}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Salvataggio...' : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Salva Immobile
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
