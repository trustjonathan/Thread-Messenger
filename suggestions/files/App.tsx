import { useState } from "react";
import { ChatLayout } from "./components/ChatLayout";
import { Sidebar } from "./components/Sidebar";
import { ChatPane } from "./components/ChatPane";
import type { Chat, Message } from "./types";

// Replace with your real data / API calls.
const CHATS: Chat[] = [
  { id: "1", name: "Mwesigwa", handle: "@dev2", lastMessage: "hi", time: "06:42 AM", unread: 1 },
  { id: "2", name: "New group", lastMessage: "sup", time: "01:37 AM", unread: 0, isGroup: true, subtitle: "Anthony, Emma, Bivan…" },
  { id: "3", name: "Thread test group", lastMessage: "hi", time: "Nov 24", unread: 0, isGroup: true },
  { id: "4", name: "Mwesigwa Jonathan", handle: "@mwesigwa", lastMessage: "hi", time: "Nov 23", unread: 0 },
  { id: "5", name: "Edmo Rex", handle: "@edmorex369ug", lastMessage: "hi", time: "Nov 23", unread: 0 },
];

export default function App() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({
    "1": [{ id: "m1", text: "hi", time: "06:42 AM", mine: false }],
  });

  const active = CHATS.find((c) => c.id === activeId) ?? null;

  const send = (text: string) => {
    if (!activeId) return;
    const msg: Message = {
      id: crypto.randomUUID(),
      text,
      mine: true,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => ({ ...prev, [activeId]: [...(prev[activeId] ?? []), msg] }));
  };

  return (
    <ChatLayout
      hasActiveChat={!!active}
      sidebar={<Sidebar chats={CHATS} activeId={activeId} onSelect={setActiveId} />}
    >
      {active && (
        <ChatPane
          chat={active}
          messages={messages[active.id] ?? []}
          onBack={() => setActiveId(null)}
          onSend={send}
        />
      )}
    </ChatLayout>
  );
}
