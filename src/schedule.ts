import { App, TFile } from 'obsidian';
import { getDailyNotePathForDate } from './daily-note';
import { parseTasksFromContent } from './markdown-tasks';
import type { DailyTask, DailyTodoListSettings, TodoTask } from './types';

const dateRegex = /\d{4}-\d{2}-\d{2}/;

export function parseTaskSchedule(text: string): Pick<TodoTask, 'startDate' | 'endDate' | 'dueDate' | 'displayText'> {
  const startDate = readInlineDate(text, ['start', '开始']);
  const endDate = readInlineDate(text, ['end', '结束']);
  const dueDate = readInlineDate(text, ['due', '到期']) ?? readEmojiDate(text);
  const displayText = text
    .replace(/\s*\[(start|开始|end|结束|due|到期)::\s*\d{4}-\d{2}-\d{2}\]/g, '')
    .replace(/\s*📅\s*\d{4}-\d{2}-\d{2}/g, '')
    .trim();

  return { startDate, endDate, dueDate, displayText };
}

function readInlineDate(text: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const match = new RegExp(`\\[${key}::\\s*(${dateRegex.source})\\]`).exec(text);
    if (match) return match[1];
  }
  return undefined;
}

function readEmojiDate(text: string): string | undefined {
  const match = /📅\s*(\d{4}-\d{2}-\d{2})/.exec(text);
  return match?.[1];
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
  const tasks: DailyTask[] = [];

  for (const day = start.clone(); day.isSameOrBefore(end, 'day'); day.add(1, 'day')) {
    tasks.push(...await readTasksForDate(app, settings, day.format('YYYY-MM-DD')));
  }

  return tasks;
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
    '    dateFormat  YYYY-MM-DD',
    '    axisFormat  %m-%d',
    '    section Tasks',
  ];

  for (const task of scheduledTasks(tasks)) {
    const name = sanitizeMermaidText(task.displayText || task.text);
    const status = task.completed ? 'done, ' : '';
    lines.push(`    ${name} :${status}${getTaskStartDate(task)}, ${getTaskEndDate(task)}`);
  }

  lines.push('```');
  return lines.join('\n');
}

function sanitizeMermaidText(text: string): string {
  return text.replace(/[:#\n\r]/g, ' ').trim() || 'Untitled';
}
