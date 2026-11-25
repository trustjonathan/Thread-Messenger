import type { ReactNode } from "react";
import { useIsDesktop } from "../hooks/useMediaQuery";
import { useResizableSidebar } from "../hooks/useResizableSidebar";

interface Props {
  hasActiveChat: boolean;
  sidebar: ReactNode;
  children: ReactNode;
}

export function ChatLayout({ hasActiveChat, sidebar, children }: Props) {
  const isDesktop = useIsDesktop();
  const { width, dragging, handleProps } = useResizableSidebar();

  // Mobile: list OR chat. Desktop: both.
  const showSidebar = isDesktop || !hasActiveChat;
  const showChat = isDesktop || hasActiveChat;

  return (
    <div
      className={`flex h-dvh w-full overflow-hidden bg-[#f0f2f5] ${
        dragging ? "cursor-col-resize select-none" : ""
      }`}
    >
      {showSidebar && (
        <aside
          style={isDesktop ? { width } : undefined}
          className="flex h-full w-full shrink-0 flex-col border-r border-slate-200 bg-white lg:w-auto"
        >
          {sidebar}
        </aside>
      )}

      {/* Drag handle: rendered on desktop only */}
      {isDesktop && (
        <div
          {...handleProps}
          title="Drag to resize · double-click to reset"
          className={`relative z-10 -ml-px w-1 shrink-0 cursor-col-resize transition-colors hover:bg-indigo-400/60 focus-visible:bg-indigo-500 focus-visible:outline-none ${
            dragging ? "bg-indigo-500" : "bg-transparent"
          }`}
        >
          <span className="absolute inset-y-0 -left-1 -right-1" />
        </div>
      )}

      {showChat && (
        <main className="flex h-full min-w-0 flex-1 flex-col">
          {hasActiveChat ? (
            children
          ) : (
            <div className="m-auto px-6 text-center text-slate-500">
              <p className="text-2xl font-light">Select a chat to start messaging</p>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
