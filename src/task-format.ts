export interface TaskScheduleInput {
  text: string;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  priority?: string;
}

export function formatTaskInput(input: TaskScheduleInput): string {
  const startDate = normalizeScheduleValue(input.startDate);
  const endDate = normalizeScheduleValue(input.endDate);
  const dueDate = normalizeScheduleValue(input.dueDate);
  const parts = [input.text.trim()];

  if (startDate) parts.push(`[start:: ${startDate}]`);
  if (endDate) parts.push(`[end:: ${endDate}]`);
  if (!startDate && !endDate && dueDate) {
    parts.push(`[due:: ${dueDate}]`);
  }
  if (input.priority) parts.push(`[priority:: ${input.priority}]`);

  return parts.join(' ');
}

function normalizeScheduleValue(value?: string): string | undefined {
  const normalized = value?.trim().replace('T', ' ');
  return normalized || undefined;
}
