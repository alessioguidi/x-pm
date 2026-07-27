"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase/client";
import { Megaphone, Plus, Loader2, Calendar, Clock, Repeat, Image as ImageIcon, Play, Pause, X, Upload, ExternalLink, Share2, Building2, Send, Trash2, MessageCircle, Users, Copy, CheckSquare } from "lucide-react";
import toast from "react-hot-toast";
import { formatDateStr, formatDateRange, formatDateTime } from "@/lib/format";

const DAYS = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [propPhotos, setPropPhotos] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullscreenEditor, setFullscreenEditor] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<any[]>([]);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendCampaign, setSendCampaign] = useState<any>(null);
  const [selectedSendIds, setSelectedSendIds] = useState<string[]>([]);
  const [sendingWa, setSendingWa] = useState(false);

  const EMOJIS = ["☀️","🌤️","⛱️","🌊","🏖️","🌴","🌅","🌺","🌸","🌿","🍀","🌻","🏠","🛏️","🛋️","🍽️","🍷","☕","🧘","🏊","🚴","🛵","🚗","✈️","🧳","🐕","🐈","👨‍👩‍👧‍👦","❤️","🔥","✨","🎉","💰","📅","📍","🔑","🅿️","📶","📺","❄️","🔥"];

  const [form, setForm] = useState({
    name: "",
    property_id: "",
    description: "",
    recurrence: "weekly",
    day_of_week: 5,
    day_of_month: 1,
    time_of_day: "21:00",
    start_date: "",
    end_date: "",
    text_content: "",
    media_urls: [] as string[],
    auto_availability: false,
    platform: "both",
    channel: "social",
  });

  useEffect(() => {
    checkAdmin();
    fetchCampaigns();
    supabase.from("properties").select("id, name").order("name").then(({ data }) => { if (data) setProperties(data); });
    supabase.from("contacts").select("id, first_name, last_name, phone, email").order("first_name").then(({ data }) => { if (data) setContacts(data); });
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setIsAdmin(!!user);
  };

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data } = await supabase.from("campaigns").select("*, campaign_recipients(*)").order("created_at", { ascending: false });
    if (data) setCampaigns(data);
    setLoading(false);
  };

  useEffect(() => {
    if (showModal && form.property_id) {
      supabase.from("properties").select("property_photos(image_url)").eq("id", form.property_id).single().then(({ data }) => {
        if (data) setPropPhotos((data.property_photos || []).map((p: any) => p.image_url));
        else setPropPhotos([]);
      });
    } else if (showModal) {
      setPropPhotos([]);
    }
  }, [form.property_id, showModal]);

  const openCreate = () => {
    setEditing(null);
    setSelectedContacts([]);
    setForm({
      name: "",
      property_id: "",
      description: "",
      auto_availability: false,
      platform: "both",
      recurrence: "weekly",
      day_of_week: 5,
      day_of_month: 1,
      time_of_day: "21:00",
      start_date: "",
      end_date: "",
      text_content: "",
      media_urls: [],
      channel: "social",
    });
    setShowModal(true);
  };

  const openEdit = (c: any) => {
    setEditing(c);
    const existingRecipients = c.campaign_recipients || [];
    setSelectedContacts(existingRecipients.map((r: any) => ({
      id: r.contact_id || r.id,
      first_name: r.name,
      phone: r.phone,
      email: r.email,
      _recipient: r,
    })));
    setForm({
      name: c.name,
      property_id: c.property_id || "",
      description: c.description || "",
      auto_availability: c.auto_availability || false,
      platform: c.platform || "both",
      recurrence: c.recurrence,
      day_of_week: c.day_of_week ?? 5,
      day_of_month: c.day_of_month ?? 1,
      time_of_day: c.time_of_day?.slice(0, 5) || "21:00",
      start_date: c.start_date,
      end_date: c.end_date,
      text_content: c.text_content || "",
      media_urls: c.media_urls || [],
      channel: c.channel || "social",
    });
    setShowModal(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(e.target.files)) {
      const ext = file.name.split(".").pop();
      const path = `campaigns/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("property_images").upload(path, file);
      if (error) { toast.error(`Upload fallito: ${file.name}`); continue; }
      const { data: { publicUrl } } = supabase.storage.from("property_images").getPublicUrl(path);
      urls.push(publicUrl);
    }
    if (urls.length > 0) setForm({ ...form, media_urls: [...form.media_urls, ...urls] });
    setUploading(false);
  };

  const removeMedia = (idx: number) => {
    setForm({ ...form, media_urls: form.media_urls.filter((_, i) => i !== idx) });
  };

  const openSendDialog = (c: any) => {
    setSendCampaign(c);
    const pendingIds = (c.campaign_recipients || [])
      .filter((r: any) => r.status === "pending")
      .map((r: any) => r.id);
    setSelectedSendIds(pendingIds);
    setShowSendDialog(true);
  };

  const handleSendWhatsApp = async (ids: string[]) => {
    if (!sendCampaign || ids.length === 0) return;
    setSendingWa(true);
    toast.loading(`Invio WhatsApp a ${ids.length} destinatari...`, { id: "wa" });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { toast.error("Sessione scaduta", { id: "wa" }); setSendingWa(false); return; }
      const res = await fetch("/api/marketing/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ campaign_id: sendCampaign.id, recipient_ids: ids }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error, { id: "wa" }); }
      else { toast.success(`Invio completato! ${data.sent || 0} inviati, ${data.failed || 0} falliti`, { id: "wa" }); setShowSendDialog(false); fetchCampaigns(); }
    } catch (e: any) {
      toast.error(e?.message || "Errore di rete durante l'invio", { id: "wa" });
    }
    setSendingWa(false);
  };

  const handlePublishNow = async (c: any) => {
    toast.loading("Pubblicazione in corso...", { id: "pub" });
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) { toast.error("Sessione scaduta", { id: "pub" }); return; }
    const res = await fetch("/api/marketing/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ campaign_id: c.id }),
    });
    const data = await res.json();
    if (data.success) { toast.success("Post pubblicato!", { id: "pub" }); fetchCampaigns(); }
    else { toast.error(data.error || "Errore pubblicazione", { id: "pub" }); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminare questa campagna?")) return;
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (error) toast.error("Errore eliminazione");
    else { toast.success("Campagna eliminata"); fetchCampaigns(); }
  };

  const handleDuplicate = async (c: any) => {
    toast.loading("Duplicazione in corso...", { id: "dup" });
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle() : { data: null };
    const { error } = await supabase.from("campaigns").insert({
      organization_id: profile?.organization_id,
      name: `${c.name} (copia)`,
      property_id: c.property_id,
      description: c.description,
      text_content: c.text_content,
      channel: c.channel,
      media_urls: c.media_urls || [],
      start_date: c.start_date,
      end_date: c.end_date,
    }).select("id");
    if (error) { toast.error("Errore duplicazione", { id: "dup" }); return; }
    toast.success("Campagna duplicata!", { id: "dup" });
    fetchCampaigns();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.property_id) { toast.error("Compila tutti i campi obbligatori: nome, immobile"); return; }
    if (form.channel === "social" && (!form.start_date || !form.end_date)) { toast.error("Compila le date di inizio e fine"); return; }
    if (form.channel === "whatsapp" && selectedContacts.length === 0) { toast.error("Seleziona almeno un contatto"); return; }

    setSaving(true);
    const today = new Date().toISOString().split("T")[0];
    const payload: any = {
      name: form.name,
      property_id: form.property_id,
      description: form.text_content,
      channel: form.channel,
      text_content: form.text_content,
      start_date: today,
      end_date: today,
    };

    if (form.channel === "social") {
      payload.auto_availability = form.auto_availability;
      payload.platform = form.platform;
      payload.recurrence = form.recurrence;
      payload.day_of_week = form.recurrence === "weekly" ? form.day_of_week : null;
      payload.day_of_month = form.recurrence === "monthly" ? form.day_of_month : null;
      payload.time_of_day = form.time_of_day;
      payload.start_date = form.start_date;
      payload.end_date = form.end_date;
      payload.media_urls = form.media_urls;
    } else if (form.channel === "whatsapp") {
      payload.media_urls = form.media_urls;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from("profiles").select("organization_id").eq("id", user.id).maybeSingle() : { data: null };

    if (editing) {
      const { error } = await supabase.from("campaigns").update(payload).eq("id", editing.id);
      if (error) { toast.error("Errore salvataggio"); setSaving(false); return; }
      if (form.channel === "whatsapp") {
        await supabase.from("campaign_recipients").delete().eq("campaign_id", editing.id);
        const recipients = selectedContacts.map(c => ({
          campaign_id: editing.id,
          contact_id: c.id || null,
          name: c.first_name || c.name || "",
          phone: c.phone || "",
          email: c.email || "",
        }));
        const { error: recErr } = await supabase.from("campaign_recipients").insert(recipients);
        if (recErr) console.error("Errore aggiornamento destinatari:", recErr);
      }
      toast.success("Campagna aggiornata!");
    } else {
      let newCampaignId: string | null = null;
      try {
        const { data: inserted, error } = await supabase.from("campaigns").insert({
          organization_id: profile?.organization_id,
          ...payload,
        }).select("id");
        if (error) { console.error("Errore creazione campagna:", error); toast.error("Errore creazione: " + (error.message || "errore sconosciuto")); setSaving(false); return; }
        newCampaignId = inserted?.[0]?.id || null;
      } catch (e: any) {
        console.error("Eccezione creazione campagna:", e); toast.error("Errore durante la creazione"); setSaving(false); return;
      }
      if (form.channel === "whatsapp" && newCampaignId) {
        const recipients = selectedContacts.map(c => ({
          campaign_id: newCampaignId,
          contact_id: c.id || null,
          name: c.first_name || c.name || "",
          phone: c.phone || "",
          email: c.email || "",
        }));
        const { error: recErr } = await supabase.from("campaign_recipients").insert(recipients);
        if (recErr) console.error("Errore inserimento destinatari:", recErr);
      }
      toast.success("Campagna creata!");
    }
    setShowModal(false);
    fetchCampaigns();
    setSaving(false);
  };

  const toggleActive = async (c: any) => {
    const { error } = await supabase.from("campaigns").update({ is_active: !c.is_active }).eq("id", c.id);
    if (!error) { toast.success(c.is_active ? "Campagna sospesa" : "Campagna attivata"); fetchCampaigns(); }
  };

  const nextScheduledDate = (c: any): string => {
    if (!c.is_active || !c.start_date || !c.end_date) return "";
    const start = new Date(c.start_date);
    const end = new Date(c.end_date);
    const now = new Date();
    const timeParts = (c.time_of_day || "21:00").split(":");
    const ref = now > start ? now : start;

    if (c.recurrence === "weekly" && c.day_of_week != null) {
      const d = new Date(ref);
      d.setHours(Number(timeParts[0]), Number(timeParts[1]), 0, 0);
      while (d.getDay() !== c.day_of_week) d.setDate(d.getDate() + 1);
      if (d <= now) d.setDate(d.getDate() + 7);
      if (d > end) return "";
      return d.toISOString();
    }
    if (c.recurrence === "daily") {
      const d = new Date(ref);
      d.setHours(Number(timeParts[0]), Number(timeParts[1]), 0, 0);
      if (d <= now) d.setDate(d.getDate() + 1);
      if (d > end) return "";
      return d.toISOString();
    }
    return "";
  };

  const nextPost = (c: any) => {
    const d = nextScheduledDate(c);
    return d ? formatDateTime(d) : "—";
  };

  const filteredContacts = contacts.filter(c =>
    !selectedContacts.find(sc => sc.id === c.id) &&
    (c.first_name || "").toLowerCase().includes(contactSearch.toLowerCase()) ||
    (c.last_name || "").toLowerCase().includes(contactSearch.toLowerCase()) ||
    (c.phone || "").includes(contactSearch)
  );

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center">
        <Megaphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Accesso Riservato</h1>
        <p className="text-gray-500">Solo gli amministratori possono gestire le campagne marketing.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-rose-600" /> Campagne Marketing
          </h1>
          <p className="text-gray-500 mt-1">Crea campagne social o WhatsApp.</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-5 py-3 bg-rose-600 text-white rounded-xl font-bold shadow-sm hover:bg-rose-700 transition">
          <Plus className="w-5 h-5" /> Nuova Campagna
        </button>
      </div>

      {loading ? (
        <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-rose-600" /></div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
          <Megaphone className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Nessuna campagna</h2>
          <p className="text-gray-500">Crea la tua prima campagna marketing.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {campaigns.map(c => {
            const isWhatsApp = c.channel === "whatsapp";
            const lastPost = c.campaign_posts?.filter((p: any) => p.status === "published").sort((a: any, b: any) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())[0];
            const recipients = c.campaign_recipients || [];
            const sentCount = recipients.filter((r: any) => r.status === "sent").length;
            const failedCount = recipients.filter((r: any) => r.status === "failed").length;
            const totalCount = recipients.length;
            const clickedCount = recipients.filter((r: any) => r.clicked_at).length;
            const openedCount = recipients.filter((r: any) => r.opened_at).length;
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-sm transition">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900 truncate">{c.name}</h3>
                      {!isWhatsApp && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${c.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {c.is_active ? "Attiva" : "Sospesa"}
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isWhatsApp ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                        {isWhatsApp ? "WhatsApp" : "Social"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                          {isWhatsApp ? (
                          <>
                            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {totalCount} destinatari</span>
                            {sentCount > 0 && <span className="text-emerald-600">{sentCount} inviati</span>}
                            {failedCount > 0 && <span className="text-red-600">{failedCount} falliti</span>}
                            {clickedCount > 0 && <span className="text-purple-600">{clickedCount} cliccati</span>}
                            {sentCount > 0 && <span className="text-gray-400">CTR: {((clickedCount / sentCount) * 100 || 0).toFixed(1)}%</span>}
                          </>
                        ) : (
                        <>
                          <span className="flex items-center gap-1"><Repeat className="w-3.5 h-3.5" /> {c.recurrence === "weekly" ? `Ogni ${DAYS[c.day_of_week]}` : c.recurrence === "daily" ? "Ogni giorno" : `Giorno ${c.day_of_month}`}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {c.time_of_day?.slice(0, 5)}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {formatDateStr(c.start_date)} → {formatDateStr(c.end_date)}</span>
                        </>
                      )}
                      {(() => { const p = properties.find(x => x.id === c.property_id); return p ? <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {p.name}</span> : null; })()}
                    </div>
                    <div className="mt-2 text-xs text-gray-400 italic line-clamp-3 break-words">{c.description || "Nessun testo"}</div>
                    {!isWhatsApp && c.is_active && (
                      <div className="mt-2 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> Prossimo post: {nextPost(c)}
                      </div>
                    )}
                    {!isWhatsApp && lastPost && (
                      <div className="mt-1 text-[11px] text-gray-400">Ultimo post: {formatDateTime(lastPost.published_at)}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-start">
                    {isWhatsApp ? (
                      <button onClick={() => openSendDialog(c)} className="px-4 py-2.5 text-sm font-bold bg-green-600 text-white hover:bg-green-700 rounded-lg transition whitespace-nowrap">
                        <Send className="w-4 h-4 mr-1.5 inline" /> Invia WhatsApp
                      </button>
                    ) : (
                      <button onClick={() => handlePublishNow(c)} className="px-4 py-2.5 text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 rounded-lg transition whitespace-nowrap">
                        <Share2 className="w-4 h-4 mr-1.5 inline" /> Pubblica Ora
                      </button>
                    )}
                    <button onClick={() => openEdit(c)} className="px-4 py-2.5 text-sm font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition whitespace-nowrap">Modifica</button>
                    {!isWhatsApp && (
                      <button onClick={() => toggleActive(c)} className={`p-2.5 rounded-lg transition ${c.is_active ? "text-amber-600 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`} title={c.is_active ? "Sospendi" : "Attiva"}>
                        {c.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                    )}
                    <button onClick={() => { if (confirm("Duplicare questa campagna?")) handleDuplicate(c); }} className="p-2.5 text-blue-500 hover:bg-blue-50 rounded-lg transition" title="Duplica">
                      <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Elimina">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden border border-gray-100 max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <h3 className="text-xl font-bold tracking-tight text-gray-900">
                {editing ? "Modifica Campagna" : "Nuova Campagna"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nome Campagna *</label>
                <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" placeholder="Es. Promo Weekend Giugno" />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Immobile *</label>
                <select value={form.property_id} onChange={e => setForm({ ...form, property_id: e.target.value })} required className="w-full border border-gray-300 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-rose-500 outline-none">
                  <option value="">-- Seleziona un immobile --</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Canale</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setForm({ ...form, channel: "social" })}
                    className={`p-3 rounded-xl border-2 font-bold text-sm transition ${form.channel === "social" ? "border-rose-500 bg-rose-50 text-rose-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                    <Share2 className="w-4 h-4 mr-2 inline" /> Social
                  </button>
                  <button type="button" onClick={() => setForm({ ...form, channel: "whatsapp" })}
                    className={`p-3 rounded-xl border-2 font-bold text-sm transition ${form.channel === "whatsapp" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                    <MessageCircle className="w-4 h-4 mr-2 inline" /> WhatsApp
                  </button>
                </div>
              </div>

              {form.channel === "social" && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Pubblica su</label>
                    <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })} className="w-full border border-gray-300 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-rose-500 outline-none">
                      <option value="both">Facebook + Instagram</option>
                      <option value="facebook">Solo Facebook</option>
                      <option value="instagram">Solo Instagram</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Ricorrenza</label>
                      <select value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })} className="w-full border border-gray-300 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-rose-500 outline-none">
                        <option value="weekly">Settimanale</option>
                        <option value="daily">Giornaliera</option>
                        <option value="monthly">Mensile</option>
                      </select>
                    </div>
                    {form.recurrence === "weekly" && (
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Giorno</label>
                        <select value={form.day_of_week} onChange={e => setForm({ ...form, day_of_week: Number(e.target.value) })} className="w-full border border-gray-300 p-2.5 rounded-xl bg-white focus:ring-2 focus:ring-rose-500 outline-none">
                          {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                        </select>
                      </div>
                    )}
                    {form.recurrence === "monthly" && (
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Giorno del mese</label>
                        <input type="number" min={1} max={31} value={form.day_of_month} onChange={e => setForm({ ...form, day_of_month: Number(e.target.value) })} className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Orario</label>
                      <input type="time" value={form.time_of_day} onChange={e => setForm({ ...form, time_of_day: e.target.value })} className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Data Inizio *</label>
                      <input type="date" required value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1">Data Fine *</label>
                      <input type="date" required value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-bold text-gray-700">Testo del Post</label>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="text-sm px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition" title="Inserisci emoji">😊</button>
                        <button type="button" onClick={() => setFullscreenEditor(!fullscreenEditor)} className="text-sm px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition" title="Schermo intero">{fullscreenEditor ? "✕" : "⛶"}</button>
                      </div>
                    </div>
                    {showEmojiPicker && (
                      <div className="flex flex-wrap gap-1 mb-2 p-2 bg-gray-50 rounded-xl border border-gray-200 max-h-32 overflow-y-auto">
                        {EMOJIS.map((emoji, i) => (
                          <button key={i} type="button" onClick={(e) => {
                            const ta = (e.currentTarget.closest('form')?.querySelector('textarea') as HTMLTextAreaElement);
                            const start = ta?.selectionStart ?? form.text_content.length;
                            const end = ta?.selectionEnd ?? start;
                            const before = form.text_content.slice(0, start);
                            const after = form.text_content.slice(end);
                            setForm({ ...form, text_content: before + emoji + after });
                            setShowEmojiPicker(false);
                            setTimeout(() => { ta?.focus(); ta?.setSelectionRange(start + emoji.length, start + emoji.length); }, 0);
                          }} className="text-xl hover:bg-gray-200 p-1 rounded transition">{emoji}</button>
                        ))}
                      </div>
                    )}
                    <textarea rows={fullscreenEditor ? 20 : 4} value={form.text_content} onChange={e => setForm({ ...form, text_content: e.target.value })}
                      className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none resize-none font-mono text-sm"
                      placeholder="Scrivi il testo del post... (verrà pubblicato su Facebook e Instagram)" />
                  </div>

                  {form.property_id && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.auto_availability || false} onChange={e => {
                        setForm({ ...form, auto_availability: e.target.checked });
                      }} className="w-4 h-4 text-rose-600 border-gray-300 rounded focus:ring-rose-500" />
                      <span className="text-sm text-gray-700">Aggiungi automaticamente i periodi di disponibilità della struttura</span>
                    </label>
                  )}
                  {form.auto_availability && form.property_id && <AvailabilityPreview propertyId={form.property_id} campaignStart={form.start_date} campaignEnd={form.end_date} />}

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Gallery Foto <span className="text-gray-400 font-normal">(trascina per riordinare)</span></label>
                    <div className="flex flex-wrap gap-3 mb-3">
                      {form.media_urls.map((url, i) => (
                        <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 group">
                          <img src={url} alt="" className="w-full h-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 p-1 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition">
                            {i > 0 && <button type="button" onClick={() => { const arr = [...form.media_urls]; [arr[i-1], arr[i]] = [arr[i], arr[i-1]]; setForm({...form, media_urls: arr}); }} className="p-0.5 bg-white/80 rounded text-xs font-bold hover:bg-white">←</button>}
                            {i < form.media_urls.length - 1 && <button type="button" onClick={() => { const arr = [...form.media_urls]; [arr[i], arr[i+1]] = [arr[i+1], arr[i]]; setForm({...form, media_urls: arr}); }} className="p-0.5 bg-white/80 rounded text-xs font-bold hover:bg-white">→</button>}
                          </div>
                          <button type="button" onClick={() => removeMedia(i)} className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <label className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-rose-400 hover:bg-rose-50 transition">
                        {uploading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : <Upload className="w-5 h-5 text-gray-400" />}
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
                      </label>
                    </div>
                    {propPhotos.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-2">Foto dell'immobile selezionato — clicca per aggiungere:</p>
                        <div className="flex flex-wrap gap-2">
                          {propPhotos.map((url, i) => (
                            <button key={i} type="button" onClick={() => { if (!form.media_urls.includes(url)) setForm({...form, media_urls: [...form.media_urls, url]}); }}
                              className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition ${form.media_urls.includes(url) ? "border-rose-500 opacity-50" : "border-gray-200 hover:border-rose-400"}`}>
                              <img src={url} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {form.channel === "whatsapp" && (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-bold text-gray-700">Testo del Messaggio</label>
                      <div className="flex gap-1">
                        <p className="text-[11px] text-gray-400 mr-2 self-center">Usa {'{{NOME}}'} per il nome del contatto</p>
                        <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="text-sm px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition" title="Inserisci emoji">😊</button>
                        <button type="button" onClick={() => setFullscreenEditor(!fullscreenEditor)} className="text-sm px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition" title="Schermo intero">{fullscreenEditor ? "✕" : "⛶"}</button>
                      </div>
                    </div>
                    {showEmojiPicker && (
                      <div className="flex flex-wrap gap-1 mb-2 p-2 bg-gray-50 rounded-xl border border-gray-200 max-h-32 overflow-y-auto">
                        {EMOJIS.map((emoji, i) => (
                          <button key={i} type="button" onClick={(e) => {
                            const ta = (e.currentTarget.closest('form')?.querySelector('textarea') as HTMLTextAreaElement);
                            const start = ta?.selectionStart ?? form.text_content.length;
                            const end = ta?.selectionEnd ?? start;
                            const before = form.text_content.slice(0, start);
                            const after = form.text_content.slice(end);
                            setForm({ ...form, text_content: before + emoji + after });
                            setShowEmojiPicker(false);
                            setTimeout(() => { ta?.focus(); ta?.setSelectionRange(start + emoji.length, start + emoji.length); }, 0);
                          }} className="text-xl hover:bg-gray-200 p-1 rounded transition">{emoji}</button>
                        ))}
                      </div>
                    )}
                    <textarea rows={fullscreenEditor ? 20 : 6} value={form.text_content} onChange={e => setForm({ ...form, text_content: e.target.value })}
                      className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-green-500 outline-none resize-none font-mono text-sm"
                      placeholder="Scrivi il messaggio WhatsApp... esempio: Ciao {{NOME}}, abbiamo una promozione speciale per te!" />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Gallery Media <span className="text-gray-400 font-normal">(foto/video allegati al messaggio)</span></label>
                    <div className="flex flex-wrap gap-3 mb-3">
                      {form.media_urls.map((url, i) => (
                        <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 group">
                          {url.match(/\.(mp4|webm|ogg)$/i) ? (
                            <video src={url} className="w-full h-full object-cover" />
                          ) : (
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          )}
                          <button type="button" onClick={() => setForm({ ...form, media_urls: form.media_urls.filter((_, j) => j !== i) })} className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <label className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition">
                        {uploading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : <Upload className="w-5 h-5 text-gray-400" />}
                        <input type="file" accept="image/*,video/mp4,video/webm,video/ogg" multiple className="hidden" onChange={handleUpload} disabled={uploading} />
                      </label>
                    </div>
                    {form.property_id && propPhotos.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-2">Foto dell'immobile selezionato — clicca per aggiungere:</p>
                        <div className="flex flex-wrap gap-2">
                          {propPhotos.map((url, i) => (
                            <button key={i} type="button" onClick={() => { if (!form.media_urls.includes(url)) setForm({...form, media_urls: [...form.media_urls, url]}); }}
                              className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition ${form.media_urls.includes(url) ? "border-green-500 opacity-50" : "border-gray-200 hover:border-green-400"}`}>
                              <img src={url} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-bold text-gray-700">Destinatari ({selectedContacts.length})</label>
                    </div>

                    {selectedContacts.length > 0 && (
                      <div className="mb-3 space-y-1 max-h-40 overflow-y-auto">
                        {selectedContacts.map((c, i) => (
                          <div key={c.id || i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-1.5 text-sm">
                            <span className="font-medium text-gray-700">{c.first_name || c.name} {c.last_name || ""}</span>
                            <span className="text-gray-500">{c.phone}</span>
                            <button type="button" onClick={() => setSelectedContacts(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 p-1">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="relative">
                      <input type="text" value={contactSearch} onChange={e => setContactSearch(e.target.value)}
                        className="w-full border border-gray-300 p-2.5 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-sm"
                        placeholder="Cerca contatti per nome o telefono..." />
                    </div>
                    {contactSearch && filteredContacts.length > 0 && (
                      <div className="mt-1 border border-gray-200 rounded-xl bg-white shadow-sm max-h-40 overflow-y-auto">
                        {filteredContacts.slice(0, 20).map(c => (
                          <button key={c.id} type="button" onClick={() => {
                            setSelectedContacts(prev => [...prev, c]);
                            setContactSearch("");
                          }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between">
                            <span className="font-medium text-gray-700">{c.first_name} {c.last_name || ""}</span>
                            <span className="text-gray-500">{c.phone || c.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-3 text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition">Annulla</button>
                <button type="submit" disabled={saving} className={`px-5 py-3 rounded-xl font-bold shadow-sm flex items-center transition disabled:opacity-50 ${form.channel === "whatsapp" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"}`}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : form.channel === "whatsapp" ? <MessageCircle className="w-4 h-4 mr-2" /> : <Megaphone className="w-4 h-4 mr-2" />}
                  {editing ? "Salva Modifiche" : form.channel === "whatsapp" ? "Crea Campagna WhatsApp" : "Crea Campagna"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSendDialog && sendCampaign && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100 max-h-[90vh] flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <h3 className="text-xl font-bold tracking-tight text-gray-900">
                Invia WhatsApp — {sendCampaign.name}
              </h3>
              <button onClick={() => { if (!sendingWa) setShowSendDialog(false); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3 overflow-y-auto flex-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-bold text-gray-700">Destinatari ({selectedSendIds.length} selezionati)</label>
                <button type="button" onClick={() => {
                  const allPending = (sendCampaign.campaign_recipients || []).filter((r: any) => r.status === "pending");
                  if (selectedSendIds.length === allPending.length) {
                    setSelectedSendIds([]);
                  } else {
                    setSelectedSendIds(allPending.map((r: any) => r.id));
                  }
                }} className="text-xs font-bold text-green-700 hover:text-green-800 flex items-center gap-1">
                  <CheckSquare className="w-3.5 h-3.5" /> {selectedSendIds.length === (sendCampaign.campaign_recipients || []).filter((r: any) => r.status === "pending").length ? "Deseleziona tutti" : "Seleziona tutti"}
                </button>
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto border border-gray-200 rounded-xl p-2">
                {(sendCampaign.campaign_recipients || []).map((r: any) => {
                  const isPending = r.status === "pending";
                  return (
                    <label key={r.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm cursor-pointer transition ${isPending ? "hover:bg-gray-50" : "opacity-50"}`}>
                      <input type="checkbox" checked={selectedSendIds.includes(r.id)} disabled={!isPending} onChange={() => {
                        if (!isPending) return;
                        setSelectedSendIds(prev => prev.includes(r.id) ? prev.filter(id => id !== r.id) : [...prev, r.id]);
                      }} className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500" />
                      <span className="font-medium text-gray-700 flex-1">{r.name}</span>
                      <span className="text-gray-500">{r.phone}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${r.status === "sent" ? "bg-emerald-100 text-emerald-700" : r.status === "failed" ? "bg-red-100 text-red-700" : r.status === "pending" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>{r.status}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
              <button onClick={() => setShowSendDialog(false)} disabled={sendingWa} className="px-5 py-3 text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition disabled:opacity-50">Annulla</button>
              <button onClick={() => handleSendWhatsApp(selectedSendIds)} disabled={sendingWa || selectedSendIds.length === 0} className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold shadow-sm text-white bg-green-600 hover:bg-green-700 transition disabled:opacity-50">
                {sendingWa ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sendingWa ? "Invio in corso..." : `Invia a ${selectedSendIds.length} contatti`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AvailabilityPreview({ propertyId, campaignStart, campaignEnd }: { propertyId: string; campaignStart: string; campaignEnd: string }) {
  const [ranges, setRanges] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [propRes, { data: bookings }, { data: overrides }] = await Promise.all([
        supabase.from("properties").select("*").eq("id", propertyId).maybeSingle(),
        supabase.from("bookings").select("check_in_date, check_out_date").eq("property_id", propertyId).in("status", ["confirmed", "pending"]),
        supabase.from("calendar_overrides").select("date, is_blocked, closed_to_arrival, closed_to_departure, min_stay").eq("property_id", propertyId),
      ]);
      const propMinStay = (propRes.data as any)?.min_stay || 1;

      const startDate = campaignStart ? new Date(campaignStart) : new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = campaignEnd ? new Date(campaignEnd) : new Date(startDate);
      if (!campaignEnd) endDate.setFullYear(endDate.getFullYear() + 1); else endDate.setHours(23, 59, 59, 0);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const from = today > startDate ? today : startDate;

      const blocked = new Set<string>();
      const noArrival = new Set<string>();
      const noDeparture = new Set<string>();
      const minStays: Record<string, number> = {};
      (bookings || []).forEach((b: any) => { const s = new Date(b.check_in_date), e = new Date(b.check_out_date); for (let d = new Date(s); d < e; d.setDate(d.getDate() + 1)) blocked.add(d.toISOString().split("T")[0]); });
      (overrides || []).forEach((o: any) => { if (o.is_blocked) blocked.add(o.date); if (o.closed_to_arrival) noArrival.add(o.date); if (o.closed_to_departure) noDeparture.add(o.date); if (o.min_stay) minStays[o.date] = o.min_stay; });

      const validRanges: string[] = [];
      let rangeStart: Date | null = null;
      let maxMinStay = 1;
      const iterDate = new Date(from);
      const endMs = endDate.getTime();
      while (iterDate.getTime() <= endMs) {
        const key = iterDate.toISOString().split("T")[0];
        const isLast = iterDate.getTime() >= endMs - 86400000;
        if (!blocked.has(key) && !rangeStart && !noArrival.has(key)) { rangeStart = new Date(iterDate); maxMinStay = Math.max(maxMinStay, minStays[key] || propMinStay); }
        else if (!blocked.has(key) && rangeStart) { maxMinStay = Math.max(maxMinStay, minStays[key] || propMinStay); }
        if ((blocked.has(key) || isLast) && rangeStart) {
          const rangeEnd = blocked.has(key) ? new Date(iterDate.getTime() - 86400000) : new Date(iterDate);
          if (!noDeparture.has(rangeEnd.toISOString().split("T")[0]) && rangeEnd >= rangeStart) {
            validRanges.push(`${rangeStart.toISOString().split("T")[0].split("-").reverse().join("/")} \u2192 ${rangeEnd.toISOString().split("T")[0].split("-").reverse().join("/")}${maxMinStay > 1 ? ` (min ${maxMinStay} notti)` : ""}`);
          }
          rangeStart = null; maxMinStay = 1;
        }
        iterDate.setDate(iterDate.getDate() + 1);
      }
      setRanges(validRanges);
      setLoading(false);
    })();
  }, [propertyId, campaignStart, campaignEnd]);

  if (loading) return <div className="text-xs text-gray-400 mt-2 italic">Calcolo disponibilità...</div>;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mt-2 text-xs space-y-1">
      <p className="font-bold text-gray-600 uppercase tracking-wide text-[10px]">Anteprima — date che verranno aggiunte al post:</p>
      {ranges && ranges.length > 0 ? (
        <div className="text-gray-700 font-medium whitespace-pre-line">
          📅 Date disponibili:{'\n'}{ranges.join('\n')}
        </div>
      ) : (
        <p className="text-gray-500">Al momento non ci sono date libere imminenti.</p>
      )}
    </div>
  );
}
