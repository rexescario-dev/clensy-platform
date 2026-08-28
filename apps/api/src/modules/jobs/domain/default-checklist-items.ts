// Jobs-owned default template (spec §4.1). `CreateJobFromBooking` always
// materializes these three items, in this order. Tests import this const
// rather than duplicating the strings.
export const DEFAULT_CHECKLIST_ITEMS: ReadonlyArray<{
  position: number;
  label: string;
}> = [
  { position: 0, label: 'Arrive on site' },
  { position: 1, label: 'Complete assigned work' },
  { position: 2, label: 'Final walkthrough' },
];
