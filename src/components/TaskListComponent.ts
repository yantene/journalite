import type { TFile } from "obsidian";
import type { TasksByCategory, TaskNote, TaskItem, TaskClickHandler, TaskItemToggleHandler, TaskNoteToggleHandler, Schedulable } from "../types";
import { formatDateWithWeekday, formatDateShort, getTodayStr } from "../utils/dateUtils";

/** Tree node for grouping task items by shared file/parent hierarchy */
interface TaskTreeNode {
  label: string;
  children: Map<string, TaskTreeNode>;
  items: TaskItem[];
}

export class TaskListComponent {
  private containerEl: HTMLElement;
  private tasks: TasksByCategory | null = null;
  private onTaskClick: TaskClickHandler;
  private onTaskItemToggle: TaskItemToggleHandler;
  private onTaskNoteToggle: TaskNoteToggleHandler;
  private isDailyNote: (file: TFile) => boolean;

  constructor(
    containerEl: HTMLElement,
    onTaskClick: TaskClickHandler,
    onTaskItemToggle: TaskItemToggleHandler,
    onTaskNoteToggle: TaskNoteToggleHandler,
    isDailyNote: (file: TFile) => boolean
  ) {
    this.containerEl = containerEl;
    this.onTaskClick = onTaskClick;
    this.onTaskItemToggle = onTaskItemToggle;
    this.onTaskNoteToggle = onTaskNoteToggle;
    this.isDailyNote = isDailyNote;
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
    if (today.taskItems.length > 0 || today.taskNotes.length > 0) {
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
      today.taskItems.length === 0 &&
      today.taskNotes.length === 0 &&
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
    dateMap: Map<string, { taskItems: TaskItem[]; taskNotes: TaskNote[] }>,
    type: "overdue" | "upcoming"
  ): void {
    const sectionEl = this.containerEl.createDiv(`journalite-section journalite-${type}`);
    sectionEl.createEl("h3", { text: title, cls: "journalite-section-title" });

    for (const [dateStr, data] of dateMap) {
      sectionEl.createEl("h4", {
        text: formatDateWithWeekday(dateStr),
        cls: "journalite-date-header",
      });

      // Task items as grouped tree
      if (data.taskItems.length > 0) {
        this.renderTaskItems(sectionEl, data.taskItems);
      }

      // Task notes
      if (data.taskNotes.length > 0) {
        const listEl = sectionEl.createEl("ul", { cls: "journalite-task-list" });
        for (const note of data.taskNotes) {
          this.renderTaskNote(listEl, note);
        }
      }
    }
  }

  private renderTodaySection(data: { taskItems: TaskItem[]; taskNotes: TaskNote[] }): void {
    const sectionEl = this.containerEl.createDiv("journalite-section journalite-today-section");
    sectionEl.createEl("h3", { text: "🔵 Today", cls: "journalite-section-title" });

    const todayStr = getTodayStr();
    sectionEl.createEl("h4", {
      text: formatDateWithWeekday(todayStr),
      cls: "journalite-date-header",
    });

    // Task items as grouped tree
    if (data.taskItems.length > 0) {
      this.renderTaskItems(sectionEl, data.taskItems);
    }

    // Task notes
    if (data.taskNotes.length > 0) {
      const listEl = sectionEl.createEl("ul", { cls: "journalite-task-list" });
      for (const note of data.taskNotes) {
        this.renderTaskNote(listEl, note);
      }
    }
  }

  private renderNoScheduleSection(notes: TaskNote[]): void {
    const sectionEl = this.containerEl.createDiv("journalite-section journalite-no-schedule");
    sectionEl.createEl("h3", { text: "⚪ No Schedule", cls: "journalite-section-title" });

    const listEl = sectionEl.createEl("ul", { cls: "journalite-task-list" });
    for (const note of notes) {
      this.renderTaskNote(listEl, note);
    }
  }

  // --- Task Item Tree ---

  /** Build a tree from task items, grouping by file name and breadcrumbs */
  private buildTaskTree(items: TaskItem[]): TaskTreeNode {
    const root: TaskTreeNode = { label: "", children: new Map(), items: [] };

    for (const item of items) {
      const isDailyNote = this.isDailyNote(item.file);
      const path: string[] = [];
      if (!isDailyNote) {
        path.push(item.file.basename);
      }
      path.push(...item.breadcrumbs);

      let node = root;
      for (const segment of path) {
        if (!node.children.has(segment)) {
          node.children.set(segment, { label: segment, children: new Map(), items: [] });
        }
        node = node.children.get(segment)!;
      }
      node.items.push(item);
    }

    return root;
  }

  /** Render task items as a grouped tree */
  private renderTaskItems(containerEl: HTMLElement, items: TaskItem[]): void {
    const tree = this.buildTaskTree(items);
    const treeEl = containerEl.createDiv("journalite-task-tree");
    this.renderTreeChildren(treeEl, tree, 0);
  }

  /** Render children of a tree node */
  private renderTreeChildren(parentEl: HTMLElement, node: TaskTreeNode, depth: number): void {
    // Render leaf task items at this node
    for (const item of node.items) {
      this.renderTaskLeaf(parentEl, item, depth);
    }

    // Render child groups (collapsible)
    for (const [, child] of node.children) {
      this.renderTreeGroup(parentEl, child, depth);
    }
  }

  /** Render a collapsible tree group */
  private renderTreeGroup(parentEl: HTMLElement, node: TaskTreeNode, depth: number): void {
    const groupEl = parentEl.createDiv("journalite-tree-node");

    // Label row with toggle arrow
    const labelEl = groupEl.createDiv("journalite-tree-label");
    labelEl.style.paddingLeft = `${depth * 16}px`;

    const arrowEl = labelEl.createEl("span", {
      text: "\u25BC",
      cls: "journalite-tree-arrow",
    });

    labelEl.createEl("span", {
      text: node.label,
      cls: "journalite-tree-label-text",
    });

    // Children container
    const childrenEl = groupEl.createDiv("journalite-tree-children");
    this.renderTreeChildren(childrenEl, node, depth + 1);

    // Toggle collapse
    labelEl.addEventListener("click", () => {
      const collapsed = groupEl.hasClass("is-collapsed");
      if (collapsed) {
        groupEl.removeClass("is-collapsed");
        arrowEl.textContent = "\u25BC";
      } else {
        groupEl.addClass("is-collapsed");
        arrowEl.textContent = "\u25B6";
      }
    });
  }

  /** Render a single task item (leaf node in the tree) */
  private renderTaskLeaf(parentEl: HTMLElement, item: TaskItem, depth: number): void {
    const taskRowEl = parentEl.createDiv("journalite-task-row");
    taskRowEl.style.paddingLeft = `${depth * 16}px`;

    // Checkbox
    const checkboxEl = taskRowEl.createEl("input", {
      cls: "task-list-item-checkbox",
      attr: { type: "checkbox" },
    });
    checkboxEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onTaskItemToggle(item.file, item.line);
    });

    // Content wrapper
    const contentEl = taskRowEl.createDiv("journalite-task-content");

    // Task text
    const taskText = item.text || `(L${item.line + 1})`;
    const textEl = contentEl.createEl("span", {
      text: taskText,
      cls: "journalite-task-text",
    });
    textEl.addEventListener("click", (e) => {
      e.preventDefault();
      this.onTaskClick(item.file, item.line);
    });

    // Period (if any)
    const period = this.formatPeriod(item);
    if (period) {
      contentEl.createEl("span", {
        text: period,
        cls: "journalite-task-period",
      });
    }
  }

  // --- Task Note ---

  private renderTaskNote(listEl: HTMLElement, note: TaskNote): void {
    const itemEl = listEl.createEl("li", { cls: "journalite-task-note" });

    // Checkbox
    const checkboxEl = itemEl.createEl("input", {
      cls: "task-list-item-checkbox",
      attr: { type: "checkbox" },
    });
    checkboxEl.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onTaskNoteToggle(note.file);
    });

    // Content
    const contentEl = itemEl.createEl("div", { cls: "journalite-task-content" });

    // Note name
    const nameEl = contentEl.createEl("span", {
      text: note.name,
      cls: "journalite-task-name",
    });
    nameEl.addEventListener("click", (e) => {
      e.preventDefault();
      this.onTaskClick(note.file);
    });

    // Period (if any)
    const period = this.formatPeriod(note);
    if (period) {
      contentEl.createEl("span", {
        text: period,
        cls: "journalite-task-period",
      });
    }
  }

  // --- Util ---

  private formatPeriod(item: Schedulable): string | null {
    const { startDate, dueDate } = item;

    if (startDate && dueDate) {
      if (startDate === dueDate) {
        return `📅 ${formatDateShort(startDate)}`;
      }
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
