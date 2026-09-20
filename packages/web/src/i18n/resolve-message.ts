// The one piece of override-vs-default resolution LoginForm and
// BookingDataTable both need. Kept as a pure function so it's testable
// without rendering — neither component's error display is otherwise
// exercisable without interaction simulation, which this repository does
// not use (see login-form's own lack of a test file).
export function resolveMessage(override: string | undefined, fallback: string): string {
  return override ?? fallback;
}
