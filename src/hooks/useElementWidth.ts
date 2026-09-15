"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Tracks an element's width. Returns a callback ref, so it works for conditionally rendered nodes. */
export function useElementWidth<T extends HTMLElement>() {
  const [width, setWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback((element: T | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!element) return;
    setWidth(element.getBoundingClientRect().width);
    observerRef.current = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observerRef.current.observe(element);
  }, []);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return [ref, width] as const;
}
