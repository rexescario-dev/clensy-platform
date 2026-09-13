# Internationalization

If the project supports more than one language, every new user-facing string
follows the existing localization architecture — labels, buttons, descriptions,
validation errors, success and empty states, accessibility labels, tooltips. Do
not hard-code English into a localized app.

Design for text that is not English-length:

- Labels and validation messages can be ~30-50% longer in other languages; let
  them wrap rather than truncate or overflow.
- Buttons size to content; avoid fixed-width buttons that fit only English.
- Navigation and tab bars can grow; check they still work.
- Support RTL where the project does (logical properties, `dir`-aware layout,
  mirrored icons).
- Dates, numbers, currency, and lists use the project's locale-aware formatters.
- Never assemble a sentence from concatenated translated fragments — use a single
  parameterized message.

If no i18n system exists, keep new strings together and consistent with how the
project currently holds copy; do not add an i18n framework for one screen.
