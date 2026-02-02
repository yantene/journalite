import type { Schedulable } from "../types";

/** Date pattern for YYYY-MM-DD format */
const DATE = String.raw`\d{4}-\d{2}-\d{2}`;

/** Regex for highlighting @-prefixed date patterns (global, for editor) */
export const DATE_HIGHLIGHT_PATTERN = new RegExp(
  `@(?:${DATE}\\.\\.${DATE}|${DATE}\\.\\.|\\.\\.${DATE}|${DATE})`,
  "g"
);

/** Extract dates from @-prefixed patterns at end of text
 * Supported formats:
 * - @YYYY-MM-DD → startDate and dueDate (same)
 * - @YYYY-MM-DD..YYYY-MM-DD → startDate and dueDate
 * - @YYYY-MM-DD.. → startDate only
 * - @..YYYY-MM-DD → dueDate only
 */
export function extractDatesFromText(text: string): { text: string } & Schedulable {
  const datePattern = DATE;

  // @YYYY-MM-DD..YYYY-MM-DD (both dates)
  const rangeMatch = text.match(new RegExp(`\\s*@(${datePattern})\\.\\.(${datePattern})\\s*$`));
  if (rangeMatch) {
    return {
      text: text.slice(0, rangeMatch.index).trim(),
      startDate: rangeMatch[1],
      dueDate: rangeMatch[2],
    };
  }

  // @YYYY-MM-DD.. (startDate only)
  const startOnlyMatch = text.match(new RegExp(`\\s*@(${datePattern})\\.\\.\\s*$`));
  if (startOnlyMatch) {
    return {
      text: text.slice(0, startOnlyMatch.index).trim(),
      startDate: startOnlyMatch[1],
      dueDate: null,
    };
  }

  // @..YYYY-MM-DD (dueDate only with prefix)
  const dueOnlyMatch = text.match(new RegExp(`\\s*@\\.\\.(${datePattern})\\s*$`));
  if (dueOnlyMatch) {
    return {
      text: text.slice(0, dueOnlyMatch.index).trim(),
      startDate: null,
      dueDate: dueOnlyMatch[1],
    };
  }

  // @YYYY-MM-DD (single date: both startDate and dueDate)
  const simpleMatch = text.match(new RegExp(`\\s*@(${datePattern})\\s*$`));
  if (simpleMatch) {
    return {
      text: text.slice(0, simpleMatch.index).trim(),
      startDate: simpleMatch[1],
      dueDate: simpleMatch[1],
    };
  }

  return { text, startDate: null, dueDate: null };
}

/** Check if a schedulable item is active on a given date */
export function isActiveOnDate(item: Schedulable, dateStr: string): boolean {
  const { startDate, dueDate } = item;

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
