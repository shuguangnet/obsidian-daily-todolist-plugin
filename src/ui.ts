import type { PriorityOption } from './types';

export function renderPriorityBadge(
  parent: HTMLElement,
  priorityOptions: PriorityOption[],
  priority?: string,
): void {
  const option = getPriorityOption(priorityOptions, priority);
  if (!option) return;

  const badge = parent.createSpan({ cls: 'daily-todolist-priority-badge', text: option.label });
  badge.style.setProperty('--daily-todolist-priority-color', option.color);
}

export function getPriorityOption(
  priorityOptions: PriorityOption[],
  priority?: string,
): PriorityOption | undefined {
  if (!priority) return undefined;
  return priorityOptions.find((option) => option.id === priority || option.label === priority);
}

export function toDateTimeInputValue(value?: string): string | undefined {
  return value?.replace(' ', 'T');
}
