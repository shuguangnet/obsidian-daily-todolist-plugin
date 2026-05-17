import type { TodoTask } from './types';

export interface HeadingSection {
  headingLine: number;
  startLine: number;
  endLine: number;
  level: number;
}

const checkboxRegex = /^\s*[-*]\s+\[([ xX])]\s+(.*)$/;

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
  const ending = getLineEnding(original);
  return lines.join(ending);
}

function headingMatch(line: string): { level: number; text: string } | null {
  const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line.trim());
  if (!match) return null;
  return { level: match[1].length, text: normalizeHeading(match[2]) };
}

export function findHeadingSection(content: string, heading: string): HeadingSection | null {
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

    return {
      headingLine: i,
      startLine: i + 1,
      endLine,
      level: current.level,
    };
  }

  return null;
}

export function ensureHeading(content: string, heading: string): string {
  if (findHeadingSection(content, heading)) return content;

  const trimmedEnd = content.replace(/[\r\n]+$/, '');
  const prefix = trimmedEnd.length > 0 ? `${trimmedEnd}${getLineEnding(content)}${getLineEnding(content)}` : '';
  return `${prefix}## ${normalizeHeading(heading)}${getLineEnding(content)}`;
}

export function parseTasksFromContent(content: string, heading: string): TodoTask[] {
  const section = findHeadingSection(content, heading);
  if (!section) return [];

  const lines = splitLines(content);
  const tasks: TodoTask[] = [];

  for (let i = section.startLine; i < section.endLine; i++) {
    const match = checkboxRegex.exec(lines[i]);
    if (!match) continue;

    tasks.push({
      id: `${i}:${lines[i]}`,
      line: i,
      text: match[2].trim(),
      completed: match[1].toLowerCase() === 'x',
      raw: lines[i],
    });
  }

  return tasks;
}

export function addTaskToContent(
  content: string,
  heading: string,
  text: string,
  position: 'top' | 'bottom',
): string {
  const nextContent = ensureHeading(content, heading);
  const section = findHeadingSection(nextContent, heading);
  if (!section) return nextContent;

  const lines = splitLines(nextContent);
  const newLine = `- [ ] ${text.trim()}`;
  let insertAt = section.endLine;

  if (position === 'top') {
    insertAt = section.startLine;
    while (insertAt < section.endLine && lines[insertAt].trim() === '') {
      insertAt++;
    }
  } else {
    while (insertAt > section.startLine && lines[insertAt - 1].trim() === '') {
      insertAt--;
    }
  }

  if (insertAt === section.startLine && lines[insertAt]?.trim() !== '') {
    lines.splice(insertAt, 0, '', newLine);
  } else {
    lines.splice(insertAt, 0, newLine);
  }

  return joinLines(lines, nextContent);
}

function resolveTaskLine(lines: string[], task: TodoTask): number {
  if (lines[task.line] === task.raw) return task.line;
  return lines.findIndex((line) => line === task.raw);
}

export function toggleTaskInContent(content: string, task: TodoTask, completed: boolean): string | null {
  const lines = splitLines(content);
  const lineIndex = resolveTaskLine(lines, task);
  if (lineIndex === -1) return null;

  const match = checkboxRegex.exec(lines[lineIndex]);
  if (!match) return null;

  lines[lineIndex] = lines[lineIndex].replace(/\[([ xX])]\s+/, completed ? '[x] ' : '[ ] ');
  return joinLines(lines, content);
}

export function updateTaskInContent(content: string, task: TodoTask, text: string): string | null {
  const lines = splitLines(content);
  const lineIndex = resolveTaskLine(lines, task);
  if (lineIndex === -1) return null;

  const match = /^(\s*[-*]\s+\[[ xX]])\s+.*$/.exec(lines[lineIndex]);
  if (!match) return null;

  lines[lineIndex] = `${match[1]} ${text.trim()}`;
  return joinLines(lines, content);
}

export function deleteTaskFromContent(content: string, task: TodoTask): string | null {
  const lines = splitLines(content);
  const lineIndex = resolveTaskLine(lines, task);
  if (lineIndex === -1) return null;

  lines.splice(lineIndex, 1);
  return joinLines(lines, content);
}
