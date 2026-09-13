# Accessibility

Required — never traded for visual styling. Adopt the project's existing
accessibility patterns; this is the minimum to check on the changed surface.

- Semantic HTML (`<button>`, `<label>`, `<nav>`, headings in order) before ARIA.
- Every input has a programmatically associated label.
- All interactive elements are reachable and operable by keyboard; no traps.
- Visible focus state on every focusable element (use the project's focus style).
- Focus is managed on route changes, dialog open/close, and after form submit
  (move focus to the first error).
- ARIA only where native semantics are insufficient; prefer removing the need.
- Color contrast for text and essential UI states meets the accessibility
  standard applicable to this project. Where WCAG 2.2 AA applies (the common
  case, absent a stricter stated requirement), that means 4.5:1 for normal
  text, 3:1 for large text (≥ 24px, or ≥ 19px bold) and for meaningful non-text
  UI. Use the project's tokens; if a token fails, raise it rather than
  inventing a one-off color.
- Errors are announced (`aria-live="polite"` region, or `role="alert"`).
- Disabled and loading states are conveyed non-visually (`disabled`,
  `aria-busy`, `aria-disabled` as appropriate).
- Touch targets: follow the project's established minimum; if it has none, size
  controls for reliable touch use per current platform/accessibility guidance for
  that control type.
- Respect `prefers-reduced-motion` for any animation added.
- Do a screen-reader pass over the changed flow before declaring done.
