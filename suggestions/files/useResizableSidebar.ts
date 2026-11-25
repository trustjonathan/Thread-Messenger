import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

const MIN = 300;
const MAX = 560;
const DEFAULT = 400;
const STORAGE_KEY = "chat-sidebar-width";

const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v));

const readSaved = () => {
  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return saved ? clamp(saved) : DEFAULT;
  } catch {
    return DEFAULT;
  }
};

const save = (w: number) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(w));
  } catch {
    /* ignore */
  }
};

export function useResizableSidebar() {
  const [width, setWidth] = useState(readSaved);
  const [dragging, setDragging] = useState(false);
  const origin = useRef({ x: 0, w: 0 });
  const latest = useRef(width);
  latest.current = width;

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    e.preventDefault();
    origin.current = { x: e.clientX, w: latest.current };
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) =>
      setWidth(clamp(origin.current.w + e.clientX - origin.current.x));
    const onUp = () => {
      setDragging(false);
      save(latest.current);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging]);

  const handleProps = {
    role: "separator" as const,
    "aria-orientation": "vertical" as const,
    "aria-valuenow": width,
    "aria-valuemin": MIN,
    "aria-valuemax": MAX,
    tabIndex: 0,
    onPointerDown,
    onDoubleClick: () => {
      setWidth(DEFAULT);
      save(DEFAULT);
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const next = clamp(width + (e.key === "ArrowRight" ? 16 : -16));
      setWidth(next);
      save(next);
    },
  };

  return { width, dragging, handleProps };
}
