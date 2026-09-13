# Design direction

A design direction says how the change will look and behave, expressed **relative
to what the project already does**.

## When to state one explicitly

- **Substantial change** (multiple components, new interaction pattern, layout
  restructuring, visual redesign, new page/flow): write the direction and surface
  it before implementing.
- **Targeted fix**: the "direction" is one or two sentences of rationale in the
  final report. Do not produce a mini design document to change a button.

## What it covers

Visual direction · typography · color usage · spacing · component treatment ·
interaction patterns · responsive behavior · accessibility requirements — each
stated as "consistent with «what the app does in X»" or "differs from «X» because
«requirement / defect»".

## The formula

```
existing design system  +  UI/UX methodology  +  product requirements
        =  improved, project-specific design
```

## Preserve vs. redesign

Existing design decisions are preserved unless the user explicitly asked for a
redesign, or the existing implementation is a genuine UX/accessibility defect. Do
not generate a generic SaaS design system when the project already has one. Do
not restyle screens outside the requested surface.
