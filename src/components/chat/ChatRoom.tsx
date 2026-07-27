"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Send, Paperclip, Image as ImageIcon, Settings, Check, X, Palette, Upload, Trash2 } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/utils/supabase/client";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  media_url: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    role: string;
  };
}

interface ChatRoomProps {
  conversationId: string;
  onBack: () => void;
}

export default function ChatRoom({ conversationId, onBack }: ChatRoomProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [convName, setConvName] = useState<string>("");
  const [convColor, setConvColor] = useState<string>("#E11D48");
  const [showSettings, setShowSettings] = useState(false);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [members, setMembers] = useState<any[]>([]);
  const [availableStaff, setAvailableStaff] = useState<any[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const saveSettings = async () => {
    await supabase
      .from('conversations')
      .update({ name: editName, color: editColor })
      .eq('id', conversationId);
    
    setConvName(editName);
    setConvColor(editColor);
    setShowSettings(false);
  };

  const fetchAvailableStaff = async () => {
    const convMemberIds = members.map(m => m.profile_id).filter(Boolean);
    if (convMemberIds.length === 0) {
      const { data: staffData } = await supabase
        .from('staff_members')
        .select('id, user_id, name, role');
      if (staffData) setAvailableStaff(staffData);
      return;
    }
    
    const { data: staffData } = await supabase
      .from('staff_members')
      .select('id, user_id, name, role')
      .or(`id.not.in.(${convMemberIds.join(',')}),and(user_id.not.in.(${convMemberIds.join(',')}))`);
    
    if (staffData) {
      setAvailableStaff(staffData);
    }
  };

  const addMember = async (staffId: string) => {
    const staffMember = availableStaff.find(s => s.id === staffId);
    const profileId = staffMember?.user_id || staffId;
    
    const { error } = await supabase.from('conversation_participants').insert({
      conversation_id: conversationId,
      profile_id: profileId
    });
    
    if (error) {
      if (error.code === '23505') {
        alert("Questo membro è già nella chat");
        return;
      }
      console.error("Error adding member:", error);
    }
    
    if (staffMember) {
      setMembers([...members, { profile_id: profileId, profiles: { full_name: staffMember.name, role: staffMember.role } }]);
    }
    setShowAddMember(false);
  };

  const removeMember = async (staffId: string) => {
    const { error } = await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('profile_id', staffId);
    
    if (!error) {
      setMembers(members.filter(m => m.profile_id !== staffId));
    }
  };

  const deleteConversation = async () => {
    if (!confirm("Sei sicuro di eliminare questa chat? L'azione è irreversibile.")) return;
    
    await supabase.from('conversations').delete().eq('id', conversationId);
    onBack();
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      fetchMessages();
    };
    init();
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const fetchMessages = async () => {
    try {
      const { data: convData } = await supabase
        .from('conversations')
        .select('name, is_group, color, conversation_participants(profiles(id, full_name, role))')
        .eq('id', conversationId)
        .single();
      
      if (convData?.conversation_participants) {
        setMembers(convData.conversation_participants);
        const others = convData.conversation_participants.filter((p: any) => p.profiles?.full_name);
        if (convData.name) {
          setConvName(convData.name);
          setEditName(convData.name);
        } else {
          setConvName(others.map((p: any) => p.profiles.full_name).join(", ") || "Chat");
          setEditName(others.map((p: any) => p.profiles.full_name).join(", ") || "Chat");
        }
        setConvColor(convData.color || "#E11D48");
        setEditColor(convData.color || "#E11D48");
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          *,
          profiles(full_name, role)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
    } catch (error) {
      console.error("Errore fetch messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: newMessage.trim(),
          message_type: 'text'
        })
        .select(`
          *,
          profiles(full_name, role)
        `)
        .single();

      if (!error && data) {
        setMessages(prev => [...prev, data]);
        setNewMessage("");
        setShowAttachments(false);
      }
    } catch (error) {
      console.error("Errore invio messaggio:", error);
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setShowAttachments(false);

    try {
      console.log("Uploading file:", file.name, file.type, file.size);
      
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${conversationId}/${Date.now()}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        alert("Errore upload: " + uploadError.message);
        setUploading(false);
        return;
      }

      console.log("Upload success:", uploadData);

      const { data: urlData } = supabase.storage
        .from('chat-media')
        .getPublicUrl(uploadData.path);

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: null,
          message_type: 'image',
          media_url: urlData.publicUrl
        })
        .select(`
          *,
          profiles(full_name, role)
        `)
        .single();

      if (error) {
        console.error("DB error:", error);
        alert("Errore salvataggio: " + error.message);
      } else if (data) {
        setMessages(prev => [...prev, data]);
      }
    } catch (error: any) {
      console.error("Errore upload:", error);
      alert("Errore: " + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Oggi";
    if (isYesterday(date)) return "Ieri";
    return format(date, "EEEE d MMMM", { locale: it });
  };

  const formatTime = (dateStr: string) => {
    return format(new Date(dateStr), "HH:mm");
  };

  const groupMessagesByDate = () => {
    const groups: { [key: string]: Message[] } = {};
    messages.forEach(msg => {
      const dateKey = formatDate(msg.created_at);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(msg);
    });
    return groups;
  };

  const groupedMessages = groupMessagesByDate();

  return (
    <div className="flex flex-col h-full bg-gray-100">
      <div 
        className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10"
        style={{ borderTopColor: convColor, borderTopWidth: 3 }}
      >
        <button
          onClick={onBack}
          className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-900 truncate">{convName}</h2>
          <p className="text-xs text-gray-500">
            {members.length} membri · {messages.length} messaggi
          </p>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Settings className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.entries(groupedMessages).map(([date, msgs]) => (
            <div key={date}>
              <div className="flex justify-center mb-4">
                <span className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                  {date}
                </span>
              </div>
              <div className="space-y-2">
                {msgs.map((msg) => {
                  const isMine = msg.sender_id === currentUserId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          isMine
                            ? "bg-rose-600 text-white rounded-br-md"
                            : "bg-white text-gray-900 rounded-bl-md shadow-sm"
                        }`}
                      >
                        {msg.message_type === "image" && msg.media_url && (
                          <div className="mb-2">
                            <img
                              src={msg.media_url}
                              alt="Immagine"
                              className="rounded-lg max-w-full max-h-64 object-cover"
                            />
                          </div>
                        )}
                        {msg.content && (
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                        )}
                        <p
                          className={`text-[10px] mt-1 ${
                            isMine ? "text-rose-200" : "text-gray-400"
                          } text-right`}
                        >
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div className="bg-white border-t border-gray-200 p-2">
        {showAttachments && (
          <div className="flex gap-2 mb-2 px-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              <ImageIcon className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-600">Foto</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            onClick={() => setShowAttachments(!showAttachments)}
            className="p-3 hover:bg-gray-100 rounded-full transition-colors"
          >
            <Paperclip className="w-5 h-5 text-gray-500" />
          </button>

          <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-2 flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Scrivi un messaggio..."
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-sm max-h-32"
              style={{ minHeight: "24px" }}
            />
          </div>

          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className={`p-3 rounded-full transition-colors ${
              newMessage.trim() && !sending
                ? "bg-rose-600 hover:bg-rose-700 text-white"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            {sending ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-bold text-lg">Impostazioni Chat</h2>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Chat</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Palette className="w-4 h-4 inline mr-1" />
                  Colore
                </label>
                <div className="flex gap-2 flex-wrap">
                  {["#E11D48", "#2563EB", "#059669", "#D97706", "#7C3AED", "#DB2777"].map((color) => (
                    <button
                      key={color}
                      onClick={() => setEditColor(color)}
                      className={`w-8 h-8 rounded-full transition-transform ${editColor === color ? 'scale-125 ring-2 ring-offset-2 ring-gray-400' : ''}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Membri</label>
                  <button
                    onClick={() => { fetchAvailableStaff(); setShowAddMember(true); }}
                    className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                  >
                    + Aggiungi
                  </button>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {members.map((m) => (
                    <div key={m.profile_id} className="flex items-center justify-between text-sm p-1 hover:bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: convColor }}
                        >
                          {(m.profiles?.full_name || "?").charAt(0).toUpperCase()}
                        </div>
                        <span>{m.profiles?.full_name || "Membro"}</span>
                      </div>
                      {m.profile_id !== currentUserId && (
                        <button
                          onClick={() => removeMember(m.profile_id)}
                          className="text-gray-400 hover:text-red-500 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t bg-gray-50 space-y-2">
              <button
                onClick={saveSettings}
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Salva Modifiche
              </button>
              <button
                onClick={deleteConversation}
                className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-lg transition-colors"
              >
                Elimina Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddMember && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <h3 className="font-bold">Aggiungi Membro</h3>
                <button onClick={() => setShowAddMember(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 max-h-64 overflow-y-auto">
                {availableStaff.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Nessun membro disponibile</p>
                ) : (
                  <div className="space-y-2">
                    {availableStaff.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => addMember(s.id)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                          {(s.name || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{s.name}</p>
                          <p className="text-xs text-gray-500">{s.role}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}