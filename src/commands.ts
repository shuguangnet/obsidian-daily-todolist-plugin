import { App, Modal, Notice, Setting } from 'obsidian';
import type DailyTodoListPlugin from './main';
import { getOrCreateTodayDailyNote, openTodayDailyNote } from './daily-note';
import { addTaskToContent } from './markdown-tasks';
import { createMermaidGantt, readTasksForDateRange, scheduledTasks } from './schedule';

class AddTodoModal extends Modal {
  private text = '';
  private onSubmit: (text: string) => void;

  constructor(app: App, onSubmit: (text: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    this.setTitle('添加今日待办');

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

    new Setting(this.contentEl)
      .addButton((button) => button
        .setButtonText('添加')
        .setCta()
        .onClick(() => this.submit()));
  }

  private submit(): void {
    const value = this.text.trim();
    if (!value) return;
    this.close();
    this.onSubmit(value);
  }
}

export function registerDailyTodoListCommands(plugin: DailyTodoListPlugin): void {
  plugin.addCommand({
    id: 'open-daily-todolist-view',
    name: 'Open Daily TodoList view',
    callback: () => plugin.activateView(),
  });

  plugin.addCommand({
    id: 'add-todo-to-today',
    name: 'Add todo to today',
    callback: () => {
      new AddTodoModal(plugin.app, async (text) => {
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
    name: 'Open Daily TodoList calendar',
    callback: async () => {
      await plugin.activateView('calendar');
    },
  });

  plugin.addCommand({
    id: 'open-gantt-view',
    name: 'Open Daily TodoList gantt',
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
      await plugin.app.vault.modify(file, `${content.replace(/[\r\n]+$/, '')}\n\n${createMermaidGantt(tasks)}\n`);
      new Notice('已插入甘特图到今日笔记');
    },
  });

  plugin.addCommand({
    id: 'open-today-daily-note',
    name: 'Open today daily note',
    callback: () => openTodayDailyNote(plugin.app, plugin.settings),
  });
}
