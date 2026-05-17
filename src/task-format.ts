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

export function validateTaskScheduleInput(input: TaskScheduleInput): string | null {
  const startDate = normalizeScheduleValue(input.startDate);
  const endDate = normalizeScheduleValue(input.endDate);

  if (!startDate && endDate) return '填写结束时间前，请先填写开始时间';
  if (startDate && endDate && toMoment(endDate).isBefore(toMoment(startDate))) {
    return '结束时间不能早于开始时间';
  }

  return null;
}

function normalizeScheduleValue(value?: string): string | undefined {
  const normalized = value?.trim().replace('T', ' ');
  return normalized || undefined;
}

function toMoment(value: string): moment.Moment {
  const format = value.includes(':') ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD';
  return window.moment(value, format);
}
