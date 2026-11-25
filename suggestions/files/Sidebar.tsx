import { useMemo, useState } from "react";
import { MoreVertical, Plus, Search } from "lucide-react";
import type { Chat } from "../types";
import { Avatar } from "./Avatar";

interface Props {
  chats: Chat[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

type Filter = "All" | "Unread" | "Groups";
const FILTERS: Filter[] = ["All", "Unread", "Groups"];

export function Sidebar({ chats, activeId, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats.filter((c) => {
      if (filter === "Unread" && !c.unread) return false;
      if (filter === "Groups" && !c.isGroup) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.handle?.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q)
      );
    });
  }, [chats, query, filter]);

  return (
    <>
      <header className="flex items-center justify-between px-4 pb-2 pt-4">
        <h1 className="text-[22px] font-bold text-slate-900">Chats</h1>
        <div className="flex items-center gap-1">
          <button
            className="rounded-full bg-indigo-600 p-2.5 text-white hover:bg-indigo-700"
            title="New chat"
          >
            <Plus size={18} />
          </button>
          <button className="rounded-full p-2.5 text-slate-600 hover:bg-slate-100" title="Menu">
            <MoreVertical size={18} />
          </button>
        </div>
      </header>

      <div className="px-3 py-2">
        <label className="flex items-center gap-3 rounded-full bg-[#f0f2f5] px-4 py-2 focus-within:ring-2 focus-within:ring-indigo-400">
          <Search size={16} className="text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or start a new chat"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
          />
        </label>
      </div>

      <div className="flex gap-2 px-3 pb-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-sm ${
              filter === f
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <ul className="flex-1 overflow-y-auto">
        {visible.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-slate-500">No chats found</li>
        )}
        {visible.map((c) => (
          <li key={c.id}>
            <button
              onClick={() => onSelect(c.id)}
              className={`flex w-full items-center gap-3 px-3 text-left hover:bg-[#f5f6f6] ${
                activeId === c.id ? "bg-[#f0f2f5]" : ""
              }`}
            >
              <Avatar chat={c} />
              <div className="min-w-0 flex-1 border-b border-slate-100 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium text-slate-900">
                    {c.name}
                    {c.handle && (
                      <span className="ml-2 text-xs font-normal text-slate-500">{c.handle}</span>
                    )}
                  </span>
                  <span
                    className={`shrink-0 text-xs ${
                      c.unread ? "font-medium text-indigo-600" : "text-slate-500"
                    }`}
                  >
                    {c.time}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-slate-500">{c.lastMessage}</span>
                  {c.unread > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-indigo-600 px-1.5 text-xs font-medium text-white">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
