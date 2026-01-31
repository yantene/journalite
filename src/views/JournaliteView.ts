import { ItemView, WorkspaceLeaf, TFile, MarkdownView, Menu } from "obsidian";
import { CalendarComponent } from "../components/CalendarComponent";
import { TaskListComponent } from "../components/TaskListComponent";
import { DailyNoteService } from "../services/DailyNoteService";
import { TaskService } from "../services/TaskService";
import { formatDate } from "../utils/dateUtils";
import type JournalitePlugin from "../../main";

export const VIEW_TYPE_JOURNALITE = "journalite-view";

export class JournaliteView extends ItemView {
  private plugin: JournalitePlugin;
  private dailyNoteService: DailyNoteService;
  private taskService: TaskService;
  private calendarComponent: CalendarComponent | null = null;
  private taskListComponent: TaskListComponent | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: JournalitePlugin) {
    super(leaf);
    this.plugin = plugin;
    this.dailyNoteService = new DailyNoteService(this.app);
    this.taskService = new TaskService(this.app);
  }

  getViewType(): string {
    return VIEW_TYPE_JOURNALITE;
  }

  getDisplayText(): string {
    return "Journalite";
  }

  getIcon(): string {
    return "calendar-clock";
  }

  async onOpen(): Promise<void> {
    await this.render();
  }

  async onClose(): Promise<void> {
    // Cleanup
  }

  refresh(): void {
    this.render();
  }

  private async render(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("journalite-container");

    // Calendar section
    const calendarEl = container.createDiv("journalite-calendar-section");
    const existingDates = this.dailyNoteService.getExistingDates();
    const prevYear = this.calendarComponent?.getYear();
    const prevMonth = this.calendarComponent?.getMonth();
    this.calendarComponent = new CalendarComponent(
      calendarEl,
      existingDates,
      (date) => this.handleDateClick(date),
      (date, event) => this.handleDateContextMenu(date, event),
      prevYear,
      prevMonth
    );
    this.calendarComponent.render();

    // Task list section
    const tasksEl = container.createDiv("journalite-tasks-section");
    this.taskListComponent = new TaskListComponent(
      tasksEl,
      (file, line) => this.handleTaskClick(file, line),
      (file, line) => this.handleDailyTaskToggle(file, line),
      (file) => this.handleTaskItemToggle(file)
    );

    // Fetch and display task data
    const tasks = await this.taskService.getTasksByCategory();
    this.taskListComponent.setTasks(tasks);
  }

  private async handleDateClick(date: Date): Promise<void> {
    await this.dailyNoteService.openOrCreate(date);
  }

  private async handleTaskClick(file: TFile, line?: number): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);

    if (line !== undefined) {
      // Wait briefly before moving cursor
      setTimeout(() => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view) {
          const editor = view.editor;
          editor.setCursor({ line, ch: 0 });
          editor.scrollIntoView(
            { from: { line, ch: 0 }, to: { line, ch: 0 } },
            true
          );
          editor.focus();
        }
      }, 100);
    }
  }

  private async handleDailyTaskToggle(file: TFile, line: number): Promise<void> {
    const content = await this.app.vault.read(file);
    const lines = content.split("\n");

    if (line < 0 || line >= lines.length) return;

    const lineText = lines[line];
    // Convert `- [ ]` to `- [x]`
    const newLineText = lineText.replace(/^(\s*-\s*)\[ \]/, "$1[x]");

    if (newLineText === lineText) return; // Skip if no change

    lines[line] = newLineText;
    await this.app.vault.modify(file, lines.join("\n"));
    // View is auto-refreshed by vault.on("modify") event
  }

  private async handleTaskItemToggle(file: TFile): Promise<void> {
    const content = await this.app.vault.read(file);

    // Change frontmatter completed to true
    const newContent = content.replace(
      /^(---\s*\n[\s\S]*?)(completed:\s*)(false|[\w]+)?(\s*\n[\s\S]*?---)$/m,
      "$1$2true$4"
    );

    // Add completed field if not present
    if (newContent === content && !content.includes("completed:")) {
      const withCompleted = content.replace(
        /^(---\s*\n)/,
        "$1completed: true\n"
      );
      await this.app.vault.modify(file, withCompleted);
    } else {
      await this.app.vault.modify(file, newContent);
    }
    // View is auto-refreshed by vault.on("modify") event
  }

  private handleDateContextMenu(date: Date, event: MouseEvent): void {
    const menu = new Menu();
    const dateStr = formatDate(date);

    menu.addItem((item) => {
      item
        .setTitle("Open daily note")
        .setIcon("calendar")
        .onClick(() => {
          this.dailyNoteService.openOrCreate(date);
        });
    });

    menu.addItem((item) => {
      item
        .setTitle("Create task due on this date")
        .setIcon("alarm-clock")
        .onClick(() => {
          this.createTask(dateStr, "dueDate");
        });
    });

    menu.addItem((item) => {
      item
        .setTitle("Create task starting on this date")
        .setIcon("play")
        .onClick(() => {
          this.createTask(dateStr, "startDate");
        });
    });

    menu.showAtMouseEvent(event);
  }

  private getTemplatesFolder(): string {
    const internalPlugins = (this.app as any).internalPlugins;
    const templatesPlugin = internalPlugins?.getPluginById?.("templates");
    return templatesPlugin?.instance?.options?.folder || "";
  }

  private getTaskTemplatePath(): string {
    const { taskTemplateMode, taskTemplatePath } = this.plugin.settings;
    if (taskTemplateMode === "custom" && taskTemplatePath) {
      return taskTemplatePath;
    }
    const templatesFolder = this.getTemplatesFolder();
    return templatesFolder ? `${templatesFolder}/task.md` : "task.md";
  }

  private async createTask(dateStr: string, dateType: "startDate" | "dueDate"): Promise<void> {
    const tasksFolder = this.plugin.settings.tasksFolder;
    const templatePath = this.getTaskTemplatePath();

    // Create tasks folder if it doesn't exist
    if (!this.app.vault.getAbstractFileByPath(tasksFolder)) {
      await this.app.vault.createFolder(tasksFolder);
    }

    // Load template
    const templateFile = this.app.vault.getAbstractFileByPath(templatePath) as TFile | null;
    let content: string;

    if (templateFile) {
      content = await this.app.vault.read(templateFile);
    } else {
      // Default content when no template exists
      content = `---
type: task
tags: []
startDate:
dueDate:
completed: false
---
## Context
## Goals
## Journal
## Thoughts
- `;
    }

    // Set date
    if (dateType === "startDate") {
      content = content.replace(/^(startDate:).*$/m, `$1 ${dateStr}`);
    } else {
      content = content.replace(/^(dueDate:).*$/m, `$1 ${dateStr}`);
    }

    // Generate unique filename (same as Obsidian default)
    const locale = (this.app as any).vault?.getConfig?.("locale") || localStorage.getItem("language") || "en";
    const untitled = locale === "ja" ? "無題のファイル" : "Untitled";
    let filePath = `${tasksFolder}/${untitled}.md`;
    let counter = 1;
    while (this.app.vault.getAbstractFileByPath(filePath)) {
      filePath = `${tasksFolder}/${untitled} ${counter}.md`;
      counter++;
    }

    // Create file
    const file = await this.app.vault.create(filePath, content);

    // Open file
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
  }
}
