import type { Chat } from "../types";

const COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
];

export function Avatar({ chat, className = "h-12 w-12" }: { chat: Chat; className?: string }) {
  const initials = chat.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const color = COLORS[chat.name.length % COLORS.length];

  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full text-sm font-semibold ${color} ${className}`}
    >
      {initials}
    </div>
  );
}
