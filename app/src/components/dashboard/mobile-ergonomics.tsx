"use client";

import { useEffect, type ReactNode, type RefObject } from "react";
import { MOBILE_CHROME_CLASS } from "@/lib/phase-83e5-mobile-ergonomics";
import { cn } from "@/components/ui/cn";

/** Tailwind `lg` breakpoint — matches the shell's desktop sidebar switch. */
const MOBILE_MAX_WIDTH_PX = 1024;

function isMobileViewport() {
  return typeof window !== "undefined" && window.innerWidth < MOBILE_MAX_WIDTH_PX;
}

function isFormField(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/**
 * Scroll focused form fields into view when the on-screen keyboard opens on mobile.
 * Attach to the dashboard main content container; no-op on desktop widths.
 */
export function useMobileKeyboardScroll(containerRef?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const scrollFieldIntoView = (target: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
      window.setTimeout(() => {
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 280);
    };

    const onFocusIn = (event: Event) => {
      if (!isMobileViewport() || !isFormField(event.target)) return;
      scrollFieldIntoView(event.target);
    };

    const root: Document | HTMLElement = containerRef?.current ?? document;
    root.addEventListener("focusin", onFocusIn);

    const viewport = window.visualViewport;
    const onViewportResize = () => {
      if (!isMobileViewport()) return;
      const active = document.activeElement;
      if (isFormField(active)) {
        scrollFieldIntoView(active);
      }
    };
    viewport?.addEventListener("resize", onViewportResize);

    return () => {
      root.removeEventListener("focusin", onFocusIn);
      viewport?.removeEventListener("resize", onViewportResize);
    };
  }, [containerRef]);
}

/**
 * One-handed primary action bar fixed above the mobile bottom nav.
 * Hidden on `lg+` where inline panel actions remain reachable via mouse/trackpad.
 */
export function MobileStickyActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur lg:hidden",
        MOBILE_CHROME_CLASS.stickyBarPosition,
        className,
      )}
      data-testid="mobile-sticky-action-bar"
    >
      <div className="flex flex-col gap-2 px-safe py-3">{children}</div>
    </div>
  );
}
