"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * FinanceTableScroll
 *
 * Presentational wrapper that adds a visible horizontal-scroll indicator to a
 * finance table (Req 16.3). It relies on the base `Table` primitive, which
 * renders its own scrollable container (`[data-slot="table-container"]`).
 *
 * On small viewports it fades a gradient on whichever edge still has hidden
 * content, giving the user a clear cue that the table continues sideways.
 * The indicator is purely visual (aria-hidden) and never blocks interaction.
 *
 * No business logic, mutations, or data are touched here.
 */
export function FinanceTableScroll({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = React.useState(false);
  const [showRight, setShowRight] = React.useState(false);

  const getScroller = React.useCallback((): HTMLElement | null => {
    const root = rootRef.current;
    if (!root) return null;
    return (
      root.querySelector<HTMLElement>('[data-slot="table-container"]') ?? root
    );
  }, []);

  const update = React.useCallback(() => {
    const scroller = getScroller();
    if (!scroller) return;
    const { scrollLeft, scrollWidth, clientWidth } = scroller;
    setShowLeft(scrollLeft > 4);
    setShowRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, [getScroller]);

  React.useEffect(() => {
    const scroller = getScroller();
    if (!scroller) return;
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [getScroller, update]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {showLeft && (
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-6 bg-gradient-to-r from-card to-transparent md:hidden"
          aria-hidden="true"
        />
      )}
      {showRight && (
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-6 bg-gradient-to-l from-card to-transparent md:hidden"
          aria-hidden="true"
        />
      )}
      {children}
    </div>
  );
}

export default FinanceTableScroll;
