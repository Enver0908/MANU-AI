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

function syncKeyboardInset() {
  if (typeof window === "undefined") return;
  const viewport = window.visualViewport;
  if (!viewport || !isMobileViewport()) {
    document.documentElement.style.setProperty("--keyboard-inset", "0px");
    return;
  }
  const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
  document.documentElement.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
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
      syncKeyboardInset();
      scrollFieldIntoView(event.target);
    };

    const root: Document | HTMLElement = containerRef?.current ?? document;
    root.addEventListener("focusin", onFocusIn);

    const viewport = window.visualViewport;
    const onViewportResize = () => {
      syncKeyboardInset();
      if (!isMobileViewport()) return;
      const active = document.activeElement;
      if (isFormField(active)) {
        scrollFieldIntoView(active);
      }
    };
    viewport?.addEventListener("resize", onViewportResize);
    viewport?.addEventListener("scroll", onViewportResize);
    window.addEventListener("resize", syncKeyboardInset);
    syncKeyboardInset();

    return () => {
      root.removeEventListener("focusin", onFocusIn);
      viewport?.removeEventListener("resize", onViewportResize);
      viewport?.removeEventListener("scroll", onViewportResize);
      window.removeEventListener("resize", syncKeyboardInset);
      document.documentElement.style.setProperty("--keyboard-inset", "0px");
    };
  }, [containerRef]);
}

/**
 * Keeps sticky action bars / composers above the compact bottom nav and the
 * on-screen keyboard via Visual Viewport + CSS `--keyboard-inset`.
 */
export function useShellKeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const onChange = () => syncKeyboardInset();
    viewport?.addEventListener("resize", onChange);
    viewport?.addEventListener("scroll", onChange);
    window.addEventListener("resize", onChange);
    syncKeyboardInset();
    return () => {
      viewport?.removeEventListener("resize", onChange);
      viewport?.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
      document.documentElement.style.setProperty("--keyboard-inset", "0px");
    };
  }, []);
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
  useShellKeyboardInset();
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
