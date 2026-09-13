# Forms

**Reuse the project's existing form and validation libraries.** If it uses React
Hook Form + Zod, keep React Hook Form + Zod. Do not introduce Formik, Yup,
Valibot, Joi, or a second form/validation system.

Check, on any form touched:

- Field labels visible (not placeholder-only); required/optional indicated
  consistently with the app.
- Inline validation with sensible timing (validate on blur / submit, re-validate
  on change once a field has errored — match the app's existing behavior).
- Error text next to its field; a summary region for form-level and server errors.
- Error recovery: the user's input is preserved; focus moves to the first error.
- Submit button shows a loading state and is protected against double-submit.
- Server errors and network errors are surfaced distinctly and are actionable.
- Password fields: a show/hide toggle if the app uses one elsewhere; correct
  `autocomplete` (`username`, `current-password`, `new-password`, `email`).
- Full keyboard operability; logical tab order.
- Works at mobile width and with a soft keyboard open.
- Every message (label, hint, error, success) goes through the i18n system if one
  exists.
