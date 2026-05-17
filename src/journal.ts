import { App, TFile } from 'obsidian';
import { getDailyNotePathForDate } from './daily-note';
import type { DailyJournal, DailyTodoListSettings } from './types';

interface HeadingSection {
  startLine: number;
  endLine: number;
  level: number;
}

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

function trimSectionPadding(lines: string[], startLine: number, endLine: number): { start: number; end: number } {
  let start = startLine;
  let end = endLine;

  while (start < end && lines[start].trim() === '') start++;
  while (end > start && lines[end - 1].trim() === '') end--;

  return { start, end };
}

export function readJournalFromContent(content: string, heading: string): string {
  const section = findHeadingSection(content, heading);
  if (!section) return '';

  const lines = splitLines(content);
  const { start, end } = trimSectionPadding(lines, section.startLine, section.endLine);
  return lines.slice(start, end).join(getLineEnding(content)).trim();
}

export function upsertJournalInContent(content: string, heading: string, text: string): string {
  const nextContent = ensureHeading(content, heading);
  const section = findHeadingSection(nextContent, heading);
  if (!section) return nextContent;

  const lines = splitLines(nextContent);
  const { start, end } = trimSectionPadding(lines, section.startLine, section.endLine);
  const normalizedText = text.trim();
  const replacement = normalizedText.length > 0 ? normalizedText.split(/\r?\n/) : [];
  lines.splice(start, end - start, ...replacement);

  if (replacement.length === 0 && start === section.endLine && start < lines.length && lines[start].trim() === '') {
    lines.splice(start, 1);
  }

  return joinLines(lines, nextContent);
}

export async function readJournalForDate(
  app: App,
  settings: DailyTodoListSettings,
  date: string,
): Promise<DailyJournal | null> {
  const path = getDailyNotePathForDate(app, settings, date);
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) return null;

  const content = await app.vault.read(file);
  return {
    text: readJournalFromContent(content, settings.journalHeading),
    date,
    filePath: path,
  };
}

export async function readJournalsForDateRange(
  app: App,
  settings: DailyTodoListSettings,
  startDate: string,
  endDate: string,
): Promise<DailyJournal[]> {
  const start = window.moment(startDate, 'YYYY-MM-DD');
  const end = window.moment(endDate, 'YYYY-MM-DD');
  const dates: string[] = [];

  for (const day = start.clone(); day.isSameOrBefore(end, 'day'); day.add(1, 'day')) {
    const date = day.format('YYYY-MM-DD');
    const path = getDailyNotePathForDate(app, settings, date);
    if (app.vault.getAbstractFileByPath(path) instanceof TFile) dates.push(date);
  }

  const journals = await Promise.all(dates.map((date) => readJournalForDate(app, settings, date)));
  return journals.filter((journal): journal is DailyJournal => Boolean(journal));
}
