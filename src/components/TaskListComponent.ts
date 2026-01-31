import type { TFile } from "obsidian";
import type { TasksByCategory, TaskItem, DailyTask, TaskClickHandler, DailyTaskToggleHandler, TaskItemToggleHandler } from "../types";
import { formatDateWithWeekday, formatDateShort, getTodayStr } from "../utils/dateUtils";

export class TaskListComponent {
  private containerEl: HTMLElement;
  private tasks: TasksByCategory | null = null;
  private onTaskClick: TaskClickHandler;
  private onDailyTaskToggle: DailyTaskToggleHandler;
  private onTaskItemToggle: TaskItemToggleHandler;

  constructor(
    containerEl: HTMLElement,
    onTaskClick: TaskClickHandler,
    onDailyTaskToggle: DailyTaskToggleHandler,
    onTaskItemToggle: TaskItemToggleHandler
  ) {
    this.containerEl = containerEl;
    this.onTaskClick = onTaskClick;
    this.onDailyTaskToggle = onDailyTaskToggle;
    this.onTaskItemToggle = onTaskItemToggle;
  }

  render(): void {
    this.containerEl.empty();
    this.containerEl.addClass("journalite-tasks");

    if (!this.tasks) {
      this.containerEl.createEl("p", {
        text: "Loading...",
        cls: "journalite-loading",
      });
      return;
    }

    const { overdue, today, upcoming, noSchedule } = this.tasks;

    // Overdue
    if (overdue.size > 0) {
      this.renderSection("🔴 Overdue", overdue, "overdue");
    }

    // Today
    if (today.dailyTasks.length > 0 || today.taskItems.length > 0) {
      this.renderTodaySection(today);
    }

    // Upcoming
    if (upcoming.size > 0) {
      this.renderSection("🟢 Upcoming", upcoming, "upcoming");
    }

    // No Schedule
    if (noSchedule.length > 0) {
      this.renderNoScheduleSection(noSchedule);
    }

    // When empty
    if (
      overdue.size === 0 &&
      today.dailyTasks.length === 0 &&
      today.taskItems.length === 0 &&
      upcoming.size === 0 &&
      noSchedule.length === 0
    ) {
      this.containerEl.createEl("p", {
        text: "No tasks",
        cls: "journalite-empty",
      });
    }
  }

  setTasks(tasks: TasksByCategory): void {
    this.tasks = tasks;
    this.render();
  }

  private renderSection(
    title: string,
    dateMap: Map<string, { dailyTasks: DailyTask[]; taskItems: TaskItem[]; dailyFile?: TFile }>,
    type: "overdue" | "upcoming"
  ): void {
    const sectionEl = this.containerEl.createDiv(`journalite-section journalite-${type}`);
    sectionEl.createEl("h3", { text: title, cls: "journalite-section-title" });

    for (const [dateStr, data] of dateMap) {
      const dateHeader = sectionEl.createEl("h4", {
        text: formatDateWithWeekday(dateStr),
        cls: "journalite-date-header",
      });

      // Daily tasks
      if (data.dailyTasks.length > 0 && data.dailyFile) {
        const listEl = sectionEl.createEl("ul", { cls: "journalite-task-list" });
        for (const task of data.dailyTasks) {
          this.renderDailyTaskItem(listEl, task, data.dailyFile);
        }
      }

      // Task pages
      if (data.taskItems.length > 0) {
        const listEl = sectionEl.createEl("ul", { cls: "journalite-task-list" });
        for (const task of data.taskItems) {
          this.renderTaskItem(listEl, task);
        }
      }
    }
  }

  private renderTodaySection(data: {
    dailyTasks: DailyTask[];
    taskItems: TaskItem[];
    dailyFile?: TFile;
  }): void {
    const sectionEl = this.containerEl.createDiv("journalite-section journalite-today-section");
    sectionEl.createEl("h3", { text: "🔵 Today", cls: "journalite-section-title" });

    const todayStr = getTodayStr();
    sectionEl.createEl("h4", {
      text: formatDateWithWeekday(todayStr),
      cls: "journalite-date-header",
    });

    // Daily tasks
    if (data.dailyTasks.length > 0 && data.dailyFile) {
      const listEl = sectionEl.createEl("ul", { cls: "journalite-task-list" });
      for (const task of data.dailyTasks) {
        this.renderDailyTaskItem(listEl, task, data.dailyFile);
      }
    }

    // Task pages
    if (data.taskItems.length > 0) {
      const listEl = sectionEl.createEl("ul", { cls: "journalite-task-list" });
      for (const task of data.taskItems) {
        this.renderTaskItem(listEl, task);
      }
    }
  }

  private renderNoScheduleSection(tasks: TaskItem[]): void {
    const sectionEl = this.containerEl.createDiv("journalite-section journalite-no-schedule");
    sectionEl.createEl("h3", { text: "⁉️ No Schedule", cls: "journalite-section-title" });

    const listEl = sectionEl.createEl("ul", { cls: "journalite-task-list" });
    for (const task of tasks) {
      this.renderTaskItem(listEl, task);
    }
  }

  private renderDailyTaskItem(listEl: HTMLElement, task: DailyTask, dailyFile: TFile): void {
    const itemEl = listEl.createEl("li", { cls: "journalite-daily-task" });

    // Checkbox
    const checkboxEl = itemEl.createEl("input", {
      cls: "task-list-item-checkbox",
      attr: { type: "checkbox" },
    });
    checkboxEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onDailyTaskToggle(dailyFile, task.line);
    });

    // Task text
    const displayText = task.text || `(L${task.line + 1})`;
    const textEl = itemEl.createEl("span", {
      text: displayText,
      cls: "journalite-task-text",
    });
    textEl.addEventListener("click", (e) => {
      e.preventDefault();
      this.onTaskClick(dailyFile, task.line);
    });
  }

  private renderTaskItem(listEl: HTMLElement, task: TaskItem): void {
    const itemEl = listEl.createEl("li", { cls: "journalite-task-item-rich" });

    // Checkbox
    const checkboxEl = itemEl.createEl("input", {
      cls: "task-list-item-checkbox",
      attr: { type: "checkbox" },
    });
    checkboxEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onTaskItemToggle(task.file);
    });

    // Content (task name + period)
    const contentEl = itemEl.createEl("div", { cls: "journalite-task-content" });

    // Task name
    const nameEl = contentEl.createEl("span", {
      text: task.name,
      cls: "journalite-task-name",
    });
    nameEl.addEventListener("click", (e) => {
      e.preventDefault();
      this.onTaskClick(task.file);
    });

    // Period (if any)
    const period = this.getTaskPeriodRich(task);
    if (period) {
      contentEl.createEl("span", {
        text: period,
        cls: "journalite-task-period",
      });
    }
  }

  private getTaskPeriodRich(task: TaskItem): string | null {
    const { startDate, dueDate } = task;

    if (startDate && dueDate) {
      return `📅 ${formatDateShort(startDate)} → ${formatDateShort(dueDate)}`;
    }
    if (startDate) {
      return `📅 ${formatDateShort(startDate)} →`;
    }
    if (dueDate) {
      return `📅 → ${formatDateShort(dueDate)}`;
    }
    return null;
  }
}
