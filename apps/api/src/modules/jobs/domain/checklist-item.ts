export interface ChecklistItem {
  id: string;
  checklistId: string;
  label: string;
  position: number;
  completed: boolean;
  completedAt: Date | null;
}
