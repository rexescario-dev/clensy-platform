// Jobs-owned default template (spec §4.1). `CreateJobFromBooking` always
// materializes these three items, in this order. Tests import this const
// rather than duplicating the strings.
export const DEFAULT_CHECKLIST_ITEMS: ReadonlyArray<{
  position: number;
  label: string;
}> = [
  { label: 'Arrive on site', position: 0 },
  { label: 'Complete assigned work', position: 1 },
  { label: 'Final walkthrough', position: 2 },
];
