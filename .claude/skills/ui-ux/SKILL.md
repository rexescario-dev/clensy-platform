---
name: ui-ux
description: >-
  Use when asked to improve, redesign, build, or fix the UI or UX of a page,
  screen, component, or flow in this repository. Adapts the change to the
  project's own framework, styling, components, forms, validation, i18n, and
  theming rather than introducing new UI technology.
---

# Project-adaptive UI/UX

**Before changing any UI code, read `docs/skills/ui-ux/README.md`.** It holds the
full loop, the severity rubric, and the pre-delivery checklist.

## Classify the change first

- **Targeted fix** (obvious defect, accessibility correction, small consistency
  fix, localized form/interaction improvement) → reconnaissance scoped to the
  surface, a short rationale in the report, then implement.
- **Substantial UI change** (multiple components, new interaction pattern, layout
  restructuring, visual redesign, new page/flow) → state an explicit design
  direction before implementing.

Reconnaissance and design-direction output are proportional to the change. No
formal design artifact for a trivial or clearly localized fix.

## Six phases

1. **Discover** — framework, styling, component system, forms, validation, i18n,
   theming, responsive strategy, tests — from actual repo usage, not
   `package.json` alone → `docs/skills/ui-ux/reconnaissance.md`
2. **Understand** — read neighboring screens; summarize the app's visual language
   → `docs/skills/ui-ux/reconnaissance.md`
3. **Design** — a project-aware direction →
   `docs/skills/ui-ux/design-direction.md`
4. **Adapt** — map the direction onto the project's existing architecture.
5. **Implement** — reuse existing components / utilities / packages / framework
   capability → `docs/skills/ui-ux/forms.md`,
   `docs/skills/ui-ux/accessibility.md`,
   `docs/skills/ui-ux/visual-consistency.md`,
   `docs/skills/ui-ux/internationalization.md`
6. **Verify** — the project's own typecheck / lint / tests / build, then a final
   UX review → `docs/skills/ui-ux/verification.md`

## Source-priority hierarchy

1. Explicit user requirements
2. Existing project design system
3. Existing project components / patterns
4. Existing project dependencies / framework capabilities
5. `docs/skills/ui-ux/**`
6. General UI/UX best practices
7. External research (context7 / web) — exceptional, not a routine step

## Hard rules

- Prefer, in order: existing component → existing project utility → existing
  package → existing framework capability → new dependency.
- Do not introduce a new dependency without explicit justification, following the
  project's existing dependency policy when one exists. This is a decision gate.
- If the project has an i18n system, every new user-facing string goes through
  it — labels, buttons, errors, success/empty states, a11y labels, tooltips.
- Follow the project's existing breakpoints, theme conventions, form library, and
  validation library — do not substitute alternatives.
- Run the project's own verification commands; do not assume universal ones.
- Do not redesign what already works unless asked, or unless it is a genuine
  UX/accessibility defect.
- Keep changes on the requested surface and its directly affected shared
  components. Do not opportunistically restyle unrelated screens.
- Change business logic, validation semantics, API contracts, or
  navigation/redirect/error behavior only when the requested UX change requires
  it and that's explicitly part of scope — never as a side effect of polish alone.

## Escalation, not routine interruption

These are decision points to resolve and record in the report — do not pause
the task and interrupt the user for them by default:

- New dependency needed → justify it (per the project's dependency policy)
  and say so in the report.
- Turns out to be a substantial change, not the targeted fix it looked like →
  state the design direction/scope in the report before implementing.
- Ask the user directly only when the requirement genuinely can't be inferred
  from the request, the repo, or the reconnaissance summary.
