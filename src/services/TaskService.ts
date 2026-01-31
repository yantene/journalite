import type { App, TFile, CachedMetadata } from "obsidian";
import type { TaskItem, DailyTask, DailyNote, TasksByCategory } from "../types";
import { formatDate, addDays, getTodayStr } from "../utils/dateUtils";

export class TaskService {
  constructor(private app: App) {}

  /** Get Obsidian templates folder */
  private getTemplatesFolder(): string {
    const internalPlugins = (this.app as any).internalPlugins;
    const templatesPlugin = internalPlugins?.getPluginById?.("templates");
    return templatesPlugin?.instance?.options?.folder || "";
  }

  /** Check if file is a template */
  private isTemplateFile(file: TFile): boolean {
    const templatesFolder = this.getTemplatesFolder();
    if (!templatesFolder) return false;
    return file.path.startsWith(templatesFolder + "/") || file.path === templatesFolder;
  }

  /** Get all task pages (identified by type: task) */
  getAllTaskItems(): TaskItem[] {
    const items: TaskItem[] = [];
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      if (this.isTemplateFile(file)) continue;

      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache?.frontmatter) continue;
      if (cache.frontmatter.type !== "task") continue;

      const fm = cache.frontmatter;
      items.push({
        file,
        name: file.basename,
        startDate: this.normalizeDate(fm.startDate),
        dueDate: this.normalizeDate(fm.dueDate),
        completed: fm.completed === true,
      });
    }

    return items;
  }

  /** Get all daily notes (identified by type: daily, date from filename) */
  async getAllDailyNotes(): Promise<DailyNote[]> {
    const notes: DailyNote[] = [];
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      if (this.isTemplateFile(file)) continue;

      // Extract date from filename (YYYY-MM-DD.md format)
      const match = file.name.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
      if (!match) continue;

      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache?.frontmatter) continue;
      if (cache.frontmatter.type !== "daily") continue;

      const tasks = await this.extractTasks(file, cache);
      if (tasks.length > 0) {
        notes.push({
          file,
          date: match[1],
          tasks,
        });
      }
    }

    return notes;
  }

  /** Strip markdown syntax to plain text */
  private stripMarkdown(text: string): string {
    return text
      // Wikilinks: [[link|display]] -> display, [[link]] -> link
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      // Markdown links: [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Bold: **text** or __text__ -> text
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      // Italic: *text* or _text_ -> text
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      // Strikethrough: ~~text~~ -> text
      .replace(/~~([^~]+)~~/g, "$1")
      // Highlight: ==text== -> text
      .replace(/==([^=]+)==/g, "$1")
      // Inline code: `code` -> code
      .replace(/`([^`]+)`/g, "$1")
      // Tags: #tag -> tag
      .replace(/#(\S+)/g, "$1");
  }

  /** Extract tasks from cache (also reads file for task text) */
  private async extractTasks(file: TFile, cache: CachedMetadata): Promise<DailyTask[]> {
    const tasks: DailyTask[] = [];

    if (!cache.listItems) return tasks;

    // Check for incomplete tasks first
    const incompleteTasks = cache.listItems.filter(
      (item) => item.task === " "
    );
    if (incompleteTasks.length === 0) return tasks;

    // Read file content to get task text
    const content = await this.app.vault.cachedRead(file);
    const lines = content.split("\n");

    for (const item of incompleteTasks) {
      const lineNum = item.position.start.line;
      const lineText = lines[lineNum] || "";
      // Extract task text (remove "- [ ] " prefix)
      const rawText = lineText.replace(/^[\s]*-\s*\[.\]\s*/, "").trim();
      const text = this.stripMarkdown(rawText);

      tasks.push({
        text,
        completed: false,
        line: lineNum,
      });
    }

    return tasks;
  }

  /** Today check: whether task is active on the given date */
  isTaskActiveOnDate(task: TaskItem, dateStr: string): boolean {
    if (task.completed) return false;

    const { startDate, dueDate } = task;

    if (!startDate && !dueDate) return false;

    // startDate only: active from startDate onwards
    if (startDate && !dueDate) {
      return dateStr >= startDate;
    }

    // dueDate only: active every day until dueDate
    if (!startDate && dueDate) {
      return dateStr <= dueDate;
    }

    // both: within range
    return dateStr >= startDate! && dateStr <= dueDate!;
  }

  /** Overdue/Upcoming check: whether startDate or dueDate matches the given date */
  shouldShowTaskOnDate(task: TaskItem, dateStr: string): boolean {
    if (task.completed) return false;

    const { startDate, dueDate } = task;

    if (!startDate && !dueDate) return false;

    if (dueDate && dateStr === dueDate) return true;
    if (startDate && dateStr === startDate) return true;

    return false;
  }

  /** Get tasks by category */
  async getTasksByCategory(): Promise<TasksByCategory> {
    const todayStr = getTodayStr();
    const today = new Date();
    const weekLater = formatDate(addDays(today, 14));

    const allTasks = this.getAllTaskItems();
    const allDailyNotes = await this.getAllDailyNotes();

    const overdue = new Map<string, { dailyTasks: DailyTask[]; taskItems: TaskItem[]; dailyFile?: TFile }>();
    const todayData: { dailyTasks: DailyTask[]; taskItems: TaskItem[]; dailyFile?: TFile } = {
      dailyTasks: [],
      taskItems: [],
    };
    const upcoming = new Map<string, { dailyTasks: DailyTask[]; taskItems: TaskItem[]; dailyFile?: TFile }>();
    const noSchedule: TaskItem[] = [];

    // Collect dates for categorization
    const overdueDates = new Set<string>();
    const upcomingDates = new Set<string>();

    // Overdue daily notes
    for (const note of allDailyNotes) {
      if (note.date < todayStr && note.tasks.length > 0) {
        overdueDates.add(note.date);
      }
    }

    // Overdue task items (dueDate < today)
    for (const task of allTasks) {
      if (task.completed) continue;
      if (task.dueDate && task.dueDate < todayStr) {
        overdueDates.add(task.dueDate);
        if (task.startDate && task.startDate < todayStr && task.startDate !== task.dueDate) {
          overdueDates.add(task.startDate);
        }
      }
    }

    // Upcoming daily notes
    for (const note of allDailyNotes) {
      if (note.date > todayStr && note.date <= weekLater && note.tasks.length > 0) {
        upcomingDates.add(note.date);
      }
    }

    // Upcoming task items
    for (const task of allTasks) {
      if (task.completed) continue;
      if (task.dueDate && task.dueDate > todayStr && task.dueDate <= weekLater) {
        upcomingDates.add(task.dueDate);
      }
      if (task.startDate && task.startDate > todayStr && task.startDate <= weekLater) {
        if (task.startDate !== task.dueDate) {
          upcomingDates.add(task.startDate);
        }
      }
    }

    // Build overdue data
    const sortedOverdue = Array.from(overdueDates).sort();
    for (const dateStr of sortedOverdue) {
      const data = this.getTasksForDate(dateStr, allDailyNotes, allTasks);
      if (data.dailyTasks.length > 0 || data.taskItems.length > 0) {
        overdue.set(dateStr, data);
      }
    }

    // Build today data
    const todayNote = allDailyNotes.find((n) => n.date === todayStr);
    if (todayNote) {
      todayData.dailyTasks = todayNote.tasks;
      todayData.dailyFile = todayNote.file;
    }
    for (const task of allTasks) {
      if (this.isTaskActiveOnDate(task, todayStr)) {
        todayData.taskItems.push(task);
      }
    }

    // Build upcoming data
    const sortedUpcoming = Array.from(upcomingDates).sort();
    for (const dateStr of sortedUpcoming) {
      const data = this.getTasksForDate(dateStr, allDailyNotes, allTasks);
      if (data.dailyTasks.length > 0 || data.taskItems.length > 0) {
        upcoming.set(dateStr, data);
      }
    }

    // No Schedule
    for (const task of allTasks) {
      if (!task.completed && !task.startDate && !task.dueDate) {
        noSchedule.push(task);
      }
    }

    return { overdue, today: todayData, upcoming, noSchedule };
  }

  /** Get tasks for a specific date (for Overdue/Upcoming: matches startDate/dueDate) */
  private getTasksForDate(
    dateStr: string,
    allDailyNotes: DailyNote[],
    allTasks: TaskItem[]
  ): { dailyTasks: DailyTask[]; taskItems: TaskItem[]; dailyFile?: TFile } {
    const dailyNote = allDailyNotes.find((n) => n.date === dateStr);
    const dailyTasks = dailyNote?.tasks ?? [];
    const taskItems: TaskItem[] = [];

    for (const task of allTasks) {
      if (this.shouldShowTaskOnDate(task, dateStr)) {
        taskItems.push(task);
      }
    }

    return { dailyTasks, taskItems, dailyFile: dailyNote?.file };
  }

  /** Normalize date string */
  private normalizeDate(value: unknown): string | null {
    if (!value) return null;

    if (typeof value === "string") {
      // Handle ISO format and YYYY-MM-DD format
      const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) return match[1];
    }

    // Date-like object (Obsidian internal format)
    if (typeof value === "object" && value !== null) {
      const obj = value as Record<string, unknown>;
      if (typeof obj.year === "number" && typeof obj.month === "number" && typeof obj.day === "number") {
        const year = obj.year;
        const month = String(obj.month).padStart(2, "0");
        const day = String(obj.day).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    }

    return null;
  }
}
