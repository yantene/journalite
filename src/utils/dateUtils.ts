/** Convert Date to YYYY-MM-DD format */
export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Convert YYYY-MM-DD string to Date */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Get today's date in YYYY-MM-DD format */
export function getTodayStr(): string {
  return formatDate(new Date());
}

/** Get short weekday name */
export function getWeekdayShort(date: Date): string {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return weekdays[date.getDay()];
}

/** Format date with weekday */
export function formatDateWithWeekday(dateStr: string): string {
  const date = parseDate(dateStr);
  return `${dateStr} (${getWeekdayShort(date)})`;
}

/** Get first day of month (internal use) */
function getFirstDayOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

/** Get last day of month (internal use) */
function getLastDayOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

/** Generate calendar array by weeks */
export function getCalendarDays(year: number, month: number): (Date | null)[][] {
  const firstDay = getFirstDayOfMonth(year, month);
  const lastDay = getLastDayOfMonth(year, month);
  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = [];

  // Fill with null until the first day's weekday
  for (let i = 0; i < firstDay.getDay(); i++) {
    week.push(null);
  }

  // Fill in the days
  for (let day = 1; day <= lastDay.getDate(); day++) {
    week.push(new Date(year, month, day));
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  // Fill remaining with null after month end
  if (week.length > 0) {
    while (week.length < 7) {
      week.push(null);
    }
    weeks.push(week);
  }

  return weeks;
}

/** Get date n days from now */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/** Check if Saturday */
export function isSaturday(date: Date): boolean {
  return date.getDay() === 6;
}

/** Check if Sunday */
export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

/** Format date in short form (MM-DD for current year, YYYY-MM-DD otherwise) */
export function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  const currentYear = new Date().getFullYear();
  const dateYear = parseInt(year, 10);

  if (dateYear === currentYear) {
    return `${month}-${day}`;
  }
  return dateStr;
}
