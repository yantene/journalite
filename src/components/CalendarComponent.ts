import {
  formatDate,
  getCalendarDays,
  isSaturday,
  isSunday,
  getTodayStr,
} from "../utils/dateUtils";
import type { CalendarClickHandler, CalendarContextMenuHandler } from "../types";

export class CalendarComponent {
  private containerEl: HTMLElement;
  private year: number;
  private month: number;
  private existingDates: Set<string>;
  private onDateClick: CalendarClickHandler;
  private onContextMenu: CalendarContextMenuHandler;

  constructor(
    containerEl: HTMLElement,
    existingDates: Set<string>,
    onDateClick: CalendarClickHandler,
    onContextMenu: CalendarContextMenuHandler,
    initialYear?: number,
    initialMonth?: number
  ) {
    this.containerEl = containerEl;
    this.existingDates = existingDates;
    this.onDateClick = onDateClick;
    this.onContextMenu = onContextMenu;

    const now = new Date();
    this.year = initialYear ?? now.getFullYear();
    this.month = initialMonth ?? now.getMonth();
  }

  getYear(): number {
    return this.year;
  }

  getMonth(): number {
    return this.month;
  }

  render(): void {
    this.containerEl.empty();
    this.containerEl.addClass("journalite-calendar");

    // Header (month navigation)
    const headerEl = this.containerEl.createDiv("journalite-calendar-header");

    const prevBtn = headerEl.createEl("button", {
      text: "◀",
      cls: "journalite-nav-btn",
    });
    prevBtn.addEventListener("click", () => this.prevMonth());

    const titleEl = headerEl.createEl("span", {
      cls: "journalite-calendar-title",
    });
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    titleEl.textContent = `${monthNames[this.month]} ${this.year}`;

    const nextBtn = headerEl.createEl("button", {
      text: "▶",
      cls: "journalite-nav-btn",
    });
    nextBtn.addEventListener("click", () => this.nextMonth());

    const todayBtn = headerEl.createEl("button", {
      text: "Today",
      cls: "journalite-today-btn",
    });
    todayBtn.addEventListener("click", () => this.goToToday());

    // Weekday header
    const weekdaysEl = this.containerEl.createDiv("journalite-weekdays");
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 0; i < weekdays.length; i++) {
      const wdEl = weekdaysEl.createEl("span", { text: weekdays[i] });
      if (i === 0) wdEl.addClass("journalite-sunday");
      if (i === 6) wdEl.addClass("journalite-saturday");
    }

    // Calendar grid
    const gridEl = this.containerEl.createDiv("journalite-calendar-grid");
    const weeks = getCalendarDays(this.year, this.month);
    const todayStr = getTodayStr();

    for (const week of weeks) {
      for (const date of week) {
        const cellEl = gridEl.createDiv("journalite-day");

        if (date === null) {
          cellEl.addClass("journalite-day-empty");
          continue;
        }

        const dateStr = formatDate(date);
        const dayNum = date.getDate();

        cellEl.textContent = String(dayNum);

        // Weekday coloring
        if (isSunday(date)) cellEl.addClass("journalite-sunday");
        if (isSaturday(date)) cellEl.addClass("journalite-saturday");

        // Today highlight
        if (dateStr === todayStr) {
          cellEl.addClass("journalite-today");
        }

        // Show dot for days with daily notes
        if (this.existingDates.has(dateStr)) {
          cellEl.addClass("journalite-has-note");
        }

        // Click event
        cellEl.addEventListener("click", () => {
          this.onDateClick(date);
        });

        // Right-click event
        cellEl.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          this.onContextMenu(date, e);
        });
      }
    }
  }

  /** Update existing dates */
  updateExistingDates(dates: Set<string>): void {
    this.existingDates = dates;
    this.render();
  }

  private prevMonth(): void {
    this.month--;
    if (this.month < 0) {
      this.month = 11;
      this.year--;
    }
    this.render();
  }

  private nextMonth(): void {
    this.month++;
    if (this.month > 11) {
      this.month = 0;
      this.year++;
    }
    this.render();
  }

  private goToToday(): void {
    const now = new Date();
    this.year = now.getFullYear();
    this.month = now.getMonth();
    this.render();
  }
}
