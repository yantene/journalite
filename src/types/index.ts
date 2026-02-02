import type { TFile } from "obsidian";

/** Common interface for items with schedule dates */
export interface Schedulable {
  /** Start date (YYYY-MM-DD) */
  startDate: string | null;
  /** Due date (YYYY-MM-DD) */
  dueDate: string | null;
}

/** Task note: note with `done` in frontmatter */
export interface TaskNote extends Schedulable {
  /** Task file */
  file: TFile;
  /** File name (without extension) */
  name: string;
  /** Done flag */
  done: boolean;
}

/** Task item: checkbox with date pattern at end */
export interface TaskItem extends Schedulable {
  /** Task text */
  text: string;
  /** Line number */
  line: number;
  /** Source file */
  file: TFile;
  /** Parent task texts (for nested items) */
  breadcrumbs: string[];
}

/** Daily note: note with YYYY-MM-DD.md filename */
export interface DailyNote {
  /** File */
  file: TFile;
  /** Date (YYYY-MM-DD) */
  date: string;
  /** Task items in this daily note */
  taskItems: TaskItem[];
}

export interface TasksByCategory {
  overdue: Map<string, { taskItems: TaskItem[]; taskNotes: TaskNote[] }>;
  today: { taskItems: TaskItem[]; taskNotes: TaskNote[] };
  upcoming: Map<string, { taskItems: TaskItem[]; taskNotes: TaskNote[] }>;
  noSchedule: TaskNote[];
}

export type CalendarClickHandler = (date: Date) => void;
export type CalendarContextMenuHandler = (date: Date, event: MouseEvent) => void;
export type TaskClickHandler = (file: TFile, line?: number) => void;
export type TaskItemToggleHandler = (file: TFile, line: number) => void;
export type TaskNoteToggleHandler = (file: TFile) => void;
