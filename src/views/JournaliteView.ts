import { ItemView, WorkspaceLeaf, TFile, MarkdownView, Menu } from "obsidian";
import { CalendarComponent } from "../components/CalendarComponent";
import { TaskListComponent } from "../components/TaskListComponent";
import { DailyNoteService } from "../services/DailyNoteService";
import { TaskService } from "../services/TaskService";

export const VIEW_TYPE_JOURNALITE = "journalite-view";

export class JournaliteView extends ItemView {
  private dailyNoteService: DailyNoteService;
  private taskService: TaskService;
  private calendarComponent: CalendarComponent | null = null;
  private taskListComponent: TaskListComponent | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    this.dailyNoteService = new DailyNoteService(this.app);
    this.taskService = new TaskService(this.app, this.dailyNoteService);
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
      (file, line) => this.handleTaskItemToggle(file, line),
      (file) => this.handleTaskNoteToggle(file),
      (file) => this.dailyNoteService.isDailyNote(file)
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

  /** Toggle task item (checkbox) completion */
  private async handleTaskItemToggle(file: TFile, line: number): Promise<void> {
    const content = await this.app.vault.read(file);
    const lines = content.split("\n");

    if (line < 0 || line >= lines.length) return;

    const lineText = lines[line];
    // Convert `- [ ]` to `- [x]`
    const newLineText = lineText.replace(/^(\s*-\s*)\[ \]/, "$1[x]");

    if (newLineText === lineText) return;

    lines[line] = newLineText;
    await this.app.vault.modify(file, lines.join("\n"));
  }

  /** Toggle task note done status */
  private async handleTaskNoteToggle(file: TFile): Promise<void> {
    const content = await this.app.vault.read(file);

    // Change frontmatter done to true
    const newContent = content.replace(
      /^(---\s*\n[\s\S]*?)(done:\s*)(false|[\w]+)?(\s*\n[\s\S]*?---)$/m,
      "$1$2true$4"
    );

    if (newContent !== content) {
      await this.app.vault.modify(file, newContent);
    }
  }

  private handleDateContextMenu(date: Date, event: MouseEvent): void {
    const menu = new Menu();

    menu.addItem((item) => {
      item
        .setTitle("Open daily note")
        .setIcon("calendar")
        .onClick(() => {
          this.dailyNoteService.openOrCreate(date);
        });
    });

    menu.showAtMouseEvent(event);
  }
}
