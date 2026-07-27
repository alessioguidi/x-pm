import ChatList from "@/components/chat/ChatList";
import { Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function ChatPage() {
  return (
    <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-80px)]">
      <ChatList />
    </div>
  );
}