import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const authHeader = req.headers.get("Authorization");

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader || "" } }
  });

  try {
    const { org_id, action } = await req.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });

    const apiUrl = (process.env.EVOLUTION_API_URL || "").replace(/\/$/, "");
    const apiKey = process.env.EVOLUTION_API_KEY || "";

    if (!apiUrl || !apiKey) {
      return NextResponse.json({ error: "Variabili Evolution API mancanti nel Server." }, { status: 500 });
    }

    const instanceName = `org-${org_id.replace(/-/g, "").substring(0, 20)}`;
    const evoHeaders: Record<string, string> = { "Content-Type": "application/json", apikey: apiKey };

    // --- STATUS ---
    if (action === "status") {
      let status = "not_created";
      let phoneNumber: string | null = null;
      let qrCode: string | null = null;
      let lastActivity: string | null = null;
      let lastEvent: string | null = null;

      try {
        const stateRes = await fetch(`${apiUrl}/instance/connectionState/${instanceName}`, {
          method: "GET",
          headers: evoHeaders,
          signal: AbortSignal.timeout(8000),
        });
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          status = (
            stateData?.instance?.state ||
            stateData?.state ||
            stateData?.connectionStatus ||
            "unknown"
          ).toLowerCase();
          lastActivity = stateData?.instance?.lastActivity || null;
          lastEvent = stateData?.lastEvent || null;
        }
      } catch { /* instance not found */ }

      // Get phone number from fetchInstances
      try {
        const fetchRes = await fetch(
          `${apiUrl}/instance/fetchInstances?instanceName=${encodeURIComponent(instanceName)}`,
          { method: "GET", headers: evoHeaders, signal: AbortSignal.timeout(6000) }
        );
        if (fetchRes.ok) {
          const fetchData = await fetchRes.json();
          const instances = Array.isArray(fetchData) ? fetchData : (fetchData?.data || [fetchData]);
          const inst = instances.find((i: any) =>
            (i.instance?.instanceName || i.instanceName) === instanceName
          ) || instances[0];
          const ownerJid: string = (
            inst?.instance?.ownerJid ||
            inst?.ownerJid ||
            inst?.instance?.owner ||
            inst?.owner || ""
          ).replace(/@.*$/, "");
          if (ownerJid) phoneNumber = ownerJid;
        }
      } catch { /* ignore */ }

      // If connected but no phone, try getting QR anyway
      if (status !== "open" && status !== "not_created" && status !== "close") {
        try {
          const qrRes = await fetch(`${apiUrl}/instance/connect/${instanceName}`, {
            method: "GET",
            headers: evoHeaders,
            signal: AbortSignal.timeout(8000),
          });
          if (qrRes.ok) {
            const qrData = await qrRes.json();
            qrCode = qrData?.qrcode?.base64 || qrData?.base64 || null;
          }
        } catch { /* ignore */ }
      }

      return NextResponse.json({
        success: true,
        status,
        phone_number: phoneNumber,
        qr_code: qrCode,
        last_activity: lastActivity,
        last_event: lastEvent,
        instance: instanceName,
      });
    }

    // --- DISCONNECT ---
    if (action === "disconnect") {
      try {
        await fetch(`${apiUrl}/instance/logout/${instanceName}`, {
          method: "DELETE",
          headers: evoHeaders,
          signal: AbortSignal.timeout(10000),
        });
      } catch { /* ignore */ }
      try {
        await fetch(`${apiUrl}/instance/delete/${instanceName}`, {
          method: "DELETE",
          headers: evoHeaders,
          signal: AbortSignal.timeout(10000),
        });
      } catch { /* ignore */ }
      return NextResponse.json({ success: true, status: "close" });
    }

    // --- RESTART ---
    if (action === "restart") {
      let status = "unknown";
      try {
        const restRes = await fetch(`${apiUrl}/instance/restart/${instanceName}`, {
          method: "PUT",
          headers: evoHeaders,
          signal: AbortSignal.timeout(15000),
        });
        if (restRes.ok) {
          const restData = await restRes.json();
          status = (restData?.instance?.state || restData?.state || "restarting").toLowerCase();
        }
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, status });
    }

    // --- CONNECT (default) ---
    let res = await fetch(`${apiUrl}/instance/create`, {
      method: "POST",
      headers: evoHeaders,
      body: JSON.stringify({ instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
    });

    let data = await res.json();

    const alreadyExists = !res.ok && (
      data?.response?.message?.some?.((m: string) => m?.includes?.("already in use")) ||
      data?.message?.includes?.("already in use") ||
      data?.message?.includes?.("exist") ||
      data?.error === "Forbidden"
    );

    if (alreadyExists) {
      try {
        await fetch(`${apiUrl}/instance/delete/${instanceName}`, {
          method: "DELETE",
          headers: evoHeaders,
        });
      } catch { /* ignore */ }
      res = await fetch(`${apiUrl}/instance/create`, {
        method: "POST",
        headers: evoHeaders,
        body: JSON.stringify({ instanceName, qrcode: true, integration: "WHATSAPP-BAILEYS" }),
      });
      data = await res.json();
    }

    if (!res.ok) {
      const errMsg = data?.response?.message || data?.message || data?.error || "Errore sconosciuto Evolution API";
      const errText = Array.isArray(errMsg) ? errMsg.join(", ") : errMsg;
      return NextResponse.json({ error: errText }, { status: 400 });
    }

    const base64 = data?.qrcode?.base64 || data?.base64 || "";
    return NextResponse.json({ success: true, qrcode: base64, instance: instanceName });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
