import { useEffect, useRef, useState } from "react";
import { ArrowLeft, MoreVertical, Paperclip, Search, SendHorizontal } from "lucide-react";
import type { Chat, Message } from "../types";
import { Avatar } from "./Avatar";

interface Props {
  chat: Chat;
  messages: Message[];
  onBack: () => void;
  onSend: (text: string) => void;
}

export function ChatPane({ chat, messages, onBack, onSend }: Props) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, chat.id]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  return (
    <>
      <header className="flex h-[60px] shrink-0 items-center gap-3 bg-[#f0f2f5] px-4">
        <button onClick={onBack} className="-ml-2 rounded-full p-2 hover:bg-slate-200 lg:hidden">
          <ArrowLeft size={20} />
        </button>
        <Avatar chat={chat} className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-slate-900">{chat.name}</p>
          {chat.subtitle && <p className="truncate text-xs text-slate-500">{chat.subtitle}</p>}
        </div>
        <button className="rounded-full p-2 text-slate-600 hover:bg-slate-200"><Search size={18} /></button>
        <button className="rounded-full p-2 text-slate-600 hover:bg-slate-200"><MoreVertical size={18} /></button>
      </header>

      <div className="flex-1 overflow-y-auto bg-[#efeae2] px-4 py-4 lg:px-[6%]">
        <div className="mx-auto flex max-w-3xl flex-col gap-1">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] whitespace-pre-wrap break-words rounded-lg px-3 py-1.5 text-[14.5px] shadow-sm ${
                  m.mine ? "rounded-tr-none bg-[#d9fdd3]" : "rounded-tl-none bg-white"
                }`}
              >
                {m.text}
                <span className="float-right ml-3 mt-2 text-[11px] text-slate-500">{m.time}</span>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <footer className="flex shrink-0 items-center gap-2 bg-[#f0f2f5] px-3 py-2.5">
        <button className="rounded-full p-2 text-slate-600 hover:bg-slate-200"><Paperclip size={20} /></button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Type a message"
          className="flex-1 rounded-full bg-white px-4 py-2.5 text-sm outline-none"
        />
        <button
          onClick={submit}
          disabled={!draft.trim()}
          className="rounded-full p-2 text-indigo-600 hover:bg-slate-200 disabled:text-slate-400"
        >
          <SendHorizontal size={20} />
        </button>
      </footer>
    </>
  );
}
