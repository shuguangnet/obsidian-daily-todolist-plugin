import { App, TFile } from 'obsidian';
import { getDailyNotePathForDate } from './daily-note';
import { parseTasksFromContent } from './markdown-tasks';
import type { DailyTask, DailyTodoListSettings, TodoTask } from './types';

const dateTimeRegex = /\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?/;
const scheduleFieldRegex = /\s*\[(start|开始|end|结束|due|到期)::\s*\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?\]/g;
const priorityFieldRegex = /\s*\[(priority|优先级)::\s*([^\]]+)\]/g;
const emojiDateRegex = /\s*📅\s*\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?/g;

export function parseTaskSchedule(
  text: string,
): Pick<TodoTask, 'startDate' | 'endDate' | 'dueDate' | 'priority' | 'displayText'> {
  const startDate = readInlineDate(text, ['start', '开始']);
  const endDate = readInlineDate(text, ['end', '结束']);
  const dueDate = readInlineDate(text, ['due', '到期']) ?? readEmojiDate(text);
  const priority = readPriority(text);
  const displayText = text
    .replace(scheduleFieldRegex, '')
    .replace(priorityFieldRegex, '')
    .replace(emojiDateRegex, '')
    .trim();

  return { startDate, endDate, dueDate, priority, displayText };
}

function readInlineDate(text: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const match = new RegExp(`\\[${key}::\\s*(${dateTimeRegex.source})\\]`).exec(text);
    if (match) return normalizeScheduleDate(match[1]);
  }
  return undefined;
}

function readEmojiDate(text: string): string | undefined {
  const match = new RegExp(`📅\\s*(${dateTimeRegex.source})`).exec(text);
  return match ? normalizeScheduleDate(match[1]) : undefined;
}

function readPriority(text: string): string | undefined {
  const match = /\[(priority|优先级)::\s*([^\]]+)\]/.exec(text);
  return match?.[2].trim();
}

function normalizeScheduleDate(value: string): string {
  return value.trim().replace('T', ' ');
}

export function enrichTask(task: TodoTask, date: string, filePath: string): DailyTask {
  const schedule = parseTaskSchedule(task.text);
  return {
    ...task,
    ...schedule,
    date,
    filePath,
  };
}

export async function readTasksForDate(
  app: App,
  settings: DailyTodoListSettings,
  date: string,
): Promise<DailyTask[]> {
  const path = getDailyNotePathForDate(app, settings, date);
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return [];

  const content = await app.vault.read(file);
  return parseTasksFromContent(content, settings.todoHeading)
    .map((task) => enrichTask(task, date, path));
}

export async function readTasksForDateRange(
  app: App,
  settings: DailyTodoListSettings,
  startDate: string,
  endDate: string,
): Promise<DailyTask[]> {
  const start = window.moment(startDate, 'YYYY-MM-DD');
  const end = window.moment(endDate, 'YYYY-MM-DD');
  const dates: string[] = [];

  for (const day = start.clone(); day.isSameOrBefore(end, 'day'); day.add(1, 'day')) {
    const date = day.format('YYYY-MM-DD');
    const path = getDailyNotePathForDate(app, settings, date);
    if (app.vault.getAbstractFileByPath(path) instanceof TFile) dates.push(date);
  }

  const taskGroups = await Promise.all(dates.map((date) => readTasksForDate(app, settings, date)));
  return taskGroups.flat();
}

export function scheduledTasks(tasks: DailyTask[]): DailyTask[] {
  return tasks.filter((task) => task.startDate || task.endDate || task.dueDate);
}

export function getTaskStartDate(task: DailyTask): string {
  return task.startDate ?? task.dueDate ?? task.date;
}

export function getTaskEndDate(task: DailyTask): string {
  return task.endDate ?? task.dueDate ?? task.startDate ?? task.date;
}

export function createMermaidGantt(tasks: DailyTask[]): string {
  const lines = [
    '```mermaid',
    'gantt',
    '    title Daily TodoList 排期',
    '    dateFormat  YYYY-MM-DD HH:mm',
    '    axisFormat  %m-%d %H:%M',
    '    section Tasks',
  ];

  for (const task of scheduledTasks(tasks)) {
    const name = sanitizeMermaidText(task.displayText || task.text);
    const status = task.completed ? 'done, ' : '';
    const startDate = toMermaidDateTime(getTaskStartDate(task));
    const endDate = toMermaidDateTime(getTaskEndDate(task));
    lines.push(`    ${name} :${status}${startDate}, ${endDate}`);
  }

  lines.push('```');
  return lines.join('\n');
}

function toMermaidDateTime(value: string): string {
  return value.includes(':') ? value.replace('T', ' ') : `${value} 00:00`;
}

function sanitizeMermaidText(text: string): string {
  return text.replace(/[:#\n\r]/g, ' ').trim() || 'Untitled';
}
