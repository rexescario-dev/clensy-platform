# Visual consistency

Adopt the project's existing visual language rather than importing one.

- Spacing: use the project's spacing scale / tokens; match the rhythm of
  neighboring screens.
- Typography: use the project's type scale, weights, and line-heights.
- Color: use existing tokens / theme variables; do not introduce new raw colors.
- Radius, borders, shadows, elevation: reuse the project's values.
- Motion: match existing durations, easing, and where the app does/doesn't
  animate; respect `prefers-reduced-motion`.
- Breakpoints: use the project's configured breakpoints — do not invent new ones.
- Icons: use the project's existing icon set. Prefer an SVG icon set over emoji
  for UI affordances, but the project's established choice wins.
- Visual hierarchy, alignment, and rhythm consistent with sibling screens.

Keep changes on the requested surface and its directly-affected shared
components. Do not opportunistically restyle unrelated screens.
