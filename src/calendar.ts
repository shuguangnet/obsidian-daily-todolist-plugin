import { App, TFile } from 'obsidian';
import { getDailyNotePathForDate } from './daily-note';
import { readTasksForDate } from './schedule';
import type { CalendarDaySummary, DailyTodoListSettings } from './types';

export async function getMonthSummaries(
  app: App,
  settings: DailyTodoListSettings,
  month: string,
): Promise<CalendarDaySummary[]> {
  const dates = getMonthDates(month);
  const summaries = dates.map<CalendarDaySummary>((date) => ({
    date,
    total: 0,
    completed: 0,
    scheduled: 0,
  }));

  await Promise.all(summaries.map(async (summary) => {
    const path = getDailyNotePathForDate(app, settings, summary.date);
    if (!(app.vault.getAbstractFileByPath(path) instanceof TFile)) return;

    const tasks = await readTasksForDate(app, settings, summary.date);
    summary.total = tasks.length;
    summary.completed = tasks.filter((task) => task.completed).length;
    summary.scheduled = tasks.filter((task) => task.startDate || task.endDate || task.dueDate).length;
  }));

  return summaries;
}

function getMonthDates(month: string): string[] {
  const start = window.moment(month, 'YYYY-MM').startOf('month');
  const end = start.clone().endOf('month');
  const dates: string[] = [];

  for (const day = start.clone(); day.isSameOrBefore(end, 'day'); day.add(1, 'day')) {
    dates.push(day.format('YYYY-MM-DD'));
  }

  return dates;
}

export function buildCalendarGrid(month: string): Array<string | null> {
  const start = window.moment(month, 'YYYY-MM').startOf('month');
  const end = start.clone().endOf('month');
  const days: Array<string | null> = [];
  const offset = start.day();

  for (let i = 0; i < offset; i++) days.push(null);
  for (const day = start.clone(); day.isSameOrBefore(end, 'day'); day.add(1, 'day')) {
    days.push(day.format('YYYY-MM-DD'));
  }
  while (days.length % 7 !== 0) days.push(null);

  return days;
}
