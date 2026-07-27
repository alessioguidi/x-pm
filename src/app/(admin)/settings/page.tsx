import { supabase } from "@/utils/supabase/client";
import SettingsEditor from "@/components/SettingsEditor";
import ActivityTypesEditor from "@/components/ActivityTypesEditor";
import BookingChannelsEditor from "@/components/BookingChannelsEditor";
import UsersManagement from "@/components/UsersManagement";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Prendiamo la prima (e unica per ora) organizzazione
  const { data: org } = await supabase
    .from('organizations')
    .select('*')
    .limit(1)
    .single();

  if (!org) {
    return <div className="p-8 text-center text-red-500">Nessuna organizzazione trovata. Contatta il supporto.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Impostazioni</h1>
      <SettingsEditor organization={org} />
      <BookingChannelsEditor orgId={org.id} />
      <ActivityTypesEditor orgId={org.id} />
      <UsersManagement orgId={org.id} />
    </div>
  );
}
