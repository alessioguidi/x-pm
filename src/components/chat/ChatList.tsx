"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Plus, X, Users } from "lucide-react";
import { supabase } from "@/utils/supabase/client";
import ChatRoom from "./ChatRoom";

interface Conversation {
  id: string;
  name: string | null;
  is_group: boolean;
  color: string | null;
  avatar_url: string | null;
  updated_at: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  conversation_participants: {
    id: string;
    profile_id: string;
    unread_count: number;
    profiles: {
      full_name: string | null;
      role: string;
    };
  }[];
}

interface StaffMember {
  id: string;
  user_id: string | null;
  name: string;
  role: string;
}

export default function ChatList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [chatName, setChatName] = useState("");
  const [currentOrgId, setCurrentOrgId] = useState<string>("");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
      fetchConversations();
    };
    init();
  }, []);

  const fetchConversations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) return;
      
      setCurrentOrgId(profile.organization_id);

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          conversation_participants(
            *,
            profiles(full_name, role)
          )
        `)
        .eq('organization_id', profile.organization_id)
        .order('updated_at', { nullsFirst: false, ascending: false });

      if (!error && data) {
        setConversations(data);
      }
    } catch (error) {
      console.error("Errore fetch conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    if (!currentOrgId) return;
    
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('organization_id', currentOrgId)
      .neq('id', currentUserId);
    
    if (profileData) {
      setStaff(profileData.filter(p => p.full_name).map(p => ({ 
        id: p.id, 
        user_id: p.id, 
        name: p.full_name, 
        role: p.role 
      })));
    }
  };

  const openNewChat = async () => {
    setShowNewChat(true);
    setSelectedStaff([]);
    setChatName("");
    await fetchStaff();
  };

  const createConversation = async () => {
    if (selectedStaff.length === 0) return;

    const participantPromises = selectedStaff.map(async (staffId) => {
      const member = staff.find(s => s.id === staffId);
      if (member?.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', member.user_id)
          .single();
        return profile?.id || null;
      }
      return null;
    });

    const participantIds = await Promise.all(participantPromises);
    const validParticipantIds = participantIds.filter(Boolean);
    
    if (validParticipantIds.length === 0) {
      alert("Nessuno dei membri selezionati ha un profilo valido");
      return;
    }

    const allParticipants = [...validParticipantIds, currentUserId];
    
    const { data: conv, error } = await supabase
      .from('conversations')
      .insert({
        organization_id: currentOrgId,
        name: chatName || null,
        is_group: selectedStaff.length > 1 || !chatName
      })
      .select()
      .single();

    if (error || !conv) {
      console.error("Error creating conversation:", error);
      return;
    }

    const participants = allParticipants.map(pId => ({
      conversation_id: conv.id,
      profile_id: pId
    }));

    await supabase.from('conversation_participants').insert(participants).then(({ error }) => {
      if (error && error.code !== '23505') {
        console.error("Error adding participants:", error);
      }
    });

    setShowNewChat(false);
    fetchConversations();
    openChat(conv.id);
  };

  const openChat = (conversationId: string) => {
    setSelectedConversation(conversationId);
    setShowChat(true);
  };

  const closeChat = () => {
    setShowChat(false);
    setSelectedConversation(null);
    fetchConversations();
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "Ieri";
    } else if (days < 7) {
      return date.toLocaleDateString("it-IT", { weekday: "short" });
    } else {
      return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
    }
  };

  const totalUnread = () => {
    return conversations.reduce((acc, conv) => {
      const myParticipant = conv.conversation_participants?.find(p => p.profile_id === currentUserId);
      return acc + (myParticipant?.unread_count || 0);
    }, 0);
  };

  const getChatName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    if (conv.is_group) {
      const others = conv.conversation_participants?.filter(p => p.profile_id !== currentUserId) || [];
      return others.map(p => p.profiles?.full_name || "Membro").join(", ") || "Gruppo";
    }
    const other = conv.conversation_participants?.find(p => p.profile_id !== currentUserId);
    return other?.profiles?.full_name || "Chat";
  };

  if (showChat && selectedConversation) {
    return (
      <div className="h-full">
        <ChatRoom conversationId={selectedConversation} onBack={closeChat} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-rose-600" />
          <h1 className="text-lg font-bold text-gray-900">Messaggi</h1>
        </div>
        <div className="flex items-center gap-2">
          {totalUnread() > 0 && (
            <span className="bg-rose-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {totalUnread()}
            </span>
          )}
          <button
            onClick={openNewChat}
            className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-full transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm">Nessuna conversazione</p>
            <button
              onClick={openNewChat}
              className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium"
            >
              Crea nuova chat
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 bg-white">
            {conversations.map((conv) => {
              const myParticipant = conv.conversation_participants?.find(
                p => p.profile_id === currentUserId
              );
              const unread = myParticipant?.unread_count || 0;
              const chatName = getChatName(conv);
              const convColor = conv.color || "#E11D48";
              const otherMembers = conv.conversation_participants?.filter(p => p.profile_id !== currentUserId) || [];
              const memberNames = otherMembers.slice(0, 3).map(p => p.profiles?.full_name?.split(" ")[0] || "?").join(", ");
              const moreMembers = otherMembers.length > 3 ? `+${otherMembers.length - 3}` : "";

              return (
                <button
                  key={conv.id}
                  onClick={() => openChat(conv.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold"
                    style={{ backgroundColor: convColor }}
                  >
                    {conv.avatar_url ? (
                      <img src={conv.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : conv.is_group ? (
                      <Users className="w-6 h-6" />
                    ) : (
                      (chatName).charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900 truncate">{chatName}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {formatTime(conv.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <p className="text-sm text-gray-500 truncate flex-1">
                        {conv.last_message_preview || "Nessun messaggio"}
                      </p>
                      {unread > 0 && (
                        <span className="bg-rose-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showNewChat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-bold text-lg">Nuova Chat</h2>
              <button onClick={() => setShowNewChat(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Chat (opzionale)
                </label>
                <input
                  type="text"
                  value={chatName}
                  onChange={(e) => setChatName(e.target.value)}
                  placeholder="Es. Villa Rosa - Staff"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleziona membri
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {staff.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStaff.includes(member.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStaff([...selectedStaff, member.id]);
                          } else {
                            setSelectedStaff(selectedStaff.filter(id => id !== member.id));
                          }
                        }}
                        className="w-4 h-4 text-rose-600 rounded"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{member.name}</p>
                        <p className="text-xs text-gray-500">{member.role}</p>
                      </div>
                    </label>
                  ))}
                  {staff.length === 0 && (
                    <p className="text-sm text-gray-400">Nessun membro dello staff disponibile</p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t bg-gray-50">
              <button
                onClick={createConversation}
                disabled={selectedStaff.length === 0}
                className="w-full py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition-colors"
              >
                Crea Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}