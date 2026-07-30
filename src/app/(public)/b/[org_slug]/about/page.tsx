import { supabase } from "@/utils/supabase/client";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function AboutPage({ params }: { params: Promise<{ org_slug: string }> }) {
  const { org_slug } = await params;
  const { data: org } = await supabase.from('organizations').select('name, page_about, theme_color').eq('slug', org_slug).single();
  if (!org) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-in fade-in duration-500">
      <Link href={`/b/${org_slug}`} className="inline-flex items-center text-sm font-medium hover:underline mb-8 transition-colors font-bold" style={{ color: 'var(--theme-color)'}}>
        <ArrowLeft className="w-4 h-4 mr-1" /> Torna alla vetrina
      </Link>
      <h1 className="text-3xl font-extrabold text-gray-900 mb-8">Chi Siamo</h1>
      <div className="prose prose-gray max-w-none text-gray-700 whitespace-pre-line">
        {org.page_about || "Nessuna informazione disponibile."}
      </div>
    </div>
  );
}
