# Reconnaissance

Discover how the project already builds UI before changing any of it. Inspect
**actual usage**, not just `package.json` — a dependency line proves a package is
installed, not that it is the project's convention.

## Detect, per concern

| Concern | Where to look | Stronger evidence than a dependency |
| --- | --- | --- |
| Framework | config files (`next.config.*`, `vite.config.*`, `angular.json`, `nuxt.config.*`), entry points, file-system routing | actual route/component files in the framework's idiom |
| Styling | `tailwind.config.*`, `*.module.css`, `styled`/`css` imports, global stylesheet, design-token files, CSS custom properties | `className="..."` utility usage; `cn()` / `tailwind-merge` calls; `styled.*` components in use |
| Component system | `components/ui/*`, a local component index, imported primitives | JSX importing local `Button` / `Input` / `Dialog` etc. across screens |
| Forms | form components, submit handlers, `useForm` / `<Formik>` / server actions | how neighboring forms are actually wired |
| Validation | schema files, resolver wiring, server-side checks | a shared schema imported by both client and server |
| i18n | `messages/*`, `locales/*`, `useTranslations` / `t(` / `<Trans>`, locale routing / middleware | translation calls in neighboring screens |
| Theming | theme provider, `dark:` variants, `data-theme` / `.dark` class, token switch | how the current screen and its neighbors handle dark mode |
| Responsive | breakpoint config, media queries, container queries, responsive utility prefixes | the breakpoints neighboring screens actually use |
| Testing / verification | `package.json` scripts, CI workflow, Makefile, contributing docs | the exact commands CI runs |

## Neighboring-screen analysis

Do not look only at the target. For a target like `/auth/login`, read
`/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, and two or
three representative application screens. Catalog: spacing, typography,
button and input patterns, cards, alerts, validation-message placement,
navigation, page headers, responsive behavior, loading / error / empty states,
animation, icon set, border radius, shadows, color usage, and existing
accessibility patterns (labels, focus handling, ARIA).

## Output

A short written summary of (a) the technical stack and (b) the app's existing
visual language. Every later phase is measured against this summary. Keep it
proportional — a few lines for a targeted fix.
