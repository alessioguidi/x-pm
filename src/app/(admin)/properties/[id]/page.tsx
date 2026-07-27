import { supabase } from "@/utils/supabase/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import PropertyDetailTabs from "@/components/PropertyDetailTabs";

export const dynamic = 'force-dynamic';

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const { data: property, error } = await supabase
    .from("properties")
    .select("*, organizations(name)")
    .eq("id", resolvedParams.id)
    .single();

  if (!property) return <div className="p-12 text-center">Immobile non trovato.</div>;

  return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center space-x-4">
          <Link href="/properties" className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">{property.name}</h1>
        </div>

        <PropertyDetailTabs property={property} />
      </div>
  );
}
