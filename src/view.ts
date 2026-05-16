import { ItemView, MarkdownRenderer, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import type DailyTodoListPlugin from './main';
import { getDailyNotePathForDate, getOrCreateTodayDailyNote, openTodayDailyNote } from './daily-note';
import {
  addTaskToContent,
  deleteTaskFromContent,
  parseTasksFromContent,
  toggleTaskInContent,
} from './markdown-tasks';
import { buildCalendarGrid, getMonthSummaries } from './calendar';
import { createMermaidGantt, enrichTask, readTasksForDateRange, scheduledTasks } from './schedule';
import type { CalendarDaySummary, DailyTask, TodoTask } from './types';

export const DAILY_TODOLIST_VIEW_TYPE = 'daily-todolist-view';
export type DailyTodoListTab = 'today' | 'calendar' | 'gantt';

export class DailyTodoListView extends ItemView {
  private plugin: DailyTodoListPlugin;
  private inputEl: HTMLInputElement | null = null;
  private activeTab: DailyTodoListTab;
  private selectedDate = window.moment().format('YYYY-MM-DD');
  private currentMonth = window.moment().format('YYYY-MM');

  constructor(leaf: WorkspaceLeaf, plugin: DailyTodoListPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.activeTab = plugin.settings.calendarDefaultView;
  }

  getViewType(): string {
    return DAILY_TODOLIST_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Daily TodoList';
  }

  getIcon(): string {
    return 'check-square';
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async setTab(tab: DailyTodoListTab): Promise<void> {
    this.activeTab = tab;
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    const root = container.createDiv({ cls: 'daily-todolist-view' });
    this.renderHeader(root);

    if (this.activeTab === 'calendar') {
      await this.renderCalendar(root);
    } else if (this.activeTab === 'gantt') {
      await this.renderGantt(root);
    } else {
      await this.renderToday(root);
    }
  }

  private renderHeader(root: HTMLElement): void {
    const header = root.createDiv({ cls: 'daily-todolist-header' });
    header.createDiv({ cls: 'daily-todolist-title', text: 'Daily TodoList' });
    header.createDiv({ text: window.moment().format('YYYY-MM-DD') });

    const tabs = root.createDiv({ cls: 'daily-todolist-tabs' });
    this.renderTabButton(tabs, 'today', '今日');
    this.renderTabButton(tabs, 'calendar', '日历');
    this.renderTabButton(tabs, 'gantt', '甘特图');
  }

  private renderTabButton(parent: HTMLElement, tab: DailyTodoListTab, text: string): void {
    const button = parent.createEl('button', {
      text,
      cls: this.activeTab === tab ? 'daily-todolist-tab is-active' : 'daily-todolist-tab',
    });
    button.addEventListener('click', () => this.setTab(tab));
  }

  private async renderToday(root: HTMLElement): Promise<void> {
    const inputRow = root.createDiv({ cls: 'daily-todolist-input-row' });
    this.inputEl = inputRow.createEl('input', {
      type: 'text',
      cls: 'daily-todolist-input',
      attr: { placeholder: '添加今日待办，可加 [start:: 2026-05-17] [end:: 2026-05-20]' },
    });
    this.inputEl.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter') await this.addTodoFromInput();
    });
    inputRow.createEl('button', { text: '添加' }).addEventListener('click', () => this.addTodoFromInput());

    const actions = root.createDiv({ cls: 'daily-todolist-actions' });
    actions.createEl('button', { text: '打开今日笔记' }).addEventListener('click', () => {
      openTodayDailyNote(this.app, this.plugin.settings);
    });
    actions.createEl('button', { text: '刷新' }).addEventListener('click', () => this.refresh());

    const file = await getOrCreateTodayDailyNote(this.app, this.plugin.settings);
    if (!file) {
      root.createDiv({ cls: 'daily-todolist-empty', text: '今日 Daily Note 不存在。' });
      return;
    }

    const tasks = await this.readTasks(file);
    this.renderTaskList(root, file, tasks, '今天还没有待办。');
  }

  private async renderCalendar(root: HTMLElement): Promise<void> {
    const toolbar = root.createDiv({ cls: 'daily-todolist-calendar-toolbar' });
    toolbar.createEl('button', { text: '上月' }).addEventListener('click', async () => {
      this.currentMonth = window.moment(this.currentMonth, 'YYYY-MM').subtract(1, 'month').format('YYYY-MM');
      await this.refresh();
    });
    toolbar.createDiv({ cls: 'daily-todolist-calendar-title', text: this.currentMonth });
    toolbar.createEl('button', { text: '下月' }).addEventListener('click', async () => {
      this.currentMonth = window.moment(this.currentMonth, 'YYYY-MM').add(1, 'month').format('YYYY-MM');
      await this.refresh();
    });

    const summaries = await getMonthSummaries(this.app, this.plugin.settings, this.currentMonth);
    const summaryMap = new Map(summaries.map((summary) => [summary.date, summary]));
    const grid = root.createDiv({ cls: 'daily-todolist-calendar-grid' });
    for (const weekday of ['日', '一', '二', '三', '四', '五', '六']) {
      grid.createDiv({ cls: 'daily-todolist-calendar-weekday', text: weekday });
    }

    for (const date of buildCalendarGrid(this.currentMonth)) {
      if (!date) {
        grid.createDiv({ cls: 'daily-todolist-calendar-day is-empty' });
        continue;
      }
      this.renderCalendarDay(grid, date, summaryMap.get(date));
    }

    await this.renderSelectedDate(root);
  }

  private renderCalendarDay(parent: HTMLElement, date: string, summary?: CalendarDaySummary): void {
    const day = parent.createDiv({
      cls: date === this.selectedDate
        ? 'daily-todolist-calendar-day is-selected'
        : 'daily-todolist-calendar-day',
    });
    day.createDiv({ cls: 'daily-todolist-calendar-date', text: window.moment(date).format('D') });
    if (summary && summary.total > 0) {
      day.createDiv({ cls: 'daily-todolist-calendar-count', text: `${summary.completed}/${summary.total}` });
    }
    if (summary && summary.scheduled > 0) {
      day.createDiv({ cls: 'daily-todolist-calendar-scheduled', text: `${summary.scheduled} 排期` });
    }
    day.addEventListener('click', async () => {
      this.selectedDate = date;
      await this.refresh();
    });
  }

  private async renderSelectedDate(root: HTMLElement): Promise<void> {
    root.createEl('h3', { text: `${this.selectedDate} 待办` });
    const path = getDailyNotePathForDate(this.app, this.plugin.settings, this.selectedDate);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      root.createDiv({ cls: 'daily-todolist-empty', text: '该日期没有 Daily Note。' });
      return;
    }

    const tasks = await this.readTasks(file, this.selectedDate, path);
    this.renderTaskList(root, file, tasks, '该日期没有待办。');
  }

  private async renderGantt(root: HTMLElement): Promise<void> {
    const start = window.moment().subtract(this.plugin.settings.ganttLookbackDays, 'day').format('YYYY-MM-DD');
    const end = window.moment().add(this.plugin.settings.ganttLookaheadDays, 'day').format('YYYY-MM-DD');
    const tasks = await readTasksForDateRange(this.app, this.plugin.settings, start, end);
    const planned = scheduledTasks(tasks);

    const tip = root.createDiv({ cls: 'daily-todolist-empty' });
    tip.setText('排期语法：在任务后添加 [start:: YYYY-MM-DD] [end:: YYYY-MM-DD]，或 [due:: YYYY-MM-DD] / 📅 YYYY-MM-DD。');

    if (planned.length === 0) {
      root.createDiv({ cls: 'daily-todolist-empty', text: '当前范围内没有带排期的任务。' });
      return;
    }

    const markdown = createMermaidGantt(planned);
    const preview = root.createDiv({ cls: 'daily-todolist-gantt-preview' });
    await MarkdownRenderer.render(this.app, markdown, preview, '', this);

    const details = root.createDiv({ cls: 'daily-todolist-list' });
    for (const task of planned) {
      const item = details.createDiv({ cls: 'daily-todolist-gantt-item' });
      item.createDiv({ cls: 'daily-todolist-item-text', text: task.displayText || task.text });
      const start = task.startDate ?? task.dueDate ?? task.date;
      const end = task.endDate ?? task.dueDate ?? task.startDate ?? task.date;
      item.createDiv({ cls: 'daily-todolist-stats', text: `${start} → ${end}` });
    }
  }

  private renderTaskList(root: HTMLElement, file: TFile, tasks: TodoTask[], emptyText: string): void {
    const visibleTasks = this.plugin.settings.showCompleted
      ? tasks
      : tasks.filter((task) => !task.completed);

    const total = tasks.length;
    const completed = tasks.filter((task) => task.completed).length;
    root.createDiv({ cls: 'daily-todolist-stats', text: `完成 ${completed}/${total}` });

    const list = root.createDiv({ cls: 'daily-todolist-list' });
    if (visibleTasks.length === 0) {
      list.createDiv({ cls: 'daily-todolist-empty', text: emptyText });
      return;
    }

    for (const task of visibleTasks) {
      this.renderTask(list, file, task);
    }
  }

  private async readTasks(
    file: TFile,
    date = window.moment().format('YYYY-MM-DD'),
    path = file.path,
  ): Promise<DailyTask[]> {
    const content = await this.app.vault.read(file);
    return parseTasksFromContent(content, this.plugin.settings.todoHeading)
      .map((task) => enrichTask(task, date, path));
  }

  private renderTask(list: HTMLElement, file: TFile, task: TodoTask): void {
    const item = list.createDiv({
      cls: task.completed
        ? 'daily-todolist-item daily-todolist-item-completed'
        : 'daily-todolist-item',
    });

    const checkbox = item.createEl('input', { type: 'checkbox' });
    checkbox.checked = task.completed;
    checkbox.addEventListener('change', async () => {
      await this.toggleTask(file, task, checkbox.checked);
    });

    const text = item.createDiv({ cls: 'daily-todolist-item-text', text: task.displayText || task.text });
    if (task.startDate || task.endDate || task.dueDate) {
      text.createDiv({
        cls: 'daily-todolist-task-meta',
        text: `${task.startDate ?? task.dueDate ?? ''}${task.endDate ? ` → ${task.endDate}` : ''}`,
      });
    }

    item.createEl('button', { cls: 'daily-todolist-delete', text: '删除' })
      .addEventListener('click', async () => {
        await this.deleteTask(file, task);
      });
  }

  private async addTodoFromInput(): Promise<void> {
    const text = this.inputEl?.value.trim() ?? '';
    if (!text) return;

    const file = await getOrCreateTodayDailyNote(this.app, this.plugin.settings);
    if (!file) return;

    const content = await this.app.vault.read(file);
    const nextContent = addTaskToContent(
      content,
      this.plugin.settings.todoHeading,
      text,
      this.plugin.settings.insertPosition,
    );
    await this.app.vault.modify(file, nextContent);
    if (this.inputEl) this.inputEl.value = '';
    await this.refresh();
  }

  private async toggleTask(file: TFile, task: TodoTask, completed: boolean): Promise<void> {
    const content = await this.app.vault.read(file);
    const nextContent = toggleTaskInContent(content, task, completed);
    if (nextContent === null) {
      new Notice('任务已变化，请刷新后重试');
      await this.refresh();
      return;
    }

    await this.app.vault.modify(file, nextContent);
    await this.refresh();
  }

  private async deleteTask(file: TFile, task: TodoTask): Promise<void> {
    const content = await this.app.vault.read(file);
    const nextContent = deleteTaskFromContent(content, task);
    if (nextContent === null) {
      new Notice('任务已变化，请刷新后重试');
      await this.refresh();
      return;
    }

    await this.app.vault.modify(file, nextContent);
    await this.refresh();
  }
}
