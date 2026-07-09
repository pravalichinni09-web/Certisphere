/**
 * useDraggable — generic hook that makes any element draggable on screen.
 *
 * Returns:
 *   - `position`: { x: number; y: number } | null — absolute viewport
 *     coordinates of the element's top-left corner. `null` means
 *     "use default CSS positioning" (the user hasn't dragged it yet).
 *   - `onPointerDown`: handler to attach to the drag handle element.
 *   - `isDragging`: true while a drag gesture is in progress.
 *
 * Position is persisted to `localStorage` under the provided `storageKey`
 * so the user's preferred placement survives renders + page reloads.
 *
 * `onPointerDown` distinguishes between a click and a drag using a 4px
 * movement threshold, so a tap on the FAB still opens the panel.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface Position { x: number; y: number; }

interface Options {
  storageKey: string;
  /** Width of the draggable element — used to keep it inside the viewport */
  width?: number;
  /** Height of the draggable element */
  height?: number;
  /** Optional click handler that fires ONLY if the pointer didn't drag */
  onClick?: () => void;
}

export function useDraggable({ storageKey, width = 0, height = 0, onClick }: Options) {
  // Lazy initial read of the saved position
  const [position, setPosition] = useState<Position | null>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') return parsed;
      return null;
    } catch { return null; }
  });
  const [isDragging, setIsDragging] = useState(false);

  // Refs for the in-flight drag gesture
  const dragRef = useRef<{
    startX: number; startY: number;
    originX: number; originY: number;
    moved: boolean;
  } | null>(null);

  // Persist position whenever it changes
  useEffect(() => {
    if (!position) return;
    try { localStorage.setItem(storageKey, JSON.stringify(position)); } catch { /* ignore */ }
  }, [position, storageKey]);

  const clamp = useCallback((p: Position): Position => {
    const w = width || 0;
    const h = height || 0;
    const maxX = window.innerWidth  - w - 4;
    const maxY = window.innerHeight - h - 4;
    return {
      x: Math.max(4, Math.min(p.x, maxX < 4 ? 4 : maxX)),
      y: Math.max(4, Math.min(p.y, maxY < 4 ? 4 : maxY)),
    };
  }, [width, height]);

  // Keep within viewport when the window resizes
  useEffect(() => {
    if (!position) return;
    const onResize = () => setPosition((prev) => (prev ? clamp(prev) : null));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [position, clamp]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only respond to primary button / touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // Find the actual rendered element to read its current bounding box
    const target = (e.currentTarget as HTMLElement).closest('[data-draggable-root]') as HTMLElement | null;
    const rect = target ? target.getBoundingClientRect() : (e.currentTarget as HTMLElement).getBoundingClientRect();

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };

    const onMove = (ev: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      if (!dragRef.current.moved && Math.hypot(dx, dy) > 4) {
        dragRef.current.moved = true;
        setIsDragging(true);
        document.body.style.userSelect = 'none';
      }
      if (dragRef.current.moved) {
        const next = clamp({
          x: dragRef.current.originX + dx,
          y: dragRef.current.originY + dy,
        });
        setPosition(next);
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      const moved = dragRef.current?.moved ?? false;
      dragRef.current = null;
      setIsDragging(false);
      if (!moved && onClick) onClick();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [clamp, onClick]);

  const reset = useCallback(() => {
    setPosition(null);
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }, [storageKey]);

  return { position, isDragging, onPointerDown: handlePointerDown, reset };
}
