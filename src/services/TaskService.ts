import type { App, TFile, CachedMetadata } from "obsidian";
import type { TaskNote, TaskItem, DailyNote, TasksByCategory } from "../types";
import { formatDate, addDays, getTodayStr } from "../utils/dateUtils";
import { extractDatesFromText, isActiveOnDate } from "../utils/datePatterns";
import type { DailyNoteService } from "./DailyNoteService";

export class TaskService {
  constructor(private app: App, private dailyNoteService: DailyNoteService) {}

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

  /** Check if file is a daily note */
  private isDailyNote(file: TFile): boolean {
    return this.dailyNoteService.isDailyNote(file);
  }

  /** Get all task notes (notes with `done` in frontmatter, excluding daily notes) */
  getAllTaskNotes(): TaskNote[] {
    const notes: TaskNote[] = [];
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      if (this.isTemplateFile(file)) continue;
      if (this.isDailyNote(file)) continue;

      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache?.frontmatter) continue;

      const fm = cache.frontmatter;
      // Task note must have `done` field in frontmatter
      if (fm.done === undefined) continue;

      notes.push({
        file,
        name: file.basename,
        startDate: this.normalizeDate(fm.startDate),
        dueDate: this.normalizeDate(fm.dueDate),
        done: fm.done === true,
      });
    }

    return notes;
  }

  /** Get all daily notes (identified by YYYY-MM-DD.md filename) */
  async getAllDailyNotes(): Promise<DailyNote[]> {
    const notes: DailyNote[] = [];
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      if (this.isTemplateFile(file)) continue;

      const date = this.dailyNoteService.parseDailyNoteDate(file);
      if (!date) continue;

      const cache = this.app.metadataCache.getFileCache(file);
      const taskItems = await this.extractTaskItems(file, cache ?? undefined);
      notes.push({
        file,
        date,
        taskItems,
      });
    }

    return notes;
  }

  /** Get all task items with dates from all notes (excluding daily notes) */
  async getAllTaskItems(): Promise<TaskItem[]> {
    const items: TaskItem[] = [];
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      if (this.isTemplateFile(file)) continue;
      if (this.isDailyNote(file)) continue;

      const cache = this.app.metadataCache.getFileCache(file);
      if (!cache?.listItems) continue;

      const incompleteTasks = cache.listItems.filter((item) => item.task === " ");
      if (incompleteTasks.length === 0) continue;

      const content = await this.app.vault.cachedRead(file);
      const lines = content.split("\n");

      // Build line -> list item map for parent lookup
      const lineToItem = new Map<number, typeof cache.listItems[0]>();
      for (const listItem of cache.listItems) {
        lineToItem.set(listItem.position.start.line, listItem);
      }

      for (const item of incompleteTasks) {
        const lineNum = item.position.start.line;
        const lineText = lines[lineNum] || "";
        const rawText = lineText.replace(/^[\s]*-\s*\[.\]\s*/, "").trim();

        const { text: textWithoutDate, startDate, dueDate } = extractDatesFromText(rawText);

        // Only include items with at least one date
        if (!startDate && !dueDate) continue;

        const text = this.stripMarkdown(textWithoutDate);
        const breadcrumbs = this.buildBreadcrumbs(item, lineToItem, lines);

        items.push({
          text,
          line: lineNum,
          startDate,
          dueDate,
          file,
          breadcrumbs,
        });
      }
    }

    return items;
  }

  /** Strip markdown syntax to plain text */
  private stripMarkdown(text: string): string {
    return text
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      .replace(/~~([^~]+)~~/g, "$1")
      .replace(/==([^=]+)==/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/#(\S+)/g, "$1");
  }

  /** Extract task items from a file */
  private async extractTaskItems(file: TFile, cache?: CachedMetadata): Promise<TaskItem[]> {
    const items: TaskItem[] = [];

    if (!cache?.listItems) return items;

    const incompleteTasks = cache.listItems.filter((item) => item.task === " ");
    if (incompleteTasks.length === 0) return items;

    const content = await this.app.vault.cachedRead(file);
    const lines = content.split("\n");

    // Build line -> list item map for parent lookup
    const lineToItem = new Map<number, typeof cache.listItems[0]>();
    for (const item of cache.listItems) {
      lineToItem.set(item.position.start.line, item);
    }

    for (const item of incompleteTasks) {
      const lineNum = item.position.start.line;
      const lineText = lines[lineNum] || "";
      const rawText = lineText.replace(/^[\s]*-\s*\[.\]\s*/, "").trim();

      const { text: textWithoutDate, startDate, dueDate } = extractDatesFromText(rawText);
      const text = this.stripMarkdown(textWithoutDate);

      // Build breadcrumbs from parent chain
      const breadcrumbs = this.buildBreadcrumbs(item, lineToItem, lines);

      items.push({
        text,
        line: lineNum,
        startDate,
        dueDate,
        file,
        breadcrumbs,
      });
    }

    return items;
  }

  /** Build breadcrumbs from parent chain */
  private buildBreadcrumbs(
    item: { parent: number },
    lineToItem: Map<number, { parent: number; position: { start: { line: number } } }>,
    lines: string[]
  ): string[] {
    const breadcrumbs: string[] = [];
    let parentLine = item.parent;

    while (parentLine >= 0) {
      const parentItem = lineToItem.get(parentLine);
      if (!parentItem) break;

      const parentText = lines[parentLine] || "";
      const rawText = parentText.replace(/^[\s]*-\s*(\[.\]\s*)?/, "").trim();
      const { text: textWithoutDate } = extractDatesFromText(rawText);
      const text = this.stripMarkdown(textWithoutDate);

      if (text) {
        breadcrumbs.unshift(text);
      }

      parentLine = parentItem.parent;
    }

    return breadcrumbs;
  }

  /** Check if task note is active on the given date */
  isTaskNoteActiveOnDate(note: TaskNote, dateStr: string): boolean {
    if (note.done) return false;
    return isActiveOnDate(note, dateStr);
  }

  /** Check if task note should show on the given date (matches startDate/dueDate) */
  shouldShowTaskNoteOnDate(note: TaskNote, dateStr: string): boolean {
    if (note.done) return false;

    const { startDate, dueDate } = note;
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

    const allTaskNotes = this.getAllTaskNotes();
    const allDailyNotes = await this.getAllDailyNotes();
    const allTaskItems = await this.getAllTaskItems();

    const overdue = new Map<string, { taskItems: TaskItem[]; taskNotes: TaskNote[] }>();
    const todayData: { taskItems: TaskItem[]; taskNotes: TaskNote[] } = {
      taskItems: [],
      taskNotes: [],
    };
    const upcoming = new Map<string, { taskItems: TaskItem[]; taskNotes: TaskNote[] }>();
    const noSchedule: TaskNote[] = [];

    const overdueDates = new Set<string>();
    const upcomingDates = new Set<string>();

    // Collect overdue dates from daily notes
    for (const note of allDailyNotes) {
      if (note.date < todayStr && note.taskItems.length > 0) {
        overdueDates.add(note.date);
      }
    }

    // Collect overdue dates from task notes
    for (const note of allTaskNotes) {
      if (note.done) continue;
      if (note.dueDate && note.dueDate < todayStr) {
        overdueDates.add(note.dueDate);
      }
    }

    // Collect overdue dates from task items
    for (const item of allTaskItems) {
      if (item.dueDate && item.dueDate < todayStr) {
        overdueDates.add(item.dueDate);
      }
    }

    // Collect upcoming dates from daily notes
    for (const note of allDailyNotes) {
      if (note.date > todayStr && note.date <= weekLater && note.taskItems.length > 0) {
        upcomingDates.add(note.date);
      }
    }

    // Collect upcoming dates from task notes
    for (const note of allTaskNotes) {
      if (note.done) continue;
      if (note.dueDate && note.dueDate > todayStr && note.dueDate <= weekLater) {
        upcomingDates.add(note.dueDate);
      }
      if (note.startDate && note.startDate > todayStr && note.startDate <= weekLater) {
        upcomingDates.add(note.startDate);
      }
    }

    // Collect upcoming dates from task items
    for (const item of allTaskItems) {
      if (item.dueDate && item.dueDate > todayStr && item.dueDate <= weekLater) {
        upcomingDates.add(item.dueDate);
      }
      if (item.startDate && item.startDate > todayStr && item.startDate <= weekLater) {
        upcomingDates.add(item.startDate);
      }
    }

    // Build overdue data
    for (const dateStr of Array.from(overdueDates).sort()) {
      const data = this.getTasksForDate(dateStr, allDailyNotes, allTaskNotes, allTaskItems);
      if (data.taskItems.length > 0 || data.taskNotes.length > 0) {
        overdue.set(dateStr, data);
      }
    }

    // Build today data
    const todayNote = allDailyNotes.find((n) => n.date === todayStr);
    if (todayNote) {
      todayData.taskItems.push(...todayNote.taskItems);
    }
    for (const note of allTaskNotes) {
      if (this.isTaskNoteActiveOnDate(note, todayStr)) {
        todayData.taskNotes.push(note);
      }
    }
    for (const item of allTaskItems) {
      if (isActiveOnDate(item, todayStr)) {
        todayData.taskItems.push(item);
      }
    }

    // Build upcoming data
    for (const dateStr of Array.from(upcomingDates).sort()) {
      const data = this.getTasksForDate(dateStr, allDailyNotes, allTaskNotes, allTaskItems);
      if (data.taskItems.length > 0 || data.taskNotes.length > 0) {
        upcoming.set(dateStr, data);
      }
    }

    // Build no schedule (task notes without dates)
    for (const note of allTaskNotes) {
      if (!note.done && !note.startDate && !note.dueDate) {
        noSchedule.push(note);
      }
    }

    return { overdue, today: todayData, upcoming, noSchedule };
  }

  /** Get tasks for a specific date */
  private getTasksForDate(
    dateStr: string,
    allDailyNotes: DailyNote[],
    allTaskNotes: TaskNote[],
    allTaskItems: TaskItem[]
  ): { taskItems: TaskItem[]; taskNotes: TaskNote[] } {
    const dailyNote = allDailyNotes.find((n) => n.date === dateStr);
    const taskItems: TaskItem[] = dailyNote?.taskItems ? [...dailyNote.taskItems] : [];
    const taskNotes: TaskNote[] = [];

    for (const note of allTaskNotes) {
      if (this.shouldShowTaskNoteOnDate(note, dateStr)) {
        taskNotes.push(note);
      }
    }

    for (const item of allTaskItems) {
      if (item.dueDate === dateStr || item.startDate === dateStr) {
        taskItems.push(item);
      }
    }

    return { taskItems, taskNotes };
  }

  /** Normalize date string */
  private normalizeDate(value: unknown): string | null {
    if (!value) return null;

    if (typeof value === "string") {
      const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) return match[1];
    }

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
