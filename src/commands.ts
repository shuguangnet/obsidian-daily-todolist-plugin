import { App, Modal, Notice, Setting } from 'obsidian';
import type DailyTodoListPlugin from './main';
import { getOrCreateTodayDailyNote, openTodayDailyNote } from './daily-note';
import { addTaskToContent } from './markdown-tasks';
import { createMermaidGantt, readTasksForDateRange, scheduledTasks } from './schedule';
import { formatTaskInput, validateTaskScheduleInput } from './task-format';
import type { PriorityOption } from './types';

const ganttBlockMarker = '<!-- daily-todolist-gantt -->';
const ganttBlockRegex = /\n*<!-- daily-todolist-gantt -->\n```mermaid\n[\s\S]*?```/;

function upsertGanttBlock(content: string, gantt: string): string {
  const block = `${ganttBlockMarker}\n${gantt}`;
  if (ganttBlockRegex.test(content)) {
    return content.replace(ganttBlockRegex, `\n\n${block}`);
  }

  return `${content.replace(/[\r\n]+$/, '')}\n\n${block}\n`;
}

class AddTodoModal extends Modal {
  private text = '';
  private startDate = '';
  private endDate = '';
  private dueDate = '';
  private priority = '';
  private onSubmit: (text: string) => void;
  private priorityOptions: PriorityOption[];

  constructor(app: App, priorityOptions: PriorityOption[], onSubmit: (text: string) => void) {
    super(app);
    this.priorityOptions = priorityOptions;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    this.setTitle('添加今日待办');
    this.contentEl.addClass('daily-todolist-modal');
    this.contentEl.createDiv({
      cls: 'daily-todolist-modal-hint',
      text: '可选填写开始/结束时间，任务会自动进入甘特图排期。',
    });

    new Setting(this.contentEl)
      .setName('任务内容')
      .addText((text) => {
        text.setPlaceholder('输入待办事项')
          .onChange((value) => {
            this.text = value;
          });
        text.inputEl.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') this.submit();
        });
        text.inputEl.focus();
      });

    this.createDateTimePicker('开始时间', '可选，用于甘特图起点。', (value) => {
      this.startDate = value;
    });

    this.createDateTimePicker('结束时间', '可选，用于甘特图终点。', (value) => {
      this.endDate = value;
    });

    this.createDateTimePicker('到期时间', '可选；没有开始/结束时间时作为单日排期。', (value) => {
      this.dueDate = value;
    });

    this.createPriorityPicker();

    new Setting(this.contentEl)
      .addButton((button) => button
        .setButtonText('添加到今日')
        .setCta()
        .onClick(() => this.submit()));
  }

  private createDateTimePicker(name: string, desc: string, onChange: (value: string) => void): void {
    const setting = new Setting(this.contentEl)
      .setName(name)
      .setDesc(desc);
    const input = setting.controlEl.createEl('input', {
      type: 'datetime-local',
      cls: 'daily-todolist-date-input',
    });
    input.addEventListener('change', () => onChange(input.value.trim()));
  }

  private createPriorityPicker(): void {
    new Setting(this.contentEl)
      .setName('优先级')
      .setDesc('可选，用于任务列表颜色标记。')
      .addDropdown((dropdown) => {
        dropdown.addOption('', '无优先级');
        for (const option of this.priorityOptions) {
          dropdown.addOption(option.id, option.label);
        }
        dropdown.onChange((value) => {
          this.priority = value;
        });
      });
  }

  private submit(): void {
    const value = this.text.trim();
    if (!value) return;
    const input = {
      text: value,
      startDate: this.startDate,
      endDate: this.endDate,
      dueDate: this.dueDate,
      priority: this.priority,
    };
    const error = validateTaskScheduleInput(input);
    if (error) {
      new Notice(error);
      return;
    }

    this.close();
    this.onSubmit(formatTaskInput(input));
  }
}

export function registerDailyTodoListCommands(plugin: DailyTodoListPlugin): void {
  plugin.addCommand({
    id: 'open-daily-todolist-view',
    name: 'Open Vault Atlas HQ',
    callback: () => plugin.activateView(),
  });

  plugin.addCommand({
    id: 'add-todo-to-today',
    name: 'Add todo to today',
    callback: () => {
      new AddTodoModal(plugin.app, plugin.settings.priorityOptions, async (text) => {
        const file = await getOrCreateTodayDailyNote(plugin.app, plugin.settings);
        if (!file) return;

        const content = await plugin.app.vault.read(file);
        const nextContent = addTaskToContent(
          content,
          plugin.settings.todoHeading,
          text,
          plugin.settings.insertPosition,
        );
        await plugin.app.vault.modify(file, nextContent);
        new Notice('已添加今日待办');
        plugin.refreshViews();
      }).open();
    },
  });

  plugin.addCommand({
    id: 'open-calendar-view',
    name: 'Open Vault Atlas calendar',
    callback: async () => {
      await plugin.activateView('calendar');
    },
  });

  plugin.addCommand({
    id: 'open-gantt-view',
    name: 'Open Vault Atlas gantt',
    callback: async () => {
      await plugin.activateView('gantt');
    },
  });

  plugin.addCommand({
    id: 'insert-gantt-to-today',
    name: 'Insert Daily TodoList gantt to today note',
    callback: async () => {
      const start = window.moment().subtract(plugin.settings.ganttLookbackDays, 'day').format('YYYY-MM-DD');
      const end = window.moment().add(plugin.settings.ganttLookaheadDays, 'day').format('YYYY-MM-DD');
      const tasks = scheduledTasks(await readTasksForDateRange(plugin.app, plugin.settings, start, end));
      if (tasks.length === 0) {
        new Notice('当前范围内没有带排期的任务');
        return;
      }

      const file = await getOrCreateTodayDailyNote(plugin.app, plugin.settings);
      if (!file) return;

      const content = await plugin.app.vault.read(file);
      const nextContent = upsertGanttBlock(content, createMermaidGantt(tasks));
      await plugin.app.vault.modify(file, nextContent);
      new Notice(content === nextContent ? '甘特图已是最新' : '已更新甘特图到今日笔记');
    },
  });

  plugin.addCommand({
    id: 'open-today-daily-note',
    name: 'Open today daily note',
    callback: () => openTodayDailyNote(plugin.app, plugin.settings),
  });
}
