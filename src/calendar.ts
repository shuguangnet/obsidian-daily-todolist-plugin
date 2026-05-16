import { App } from 'obsidian';
import { readTasksForDate } from './schedule';
import type { CalendarDaySummary, DailyTodoListSettings } from './types';

export async function getMonthSummaries(
  app: App,
  settings: DailyTodoListSettings,
  month: string,
): Promise<CalendarDaySummary[]> {
  const start = window.moment(month, 'YYYY-MM').startOf('month');
  const end = start.clone().endOf('month');
  const summaries: CalendarDaySummary[] = [];

  for (const day = start.clone(); day.isSameOrBefore(end, 'day'); day.add(1, 'day')) {
    const date = day.format('YYYY-MM-DD');
    const tasks = await readTasksForDate(app, settings, date);
    summaries.push({
      date,
      total: tasks.length,
      completed: tasks.filter((task) => task.completed).length,
      scheduled: tasks.filter((task) => task.startDate || task.endDate || task.dueDate).length,
    });
  }

  return summaries;
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
