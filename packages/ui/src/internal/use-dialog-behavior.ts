'use client';
import { useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';

// Selector for elements a keyboard user can reach. Matches the common
// accessible-dialog focus-trap pattern: native interactive elements, links
// with an `href`, and anything explicitly opted into the tab order via a
// non-negative `tabindex`. Elements already excluded from the tab order
// (`tabindex="-1"`) are deliberately not focus-trap targets.
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) =>
      !element.hasAttribute('disabled') &&
      element.getAttribute('aria-hidden') !== 'true' &&
      // `offsetParent` is null for elements that are `display: none` (or not
      // in the layout tree at all) — a cheap, dependency-free visibility check.
      element.offsetParent !== null,
  );
}

export function useDialogBehavior(open: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement;

    // WAI-ARIA Dialog (Modal) Pattern: focus moves into the dialog the
    // moment it opens, not on the user's first Tab press. Focus the first
    // focusable descendant if there is one; otherwise fall back to the
    // container itself (already `tabIndex={-1}` for exactly this case).
    const container = containerRef.current;
    if (!container) return;
    const [first] = getFocusableElements(container);
    if (first) {
      first.focus();
    } else {
      container.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const container = containerRef.current;
      if (!container) return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        // Nothing inside to cycle through — keep focus pinned to the
        // container itself (it must be programmatically focusable via
        // `tabIndex={-1}` for this to work).
        event.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const activeIsInside = active instanceof Node && container.contains(active);

      if (event.shiftKey) {
        // Shift+Tab: wrap from the first focusable element back to the last.
        // Also fires if focus somehow isn't inside the container at all
        // (e.g. it never moved off the trigger), so the very first Tab press
        // still lands inside the dialog instead of escaping it.
        if (!activeIsInside || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else {
        // Tab: wrap from the last focusable element back to the first.
        if (!activeIsInside || active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) return;
    const trigger = triggerRef.current;
    if (trigger && trigger.isConnected) (trigger as HTMLElement).focus?.();
  }, [open]);

  function backdropProps() {
    return {
      onClick: (event: MouseEvent) => {
        if (event.target === event.currentTarget) onClose();
      },
    };
  }

  return { containerRef, backdropProps };
}
