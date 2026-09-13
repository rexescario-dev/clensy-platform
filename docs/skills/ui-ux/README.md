# Project-adaptive UI/UX skill

Improve UI/UX inside an existing codebase using **that project's own** stack,
components, and conventions. The best result is the one that looks like it was
always part of the application — not the newest or most fashionable technology.

This is a small project-adaptation skill. Its process footprint is proportional
to the change.

## Source-priority hierarchy

When two sources disagree, the higher one wins:

1. Explicit user requirements
2. Existing project design system
3. Existing project components / patterns
4. Existing project dependencies / framework capabilities
5. These reference files (`docs/skills/ui-ux/**`)
6. General UI/UX best practices
7. External research (context7 / web) — exceptional, not a routine step

Existing project conventions are the default authority. They are overridden only
by an explicit user requirement or a demonstrable usability/accessibility defect.

## Change size

Classify the request before doing the work:

| Class | Covers | Process |
| --- | --- | --- |
| **Targeted fix** | An obvious defect; an accessibility correction; a small consistency correction; a localized form/interaction improvement. | Reconnaissance scoped to the surface, a one-or-two-sentence rationale in the report, then implement. No standalone design artifact. |
| **Substantial UI change** | Multiple components; a new interaction pattern; layout restructuring; a visual redesign; a new page or flow. | Reconnaissance plus an explicit design direction, stated before implementation. |

When unsure, treat it as a targeted fix and say so; escalate if reconnaissance
shows the change is larger than it looked.

## The six phases

1. **Discover** — framework, styling, component system, forms, validation, i18n,
   theming, responsive strategy, testing/verification — from actual repository
   usage, not `package.json` alone. See `docs/skills/ui-ux/reconnaissance.md`.
2. **Understand** — read neighboring screens; write a short summary of the app's
   existing visual language. See `docs/skills/ui-ux/reconnaissance.md`.
3. **Design** — a project-aware design direction (explicit for a substantial
   change; a short rationale for a targeted fix). See
   `docs/skills/ui-ux/design-direction.md`.
4. **Adapt** — map the direction onto the project's existing architecture and
   conventions.
5. **Implement** — reuse existing components, utilities, packages, and framework
   capabilities. See `docs/skills/ui-ux/forms.md`,
   `docs/skills/ui-ux/accessibility.md`,
   `docs/skills/ui-ux/visual-consistency.md`,
   `docs/skills/ui-ux/internationalization.md`.
6. **Verify** — run the project's own checks; do a final UX review. See
   `docs/skills/ui-ux/verification.md`.

## Severity rubric

Never work a lower tier while a higher-tier defect on the same surface is open.

| Severity | Examples |
| --- | --- |
| **CRITICAL** | Broken behavior; keyboard traps; missing/incorrect form labels; insufficient contrast for text or essential UI states per the applicable accessibility standard; controls not reachable or operable by keyboard/AT; touch targets that violate the project's established minimum, or — where it has none — are too small for reliable touch use per current platform/accessibility guidance for that control. |
| **HIGH** | Responsive breakage at a supported width; missing error / loading / empty states; poor form UX (no inline validation, error placement, recovery); broken focus management on route/modal changes; i18n violations (hard-coded strings; layouts that only fit English). |
| **MEDIUM** | Inconsistency with the app's own spacing / typography / color / motion; weak visual hierarchy; missing micro-interactions where the app uses them elsewhere. |
| **LOW** | Decorative polish; optional effects; trend-driven changes with no product/user justification. |

## Pre-delivery checklist

- Requirements met
- Scope stayed on the requested surface — no unrelated screens restyled
- No business logic, validation semantics, API contracts, or navigation/redirect/error behavior changed for polish alone
- Existing components reused; no unjustified dependencies
- Responsive per the project's own breakpoints
- Keyboard + focus + screen-reader usable
- Error / loading / empty states present
- i18n respected (every new user-facing string localized)
- Dark mode / theme conventions respected
- Existing design language preserved
- The project's own typecheck / lint / tests / build are green

## References

- `docs/skills/ui-ux/reconnaissance.md`
- `docs/skills/ui-ux/design-direction.md`
- `docs/skills/ui-ux/accessibility.md`
- `docs/skills/ui-ux/forms.md`
- `docs/skills/ui-ux/internationalization.md`
- `docs/skills/ui-ux/visual-consistency.md`
- `docs/skills/ui-ux/verification.md`
