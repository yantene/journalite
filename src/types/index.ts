import type { TFile } from "obsidian";

export interface TaskItem {
  /** Task file */
  file: TFile;
  /** File name (without extension) */
  name: string;
  /** Start date (YYYY-MM-DD) */
  startDate: string | null;
  /** Due date (YYYY-MM-DD) */
  dueDate: string | null;
  /** Completed flag */
  completed: boolean;
}

export interface DailyTask {
  /** Task text */
  text: string;
  /** Completed flag */
  completed: boolean;
  /** Line number */
  line: number;
}

export interface DailyNote {
  /** File */
  file: TFile;
  /** Date (YYYY-MM-DD) */
  date: string;
  /** Incomplete tasks */
  tasks: DailyTask[];
}

export interface TasksByCategory {
  overdue: Map<string, { dailyTasks: DailyTask[]; taskItems: TaskItem[]; dailyFile?: TFile }>;
  today: { dailyTasks: DailyTask[]; taskItems: TaskItem[]; dailyFile?: TFile };
  upcoming: Map<string, { dailyTasks: DailyTask[]; taskItems: TaskItem[]; dailyFile?: TFile }>;
  noSchedule: TaskItem[];
}

export type CalendarClickHandler = (date: Date) => void;
export type CalendarContextMenuHandler = (date: Date, event: MouseEvent) => void;
export type TaskClickHandler = (file: TFile, line?: number) => void;
export type DailyTaskToggleHandler = (file: TFile, line: number) => void;
export type TaskItemToggleHandler = (file: TFile) => void;
