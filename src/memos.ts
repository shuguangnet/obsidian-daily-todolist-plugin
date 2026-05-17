import { App, TFile } from 'obsidian';
import { getDailyNotePathForDate } from './daily-note';
import type { DailyMemo, DailyTodoListSettings, MemoItem } from './types';

interface HeadingSection {
  startLine: number;
  endLine: number;
  level: number;
}

const memoRegex = /^\s*[-*]\s+(.+)$/;

function normalizeHeading(heading: string): string {
  return heading.replace(/^#+\s*/, '').trim();
}

function splitLines(content: string): string[] {
  return content.length === 0 ? [] : content.split('\n');
}

function getLineEnding(content: string): string {
  return content.includes('\r\n') ? '\r\n' : '\n';
}

function joinLines(lines: string[], original: string): string {
  return lines.join(getLineEnding(original));
}

function headingMatch(line: string): { level: number; text: string } | null {
  const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line.trim());
  if (!match) return null;
  return { level: match[1].length, text: normalizeHeading(match[2]) };
}

function findHeadingSection(content: string, heading: string): HeadingSection | null {
  const lines = splitLines(content);
  const target = normalizeHeading(heading);

  for (let i = 0; i < lines.length; i++) {
    const current = headingMatch(lines[i]);
    if (!current || current.text !== target) continue;

    let endLine = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      const next = headingMatch(lines[j]);
      if (next && next.level <= current.level) {
        endLine = j;
        break;
      }
    }

    return { startLine: i + 1, endLine, level: current.level };
  }

  return null;
}

function ensureHeading(content: string, heading: string): string {
  if (findHeadingSection(content, heading)) return content;

  const ending = getLineEnding(content);
  const trimmedEnd = content.replace(/[\r\n]+$/, '');
  const prefix = trimmedEnd.length > 0 ? `${trimmedEnd}${ending}${ending}` : '';
  return `${prefix}## ${normalizeHeading(heading)}${ending}`;
}

function resolveMemoLine(lines: string[], memo: MemoItem): number {
  if (lines[memo.line] === memo.raw) return memo.line;
  return lines.findIndex((line) => line === memo.raw);
}

export function parseMemosFromContent(content: string, heading: string): MemoItem[] {
  const section = findHeadingSection(content, heading);
  if (!section) return [];

  const lines = splitLines(content);
  const memos: MemoItem[] = [];
  for (let i = section.startLine; i < section.endLine; i++) {
    const match = memoRegex.exec(lines[i]);
    if (!match) continue;
    memos.push({
      id: `${i}:${lines[i]}`,
      line: i,
      text: match[1].trim(),
      raw: lines[i],
    });
  }

  return memos;
}

export function addMemoToContent(content: string, heading: string, text: string): string {
  const nextContent = ensureHeading(content, heading);
  const section = findHeadingSection(nextContent, heading);
  if (!section) return nextContent;

  const lines = splitLines(nextContent);
  let insertAt = section.endLine;
  while (insertAt > section.startLine && lines[insertAt - 1].trim() === '') {
    insertAt--;
  }

  lines.splice(insertAt, 0, `- ${text.trim()}`);
  return joinLines(lines, nextContent);
}

export function deleteMemoFromContent(content: string, memo: MemoItem): string | null {
  const lines = splitLines(content);
  const lineIndex = resolveMemoLine(lines, memo);
  if (lineIndex === -1) return null;

  lines.splice(lineIndex, 1);
  return joinLines(lines, content);
}

export async function readMemosForDate(
  app: App,
  settings: DailyTodoListSettings,
  date: string,
): Promise<DailyMemo[]> {
  const path = getDailyNotePathForDate(app, settings, date);
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return [];

  const content = await app.vault.read(file);
  return parseMemosFromContent(content, settings.memoHeading)
    .map((memo) => ({ ...memo, date, filePath: path }));
}

export async function readMemosForDateRange(
  app: App,
  settings: DailyTodoListSettings,
  startDate: string,
  endDate: string,
): Promise<DailyMemo[]> {
  const start = window.moment(startDate, 'YYYY-MM-DD');
  const end = window.moment(endDate, 'YYYY-MM-DD');
  const dates: string[] = [];

  for (const day = start.clone(); day.isSameOrBefore(end, 'day'); day.add(1, 'day')) {
    const date = day.format('YYYY-MM-DD');
    const path = getDailyNotePathForDate(app, settings, date);
    if (app.vault.getAbstractFileByPath(path) instanceof TFile) dates.push(date);
  }

  const groups = await Promise.all(dates.map((date) => readMemosForDate(app, settings, date)));
  return groups.flat();
}
