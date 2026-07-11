"use client";
import React, { useEffect, useRef, useState } from "react";

/**
 * Generic press-and-drag reorderable list.
 * Works with touch (phone) and mouse (desktop testing).
 *
 * Usage:
 *   <DraggableStopList
 *     items={stops}
 *     getId={(s) => s.id}
 *     onReorder={(newOrder) => persistOrder(newOrder)}
 *     renderItem={(stop, index, dragHandleProps, isDragging) => (
 *       <StopCard stop={stop} index={index} dragHandleProps={dragHandleProps} isDragging={isDragging} />
 *     )}
 *   />
 */
export function DraggableStopList<T>({
  items,
  getId,
  onReorder,
  renderItem,
}: {
  items: T[];
  getId: (item: T) => string;
  onReorder: (items: T[]) => void;
  renderItem: (
    item: T,
    index: number,
    dragHandleProps: {
      onMouseDown: (e: React.MouseEvent) => void;
      onTouchStart: (e: React.TouchEvent) => void;
    },
    isDragging: boolean,
  ) => React.ReactNode;
}) {
  const [list, setList] = useState<T[]>(items);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const startY = useRef(0);
  const listRef = useRef<T[]>(items);

  // Keep local list in sync with incoming props, but not mid-drag
  useEffect(() => {
    if (dragIndex === null) {
      setList(items);
      listRef.current = items;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  useEffect(() => {
    listRef.current = list;
  }, [list]);

  function beginDrag(index: number, clientY: number) {
    setDragIndex(index);
    startY.current = clientY;
    setDragY(0);
    document.body.style.userSelect = "none";
    document.body.style.touchAction = "none";
  }

  function onMouseDown(index: number) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      beginDrag(index, e.clientY);
    };
  }
  function onTouchStart(index: number) {
    return (e: React.TouchEvent) => {
      beginDrag(index, e.touches[0].clientY);
    };
  }

  useEffect(() => {
    if (dragIndex === null) return;

    function handleMove(clientY: number) {
      const delta = clientY - startY.current;
      setDragY(delta);

      const draggedEl = itemRefs.current[dragIndex as number];
      if (!draggedEl) return;
      const draggedRect = draggedEl.getBoundingClientRect();
      const draggedCenter = draggedRect.top + draggedRect.height / 2 + delta;

      let newIndex = dragIndex as number;
      for (let i = 0; i < listRef.current.length; i++) {
        if (i === dragIndex) continue;
        const el = itemRefs.current[i];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const center = r.top + r.height / 2;
        if (i < (dragIndex as number) && draggedCenter < center) {
          newIndex = Math.min(newIndex, i);
        }
        if (i > (dragIndex as number) && draggedCenter > center) {
          newIndex = Math.max(newIndex, i);
        }
      }

      if (newIndex !== dragIndex) {
        setList((prev) => {
          const copy = [...prev];
          const [moved] = copy.splice(dragIndex as number, 1);
          copy.splice(newIndex, 0, moved);
          return copy;
        });
        setDragIndex(newIndex);
        startY.current = clientY;
        setDragY(0);
      }
    }

    function onMouseMove(e: MouseEvent) {
      handleMove(e.clientY);
    }
    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      handleMove(e.touches[0].clientY);
    }
    function endDrag() {
      setDragIndex(null);
      setDragY(0);
      document.body.style.userSelect = "";
      document.body.style.touchAction = "";
      onReorder(listRef.current);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", endDrag);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", endDrag);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragIndex]);

  return (
    <div>
      {list.map((item, i) => {
        const isDragging = dragIndex === i;
        return (
          <div
            key={getId(item)}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            style={{
              transform: isDragging
                ? `translateY(${dragY}px) scale(1.02)`
                : "none",
              transition: isDragging ? "none" : "transform 0.2s ease",
              position: "relative",
              zIndex: isDragging ? 10 : 1,
              boxShadow: isDragging ? "0 10px 28px rgba(0,0,0,0.35)" : "none",
              borderRadius: 14,
            }}
          >
            {renderItem(
              item,
              i,
              { onMouseDown: onMouseDown(i), onTouchStart: onTouchStart(i) },
              isDragging,
            )}
          </div>
        );
      })}
    </div>
  );
}
