"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Save, Building2, AlignLeft, UserCircle, Loader2, Phone, Share2, Camera, CheckCircle2, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function SettingsEditor({ organization }: { organization: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("fb_success") === "1") {
      const page = params.get("page");
      const ig = params.get("ig");
      toast.success(`Connesso a Facebook come "${page}"${ig ? " + Instagram" : ""}!`);
      window.history.replaceState({}, "", "/settings");
    }
    if (params.get("fb_needs_page") === "1") {
      setFbNeedsPage(true);
      window.history.replaceState({}, "", "/settings");
    }
    if (params.get("fb_error")) {
      const err = params.get("fb_error");
      const messages: Record<string, string> = {
        access_denied: "Hai annullato la connessione a Facebook",
        missing_params: "Errore durante la connessione (parametri mancanti)",
        config_missing: "Configurazione Facebook mancante. Contatta l'assistenza.",
        token_exchange_failed: "Errore nello scambio del token Facebook",
        no_page_found: "Nessuna Pagina Facebook trovata. Crea prima una Pagina.",
      };
      toast.error(messages[err || ""] || `Errore: ${err}`);
      window.history.replaceState({}, "", "/settings");
    }
  }, []);
  const [waStatus, setWaStatus] = useState<string>("not_created");
  const [waPhoneNumber, setWaPhoneNumber] = useState<string | null>(null);
  const [waQrCode, setWaQrCode] = useState<string | null>(null);
  const [waLoading, setWaLoading] = useState(false);
  const [waRestarting, setWaRestarting] = useState(false);
  const waIsConnected = waStatus === "open";
  const [uploading, setUploading] = useState(false);
  const [fbPageId, setFbPageId] = useState("");
  const [fbVerifying, setFbVerifying] = useState(false);
  const [fbNeedsPage, setFbNeedsPage] = useState(false);
  const [formData, setFormData] = useState({
    name: organization.name || "",
    description: organization.description || "",
    host_photo: organization.host_photo || "",
    cover_photos: organization.cover_photos || [],
    smtp_host: organization.smtp_host || "",
    smtp_port: organization.smtp_port || 465,
    smtp_user: organization.smtp_user || "",
    smtp_pass: organization.smtp_pass || "",
    smtp_from_email: organization.smtp_from_email || "",
    booking_email_template: organization.booking_email_template || "",
    template_booking_confirmed: organization.template_booking_confirmed || "",
    template_booking_cancelled: organization.template_booking_cancelled || "",
    allowed_payment_methods: organization.allowed_payment_methods || ["Contante", "Bonifico", "Bonifico Immediato", "Stripe"],
    number_format: organization.number_format || "it-IT",
    date_format: organization.date_format || "DD/MM/YYYY",
    currency: organization.currency || "EUR",
    page_about: organization.page_about || "",
    page_terms: organization.page_terms || "",
    page_contacts: organization.page_contacts || "",
    whatsapp_phone: organization.whatsapp_phone || "",
  });

  const handleSave = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('organizations')
      .update({
        name: formData.name,
        description: formData.description,
        host_photo: formData.host_photo,
        smtp_host: formData.smtp_host,
        smtp_port: formData.smtp_port,
        smtp_user: formData.smtp_user,
        smtp_pass: formData.smtp_pass,
        smtp_from_email: formData.smtp_from_email,
        booking_email_template: formData.booking_email_template,
        template_booking_confirmed: formData.template_booking_confirmed,
        template_booking_cancelled: formData.template_booking_cancelled,
        allowed_payment_methods: formData.allowed_payment_methods,
        number_format: formData.number_format,
        date_format: formData.date_format,
        currency: formData.currency,
        cover_photos: formData.cover_photos,
        page_about: formData.page_about,
        page_terms: formData.page_terms,
        page_contacts: formData.page_contacts,
        whatsapp_phone: formData.whatsapp_phone,
      })
      .eq('id', organization.id);
    
    if (error) {
      toast.error("Errore durante il salvataggio");
      console.error(error);
    } else {
      router.refresh();
      toast.success("Pagina host salvata!");
    }
    setLoading(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      const file = e.target.files[0];
      setUploading(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `host-${organization.slug}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('property_images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('property_images').getPublicUrl(fileName);
      setFormData({ ...formData, host_photo: data.publicUrl });
      toast.success("Foto caricata! Ricordati di salvare.");

    } catch (e) {
      toast.error("Errore caricamento foto");
    } finally {
      setUploading(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!e.target.files || e.target.files.length === 0) return;
      setUploading(true);
      const files = Array.from(e.target.files);
      const uploaded: string[] = [];

      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `cover-${organization.slug}-${Math.random()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('property_images')
          .upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from('property_images').getPublicUrl(fileName);
        uploaded.push(data.publicUrl);
      }

      setFormData({ ...formData, cover_photos: [...formData.cover_photos, ...uploaded] });
      toast.success("Foto caricate! Ricordati di salvare.");
    } catch (e) {
      toast.error("Errore caricamento foto");
    } finally {
      setUploading(false);
    }
  };

  const apiCall = async (body: any) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const res = await fetch("/api/whatsapp/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const fetchWaStatus = async (isSilent = false) => {
    if (!isSilent) setWaLoading(true);
    try {
      const json = await apiCall({ org_id: organization.id, action: "status" });
      if (json.success) {
        setWaStatus(json.status);
        if (json.phone_number) setWaPhoneNumber(json.phone_number);
        if (json.status !== "open" && json.qr_code) setWaQrCode(json.qr_code);
        if (json.status === "open") setWaQrCode(null);
      }
    } catch { /* ignore */ }
    if (!isSilent) setWaLoading(false);
  };

  useEffect(() => {
    fetchWaStatus(true);
  }, []);

  const handleConnectWhatsapp = async () => {
    setWaLoading(true);
    setWaQrCode(null);
    try {
      const json = await apiCall({ org_id: organization.id });
      if (json.qrcode) {
        setWaQrCode(json.qrcode);
        setWaStatus("connecting");
        toast.success("QR Code Generato! Inquadralo con WhatsApp.");
      } else {
        toast.error(json.error || "Impossibile generare QR");
      }
    } catch {
      toast.error("Errore di rete con Evolution API");
    }
    setWaLoading(false);
  };

  const handleRestartWhatsApp = async () => {
    setWaRestarting(true);
    try {
      const json = await apiCall({ org_id: organization.id, action: "restart" });
      if (json.success) {
        toast.success("Connessione WhatsApp riavviata!");
        setTimeout(() => fetchWaStatus(true), 2000);
      } else {
        toast.error(json.error || "Errore riavvio");
      }
    } catch {
      toast.error("Errore di rete");
    }
    setWaRestarting(false);
  };

  const handleDisconnectWhatsApp = async () => {
    if (!confirm("Disconnettere WhatsApp?")) return;
    setWaLoading(true);
    try {
      const json = await apiCall({ org_id: organization.id, action: "disconnect" });
      if (json.success) {
        setWaStatus("close");
        setWaPhoneNumber(null);
        setWaQrCode(null);
        toast.success("WhatsApp disconnesso!");
      }
    } catch {
      toast.error("Errore di rete");
    }
    setWaLoading(false);
  };

  // Poll status when connecting
  useEffect(() => {
    let interval: any = null;
    if (waStatus === "connecting") {
      interval = setInterval(async () => {
        try {
          const json = await apiCall({ org_id: organization.id, action: "status" });
          if (json.success) {
            setWaStatus(json.status);
            if (json.status === "open") {
              setWaQrCode(null);
              if (json.phone_number) setWaPhoneNumber(json.phone_number);
              clearInterval(interval);
              toast.success("WhatsApp connesso con successo!");
            } else if (json.qr_code) {
              setWaQrCode(json.qr_code);
            }
          }
        } catch { /* ignore */ }
      }, 3000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [waStatus]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 space-y-8">
        
        {/* Foto Profilo */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
            <UserCircle className="w-5 h-5 mr-2 text-blue-600"/>
            Foto Profilo (Avatar Host)
          </h3>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200 overflow-hidden shrink-0 shadow-inner">
              {formData.host_photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={formData.host_photo} alt="Host Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserCircle className="w-12 h-12 text-gray-400" />
              )}
            </div>
            <div>
              <label className="bg-white border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 cursor-pointer transition shadow-sm inline-flex items-center">
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : null}
                Carica nuova foto
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={uploading}/>
              </label>
              <p className="text-xs text-gray-500 mt-2">Questa foto apparirà sulla Vetrina e nelle singole stanze.</p>
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Cover Photos */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
            <Camera className="w-5 h-5 mr-2 text-blue-600"/>
            Foto Copertina (Carosello Vetrina)
          </h3>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Le foto appariranno come carosello nella pagina pubblica della tua vetrina.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {formData.cover_photos.map((url: string, i: number) => (
                <div key={i} className="relative aspect-[16/9] rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group">
                  <img src={url} alt={`Cover ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, cover_photos: formData.cover_photos.filter((_: string, j: number) => j !== i) })}
                    className="absolute top-1 right-1 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition shadow-lg hover:bg-red-600"
                  >
                    X
                  </button>
                </div>
              ))}
              <label className="aspect-[16/9] rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition">
                {uploading ? <Loader2 className="w-6 h-6 animate-spin text-blue-600"/> : (
                  <>
                    <Camera className="w-6 h-6 text-gray-400" />
                    <span className="text-xs text-gray-500 font-medium">Aggiungi</span>
                  </>
                )}
                <input type="file" className="hidden" accept="image/*" multiple onChange={handleCoverUpload} disabled={uploading} />
              </label>
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Dati Aziendali */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
            <Building2 className="w-5 h-5 mr-2 text-blue-600"/>
            Informazioni Base
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Pubblico (Azienda o Nome Host)</label>
              <input 
                type="text" 
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" 
                value={formData.name} 
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Bio */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
            <AlignLeft className="w-5 h-5 mr-2 text-blue-600"/>
            Descrizione Pubblica (Biografia)
          </h3>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">Racconta chi sei ai tuoi futuri ospiti. Spiega da quanto tempo fai questo lavoro e perché scegliere le tue strutture.</p>
              <textarea 
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32 outline-none" 
                placeholder="Es. Siamo una famiglia ospitale..."
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Impostazioni SMTP */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
            <span className="w-5 h-5 mr-2 text-blue-600 font-serif font-bold flex items-center justify-center">@</span>
            Configurazione Invio Email (SMTP)
          </h3>
          <div className="space-y-4 bg-gray-50 p-6 rounded-xl border border-gray-100">
            <p className="text-sm text-gray-600 mb-4">Configura i parametri del tuo server di posta in uscita per inviare conferme di prenotazione ai tuoi ospiti a nome della tua agenzia.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase font-bold text-gray-700 mb-1">Indirizzo Server (SMTP Host)</label>
                <input type="text" placeholder="es. smtps.aruba.it" className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500" value={formData.smtp_host} onChange={e => setFormData({...formData, smtp_host: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-gray-700 mb-1">Porta (es. 465 o 587)</label>
                <input type="number" className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500" value={formData.smtp_port} onChange={e => setFormData({...formData, smtp_port: Number(e.target.value)})} />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-gray-700 mb-1">Email Mittente (Es. prenotazioni@mia-struttura.it)</label>
                <input type="email" placeholder="Email mostrata al cliente" className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500" value={formData.smtp_from_email} onChange={e => setFormData({...formData, smtp_from_email: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-gray-700 mb-1">Username SMTP (Di solito l'email)</label>
                <input type="text" className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500" value={formData.smtp_user} onChange={e => setFormData({...formData, smtp_user: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs uppercase font-bold text-gray-700 mb-1">Password SMTP</label>
                <input type="password" placeholder="••••••••" className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500" value={formData.smtp_pass} onChange={e => setFormData({...formData, smtp_pass: e.target.value})} />
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200 mt-6 space-y-6">
              <div>
                <label className="block text-xs uppercase font-bold text-gray-700 mb-2">Modello Email: Ricezione / IN ATTESA (HTML consentito)</label>
                <p className="text-xs text-gray-500 mb-2">Usa i segnaposto: {'{{guest_name}}, {{check_in_date}}, {{check_out_date}}, {{total_price}}, {{org_name}}, {{check_in_link}}'}. Viene mandata quando l'utente fa la richiesta prima dell'accettazione.</p>
                <textarea 
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 font-mono h-32" 
                  value={formData.booking_email_template} 
                  onChange={e => setFormData({...formData, booking_email_template: e.target.value})} 
                />
              </div>

              <div className="pt-4 border-t border-gray-200">
                <label className="block text-xs uppercase font-bold text-gray-700 mb-2">Modello Email: CONFERMATA (HTML consentito)</label>
                <p className="text-xs text-gray-500 mb-2">Inviata quando un manager passa lo stato in Confermata.</p>
                <textarea 
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 font-mono h-32" 
                  value={formData.template_booking_confirmed} 
                  onChange={e => setFormData({...formData, template_booking_confirmed: e.target.value})} 
                />
              </div>

              <div className="pt-4 border-t border-gray-200">
                <label className="block text-xs uppercase font-bold text-gray-700 mb-2">Modello Email: ANNULLATA (HTML consentito)</label>
                <p className="text-xs text-gray-500 mb-2">Inviata quando un manager annulla la prenotazione.</p>
                <textarea 
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 font-mono h-32" 
                  value={formData.template_booking_cancelled} 
                  onChange={e => setFormData({...formData, template_booking_cancelled: e.target.value})} 
                />
              </div>
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Metodi di Pagamento */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
            <span className="w-5 h-5 mr-2 text-blue-600 font-serif font-bold flex items-center justify-center">€</span>
            Metodi di Pagamento Accettati
          </h3>
          <div className="space-y-3 bg-gray-50 p-6 rounded-xl border border-gray-100">
             <p className="text-sm text-gray-600 mb-4">Seleziona i metodi di pagamento che i clienti possono scegliere durante la prenotazione.</p>
             {["Contante", "Bonifico", "Bonifico Immediato", "Stripe"].map(method => (
                <label key={method} className="flex items-center gap-3 cursor-pointer">
                   <input 
                      type="checkbox" 
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      checked={formData.allowed_payment_methods?.includes(method)}
                      onChange={(e) => {
                         if (e.target.checked) {
                            setFormData({...formData, allowed_payment_methods: [...(formData.allowed_payment_methods || []), method]});
                         } else {
                            setFormData({...formData, allowed_payment_methods: (formData.allowed_payment_methods || []).filter((m: string) => m !== method)});
                         }
                      }}
                   />
                   <span className="text-sm font-medium text-gray-800">{method}</span>
                </label>
             ))}
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Formato Numeri e Date */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
            <span className="w-5 h-5 mr-2 text-gray-600 font-mono font-bold flex items-center justify-center">#</span>
            Formato Numeri e Date
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-6 rounded-xl border border-gray-100">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Formato Numeri</label>
              <select value={formData.number_format} onChange={e => setFormData({...formData, number_format: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="it-IT">Italiano (1.234,56)</option>
                <option value="en-US">English (1,234.56)</option>
                <option value="de-DE">Deutsch (1.234,56)</option>
                <option value="fr-FR">Français (1 234,56)</option>
                <option value="es-ES">Español (1.234,56)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Formato Date</label>
              <select value={formData.date_format} onChange={e => setFormData({...formData, date_format: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="DD/MM/YYYY">31/12/2026</option>
                <option value="MM/DD/YYYY">12/31/2026</option>
                <option value="YYYY-MM-DD">2026-12-31</option>
                <option value="DD.MM.YYYY">31.12.2026</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Valuta</label>
              <select value={formData.currency} onChange={e => setFormData({...formData, currency: e.target.value})} className="w-full border border-gray-300 p-2.5 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="EUR">€ Euro</option>
                <option value="USD">$ USD</option>
                <option value="GBP">£ GBP</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Impostazioni Facebook & Instagram */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
            <Share2 className="w-5 h-5 mr-2 text-blue-600"/> Social Marketing
          </h3>
          <div className="space-y-4 bg-blue-50 p-6 rounded-xl border border-blue-100">
            {organization.facebook_page_token ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-medium">Pagina Facebook connessa</span>
                </div>
                {organization.instagram_account_id && (
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="font-medium">Instagram Business connesso</span>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => {
                  fetch("/api/auth/facebook/config").then(r => r.json()).then(cfg => {
                    if (cfg.appId) {
                      window.location.href = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${cfg.appId}&redirect_uri=${encodeURIComponent(window.location.origin + "/api/auth/facebook/callback")}&state=${organization.id}|${organization.created_by || ""}&scope=pages_manage_posts,pages_show_list`;
                    } else toast.error("Facebook App ID non configurata");
                  });
                }} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition">Riconnetti</button>
                  <button onClick={async () => {
                    await supabase.from("organizations").update({ facebook_page_token: null, instagram_account_id: null }).eq("id", organization.id);
                    toast.success("Connessione rimossa"); router.refresh();
                  }} className="px-5 py-2.5 bg-red-50 text-red-700 rounded-xl font-bold text-sm hover:bg-red-100 transition">Disconnetti</button>
                </div>
              </div>
            ) : fbNeedsPage || organization.facebook_user_token ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span>Login Facebook effettuato! Inserisci l'ID della tua Pagina Facebook.</span>
                </div>
                <p className="text-xs text-blue-600">
                  Trovi l'ID aprendo la tua Pagina Facebook → pulsante <b>"..."</b> in alto a destra → <b>"Info Pagina"</b> → scorri in fondo → <b>"ID Pagina"</b> (è un numero, es. <code>123456789</code>).
                </p>
                <div className="flex gap-3">
                  <input type="text" value={fbPageId} onChange={e => setFbPageId(e.target.value)} className="flex-1 border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ID Pagina Facebook" />
                  <button
                    disabled={fbVerifying || !fbPageId}
                    onClick={async () => {
                      setFbVerifying(true);
                      const res = await fetch("/api/auth/facebook/verify-page", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ org_id: organization.id, page_id: fbPageId }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        toast.success(`Connesso a "${data.page_name}"${data.instagram ? " + Instagram" : ""}!`);
                        setFbNeedsPage(false);
                        router.refresh();
                      } else {
                        toast.error(data.error || "Errore verifica pagina");
                      }
                      setFbVerifying(false);
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition disabled:opacity-50 shrink-0"
                  >
                    {fbVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verifica e Connetti"}
                  </button>
                </div>
                <button onClick={() => { setFbNeedsPage(false); }} className="text-xs text-gray-500 hover:underline">Annulla</button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-blue-800 mb-4">Connetti la tua Pagina Facebook per pubblicare automaticamente i post delle campagne marketing su Facebook e Instagram.</p>
                <button
                  onClick={() => {
                    fetch("/api/auth/facebook/config").then(r => r.json()).then(cfg => {
                      if (cfg.appId) {
                        window.location.href = `https://www.facebook.com/v22.0/dialog/oauth?client_id=${cfg.appId}&redirect_uri=${encodeURIComponent(window.location.origin + "/api/auth/facebook/callback")}&state=${organization.id}|${organization.created_by || ""}&scope=pages_manage_posts,pages_show_list`;
                      } else {
                        toast.error("Facebook App ID non configurata. Contatta l'assistenza.");
                      }
                    });
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-sm hover:bg-blue-700 transition"
                >
                  <Share2 className="w-5 h-5" /> Connetti con Facebook
                </button>
              </div>
            )}
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Impostazioni WhatsApp Evolution */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
            <Phone className="w-5 h-5 mr-2 text-emerald-600"/>
            Integrazione WhatsApp (Evolution API)
          </h3>
          <div className="space-y-4 bg-emerald-50 p-6 rounded-xl border border-emerald-100">
            <p className="text-sm text-emerald-800">Collega il numero di telefono della struttura per inviare e ricevere messaggi WhatsApp.</p>

            {/* Stato Connessione */}
            <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${waIsConnected && waPhoneNumber ? "bg-green-100 border-green-300" : waStatus === "connecting" ? "bg-amber-100 border-amber-300" : "bg-gray-100 border-gray-200"}`}>
              <Phone className={`w-6 h-6 ${waIsConnected && waPhoneNumber ? "text-green-600" : "text-gray-500"}`} />
              <div className="flex-1">
                {waIsConnected && waPhoneNumber ? (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    <span className="font-bold text-green-800">
                      Connesso: <span className="font-mono">+{waPhoneNumber.replace(/@.*$/, "")}</span>
                    </span>
                  </div>
                ) : waStatus === "connecting" ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                    <span className="font-medium text-amber-800">In attesa di scansione QR...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
                    <span className="font-medium text-gray-600">Non connesso</span>
                  </div>
                )}
              </div>
              <button onClick={() => fetchWaStatus()} disabled={waLoading} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-white rounded-lg transition" title="Aggiorna stato">
                <Loader2 className={`w-4 h-4 ${waLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* QR Code */}
            {waQrCode && (
              <div className="bg-white p-6 rounded-xl border border-emerald-200 text-center shadow-lg">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-4">Inquadra dal Tuo Smartphone</p>
                <p className="text-xs text-gray-500 mb-3">Apri WhatsApp → Dispositivi collegati → Collega un dispositivo</p>
                <img src={waQrCode} alt="WhatsApp QR Code" className="w-56 h-56 object-contain mx-auto" />
                <p className="text-xs text-gray-400 mt-3">Il codice QR si aggiorna automaticamente. La connessione verrà rilevata in tempo reale.</p>
              </div>
            )}

            {/* Bottoni Azione */}
            <div className="flex flex-wrap gap-2">
              <button onClick={handleConnectWhatsapp} disabled={waLoading}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition disabled:opacity-50">
                {waLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                {waQrCode ? "Rigenera QR" : "Connetti via QR"}
              </button>

              {waStatus !== "not_created" && waStatus !== "close" && (
                <button onClick={handleRestartWhatsApp} disabled={waRestarting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-lg font-bold text-sm hover:bg-orange-600 transition disabled:opacity-50">
                  {waRestarting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Riavvia Connessione
                </button>
              )}

              {waIsConnected && (
                <button onClick={handleDisconnectWhatsApp} disabled={waLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white rounded-lg font-bold text-sm hover:bg-red-600 transition disabled:opacity-50">
                  Disconnetti
                </button>
              )}
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        {/* Pagine Vetrina */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
            <AlignLeft className="w-5 h-5 mr-2 text-purple-600"/>
            Pagine Vetrina Pubbliche
          </h3>
          <div className="space-y-4 bg-purple-50 p-6 rounded-xl border border-purple-100">
            <p className="text-sm text-purple-700 mb-4">Scrivi il contenuto delle pagine informative accessibili dal footer della vetrina pubblica.</p>

            <div>
              <label className="block text-xs uppercase font-bold text-gray-700 mb-2">Chi Siamo</label>
              <textarea className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 h-28 outline-none" placeholder="Scrivi la storia della tua attività..." value={formData.page_about} onChange={e => setFormData({...formData, page_about: e.target.value})} />
            </div>

            <div>
              <label className="block text-xs uppercase font-bold text-gray-700 mb-2">Termini e Condizioni</label>
              <textarea className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 h-28 outline-none" placeholder="Scrivi i termini e condizioni..." value={formData.page_terms} onChange={e => setFormData({...formData, page_terms: e.target.value})} />
            </div>

            <div>
              <label className="block text-xs uppercase font-bold text-gray-700 mb-2">Contatti (testo libero, es. orari, indirizzo)</label>
              <textarea className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 h-28 outline-none" placeholder="Scrivi le informazioni di contatto..." value={formData.page_contacts} onChange={e => setFormData({...formData, page_contacts: e.target.value})} />
            </div>

            <div>
              <label className="block text-xs uppercase font-bold text-gray-700 mb-2">Numero WhatsApp (per link diretto nel footer)</label>
              <input type="text" placeholder="es. 393331234567" className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={formData.whatsapp_phone} onChange={e => setFormData({...formData, whatsapp_phone: e.target.value})} />
              <p className="text-xs text-gray-500 mt-1">Inserisci il numero senza + e senza spazi. Apparirà l'icona WhatsApp nel footer della vetrina.</p>
            </div>
          </div>
        </div>

      </div>
      
      {/* Footer */}
      <div className="bg-gray-50 border-t border-gray-200 p-6 flex justify-end">
        <button 
          onClick={handleSave} 
          disabled={loading || uploading}
          className="flex items-center bg-blue-600 text-white px-6 py-3 rounded-lg shadow-md hover:bg-blue-700 hover:shadow-lg transition disabled:opacity-50 font-bold"
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Save className="w-4 h-4 mr-2" />}
          {loading ? "Salvataggio..." : "Salva Impostazioni"}
        </button>
      </div>
    </div>
  );
}
