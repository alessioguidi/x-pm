"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/utils/supabase/client";
import { FormatConfig, DEFAULT_FORMAT, setFormatConfig, getFormatConfig } from "@/lib/format";

const FormatContext = createContext<FormatConfig>(DEFAULT_FORMAT);

export function FormatProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<FormatConfig>(DEFAULT_FORMAT);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
      if (!profile?.organization_id) return;
      const { data: org } = await supabase.from("organizations").select("number_format, date_format, currency").eq("id", profile.organization_id).single();
      if (org) {
        const merged: FormatConfig = {
          ...DEFAULT_FORMAT,
          number: (org.number_format as any) || DEFAULT_FORMAT.number,
          locale: (org.number_format as any) || DEFAULT_FORMAT.locale,
          date: (org.date_format as any) || DEFAULT_FORMAT.date,
          currency: org.currency || DEFAULT_FORMAT.currency,
        };
        setFormatConfig(merged);
        setConfig(merged);
      }
    })();
  }, []);

  return <FormatContext.Provider value={config}>{children}</FormatContext.Provider>;
}

export function useFormat() {
  return useContext(FormatContext);
}
