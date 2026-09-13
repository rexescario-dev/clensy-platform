# Verification

Use the project's own mechanisms — do not assume universal commands.

1. **Find the commands.** Read `package.json` scripts, the CI workflow, a
   Makefile, and contributing docs. Identify: typecheck, lint, format check,
   unit / component tests, integration tests, E2E, build.
2. **Run the applicable ones** for the surface changed. For a small UI change
   that is typically typecheck + lint + the relevant test file + build; run E2E
   if an affected spec exists.
3. **Report the actual results.** If something fails, say so with the output. If
   a step was skipped, say which and why.
4. **Final UX review** against: the stated requirements; the existing design
   system; responsive behavior at the project's breakpoints; accessibility
   (`docs/skills/ui-ux/accessibility.md`); localization
   (`docs/skills/ui-ux/internationalization.md`); component consistency; and
   loading / error / empty states.
5. **Report what changed and why**, tied back to the reconnaissance summary and
   (for a substantial change) the design direction. Note explicitly that scope
   stayed on the requested surface and that no behavioral semantics changed for
   polish alone.
