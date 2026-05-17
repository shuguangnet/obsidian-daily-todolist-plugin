import { ItemView, MarkdownRenderer, Notice, TFile, WorkspaceLeaf } from 'obsidian';
import type DailyTodoListPlugin from './main';
import { getDailyNotePathForDate, getOrCreateTodayDailyNote, openTodayDailyNote } from './daily-note';
import {
  addTaskToContent,
  deleteTaskFromContent,
  parseTasksFromContent,
  toggleTaskInContent,
  updateTaskInContent,
} from './markdown-tasks';
import { buildCalendarGrid, getMonthSummaries } from './calendar';
import { createMermaidGantt, enrichTask, readTasksForDateRange, scheduledTasks } from './schedule';
import { addMemoToContent, deleteMemoFromContent, parseMemosFromContent, readMemosForDateRange } from './memos';
import { formatTaskInput, validateTaskScheduleInput } from './task-format';
import { EditTaskModal } from './edit-task-modal';
import { getPriorityOption, renderPriorityBadge } from './ui';
import type { CalendarDaySummary, DailyMemo, DailyTask, TodoTask } from './types';

export const DAILY_TODOLIST_VIEW_TYPE = 'daily-todolist-view';
export type DailyTodoListTab = 'home' | 'today' | 'memo' | 'calendar' | 'gantt' | 'stats';
type GanttRangePreset = 'week' | 'month' | 'quarter' | null;

function parseGanttMoment(value: string, endOfDay = false): moment.Moment {
  const format = value.includes(':') ? 'YYYY-MM-DD HH:mm' : 'YYYY-MM-DD';
  const parsed = window.moment(value.replace('T', ' '), format);
  return endOfDay && !value.includes(':') ? parsed.endOf('day') : parsed;
}

export class DailyTodoListView extends ItemView {
  private plugin: DailyTodoListPlugin;
  private inputEl: HTMLInputElement | null = null;
  private startDateEl: HTMLInputElement | null = null;
  private endDateEl: HTMLInputElement | null = null;
  private dueDateEl: HTMLInputElement | null = null;
  private priorityEl: HTMLSelectElement | null = null;
  private memoInputEl: HTMLTextAreaElement | null = null;
  private activeTab: DailyTodoListTab;
  private selectedDate = window.moment().format('YYYY-MM-DD');
  private currentMonth = window.moment().format('YYYY-MM');
  private ganttRangePreset: GanttRangePreset = null;
  private refreshId = 0;
  private monthCache = new Map<string, CalendarDaySummary[]>();
  private rangeCache = new Map<string, DailyTask[]>();

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
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const refreshId = ++this.refreshId;
    const container = this.containerEl.children[1];
    container.empty();
    const root = container.createDiv({ cls: 'daily-todolist-view' });
    this.renderHeader(root);
    const body = root.createDiv({ cls: 'daily-todolist-body' });

    requestAnimationFrame(() => {
      void this.renderActiveTab(body, refreshId);
    });
  }

  private async renderActiveTab(root: HTMLElement, refreshId: number): Promise<void> {
    root.createDiv({ cls: 'daily-todolist-loading', text: '正在整理你的待办...' });

    if (this.activeTab === 'home') {
      await this.renderHome(root, refreshId);
    } else if (this.activeTab === 'calendar') {
      await this.renderCalendar(root, refreshId);
    } else if (this.activeTab === 'gantt') {
      await this.renderGantt(root, refreshId);
    } else if (this.activeTab === 'memo') {
      await this.renderMemo(root, refreshId);
    } else if (this.activeTab === 'stats') {
      await this.renderStats(root, refreshId);
    } else {
      await this.renderToday(root, refreshId);
    }
  }

  private canRender(refreshId: number): boolean {
    return refreshId === this.refreshId;
  }

  private renderHeader(root: HTMLElement): void {
    const header = root.createDiv({ cls: 'daily-todolist-header' });
    header.createDiv({ cls: 'daily-todolist-title', text: 'Daily TodoList' });
    header.createDiv({ text: window.moment().format('YYYY-MM-DD') });

    const tabs = root.createDiv({ cls: 'daily-todolist-tabs daily-todolist-tabs-wide' });
    this.renderTabButton(tabs, 'home', '首页');
    this.renderTabButton(tabs, 'today', '今日');
    this.renderTabButton(tabs, 'memo', '备忘录');
    this.renderTabButton(tabs, 'calendar', '日历');
    this.renderTabButton(tabs, 'gantt', '甘特图');
    this.renderTabButton(tabs, 'stats', '统计');
  }

  private renderTabButton(parent: HTMLElement, tab: DailyTodoListTab, text: string): void {
    const button = parent.createEl('button', {
      text,
      cls: this.activeTab === tab ? 'daily-todolist-tab is-active' : 'daily-todolist-tab',
    });
    button.addEventListener('click', () => this.setTab(tab));
  }

  private async renderToday(root: HTMLElement, refreshId: number): Promise<void> {
    root.empty();
    const compose = root.createDiv({ cls: 'daily-todolist-compose' });
    compose.createDiv({ cls: 'daily-todolist-compose-title', text: '快速捕捉' });
    this.inputEl = compose.createEl('input', {
      type: 'text',
      cls: 'daily-todolist-input',
      attr: { placeholder: '写下今天最重要的一件事...' },
    });
    this.inputEl.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter') await this.addTodoFromInput();
    });

    const dateGrid = compose.createDiv({ cls: 'daily-todolist-date-grid' });
    this.startDateEl = this.createDateInput(dateGrid, '开始', 'start');
    this.endDateEl = this.createDateInput(dateGrid, '结束', 'end');
    this.dueDateEl = this.createDateInput(dateGrid, '到期', 'due');
    this.priorityEl = this.createPrioritySelect(compose);

    compose.createEl('button', { cls: 'daily-todolist-add-button', text: '添加到今日' })
      .addEventListener('click', () => this.addTodoFromInput());

    const actions = root.createDiv({ cls: 'daily-todolist-actions' });
    actions.createEl('button', { text: '打开今日笔记' }).addEventListener('click', () => {
      openTodayDailyNote(this.app, this.plugin.settings);
    });
    actions.createEl('button', { text: '刷新' }).addEventListener('click', () => this.refresh());

    const file = await getOrCreateTodayDailyNote(this.app, this.plugin.settings);
    if (!this.canRender(refreshId)) return;
    if (!file) {
      root.createDiv({ cls: 'daily-todolist-empty', text: '今日 Daily Note 不存在。' });
      return;
    }

    const tasks = await this.readTasks(file);
    if (!this.canRender(refreshId)) return;
    this.renderTaskList(root, file, tasks, '今天还没有待办。');
  }

  private createDateInput(parent: HTMLElement, label: string, type: string): HTMLInputElement {
    const field = parent.createDiv({ cls: 'daily-todolist-field' });
    field.createDiv({ cls: 'daily-todolist-field-label', text: label });
    return field.createEl('input', {
      type: 'datetime-local',
      cls: 'daily-todolist-date-input',
      attr: { 'aria-label': `${label}日期时间`, 'data-date-type': type },
    });
  }

  private createPrioritySelect(parent: HTMLElement): HTMLSelectElement {
    const field = parent.createDiv({ cls: 'daily-todolist-field' });
    field.createDiv({ cls: 'daily-todolist-field-label', text: '优先级' });
    const select = field.createEl('select', { cls: 'daily-todolist-priority-select' });
    select.createEl('option', { text: '无优先级', value: '' });
    for (const option of this.plugin.settings.priorityOptions) {
      select.createEl('option', { text: option.label, value: option.id });
    }
    return select;
  }

  private async renderHome(root: HTMLElement, refreshId: number): Promise<void> {
    root.empty();
    const today = window.moment().format('YYYY-MM-DD');
    const { start, end } = this.getMonthRange();
    const [tasks, memos] = await Promise.all([
      this.getRangeTasks(start, end),
      readMemosForDateRange(this.app, this.plugin.settings, start, end),
    ]);
    if (!this.canRender(refreshId)) return;

    const todayTasks = tasks.filter((task) => task.date === today);
    const todayMemos = memos.filter((memo) => memo.date === today);
    const completed = tasks.filter((task) => task.completed).length;
    const planned = scheduledTasks(tasks);

    const hero = root.createDiv({ cls: 'daily-todolist-home-hero' });
    hero.createDiv({ cls: 'daily-todolist-gantt-kicker', text: 'Daily Overview' });
    hero.createDiv({ cls: 'daily-todolist-gantt-hero-title', text: '今日文档概览' });
    hero.createDiv({
      cls: 'daily-todolist-gantt-hero-subtitle',
      text: `${today} · 本月 ${tasks.length} 个待办 / ${memos.length} 条备忘录`,
    });

    const cards = root.createDiv({ cls: 'daily-todolist-overview-grid' });
    this.renderOverviewCard(cards, '今日待办', `${todayTasks.filter((task) => task.completed).length}/${todayTasks.length}`, '完成进度');
    this.renderOverviewCard(cards, '今日备忘录', String(todayMemos.length), this.plugin.settings.memoHeading);
    this.renderOverviewCard(cards, '本月排期', String(planned.length), `${start} → ${end}`);
    this.renderOverviewCard(cards, '本月完成率', tasks.length === 0 ? '0%' : `${Math.round((completed / tasks.length) * 100)}%`, `${completed}/${tasks.length}`);

    const quick = root.createDiv({ cls: 'daily-todolist-home-actions' });
    this.renderQuickTabButton(quick, 'today', '记录待办');
    this.renderQuickTabButton(quick, 'memo', '写备忘录');
    this.renderQuickTabButton(quick, 'stats', '查看统计');
    quick.createEl('button', { text: '打开今日笔记' }).addEventListener('click', () => {
      openTodayDailyNote(this.app, this.plugin.settings);
    });

    root.createEl('h3', { text: '今日待办' });
    const file = await getOrCreateTodayDailyNote(this.app, this.plugin.settings);
    if (!this.canRender(refreshId)) return;
    if (file) this.renderTaskList(root, file, todayTasks, '今天还没有待办。');

    root.createEl('h3', { text: '最近备忘录' });
    this.renderMemoList(root, memos.slice(-5).reverse(), '本月还没有备忘录。');
  }

  private async renderMemo(root: HTMLElement, refreshId: number): Promise<void> {
    root.empty();
    const compose = root.createDiv({ cls: 'daily-todolist-compose daily-todolist-memo-compose' });
    compose.createDiv({ cls: 'daily-todolist-compose-title', text: '备忘录速记' });
    this.memoInputEl = compose.createEl('textarea', {
      cls: 'daily-todolist-input daily-todolist-memo-input',
      attr: { placeholder: '记录灵感、会议结论或今日备注...' },
    });
    this.memoInputEl.addEventListener('keydown', async (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') await this.addMemoFromInput();
    });
    compose.createEl('button', { cls: 'daily-todolist-add-button', text: '添加备忘录' })
      .addEventListener('click', () => this.addMemoFromInput());

    const file = await getOrCreateTodayDailyNote(this.app, this.plugin.settings);
    if (!this.canRender(refreshId)) return;
    if (!file) {
      root.createDiv({ cls: 'daily-todolist-empty', text: '今日 Daily Note 不存在。' });
      return;
    }

    const memos = await this.readMemos(file);
    if (!this.canRender(refreshId)) return;
    root.createDiv({ cls: 'daily-todolist-stats', text: `今日 ${memos.length} 条备忘录` });
    this.renderMemoList(root, memos, '今天还没有备忘录。', file);
  }

  private async renderStats(root: HTMLElement, refreshId: number): Promise<void> {
    root.empty();
    const { start, end } = this.getMonthRange();
    const [tasks, memos] = await Promise.all([
      this.getRangeTasks(start, end),
      readMemosForDateRange(this.app, this.plugin.settings, start, end),
    ]);
    if (!this.canRender(refreshId)) return;

    const completed = tasks.filter((task) => task.completed).length;
    const active = tasks.length - completed;
    const planned = scheduledTasks(tasks);
    const overdue = planned.filter((task) => {
      const endDate = task.endDate ?? task.dueDate ?? task.startDate;
      return !task.completed && endDate && parseGanttMoment(endDate, true).isBefore(window.moment());
    }).length;
    const memoDays = new Set(memos.map((memo) => memo.date)).size;

    root.createDiv({ cls: 'daily-todolist-stats-title', text: `${window.moment(start).format('YYYY年MM月')} 统计` });
    const cards = root.createDiv({ cls: 'daily-todolist-overview-grid' });
    this.renderOverviewCard(cards, '待办总数', String(tasks.length), `${completed} 已完成 / ${active} 未完成`);
    this.renderOverviewCard(cards, '完成率', tasks.length === 0 ? '0%' : `${Math.round((completed / tasks.length) * 100)}%`, 'TodoList');
    this.renderOverviewCard(cards, '排期任务', String(planned.length), overdue > 0 ? `${overdue} 个已逾期` : '无逾期');
    this.renderOverviewCard(cards, '备忘录', String(memos.length), `${memoDays} 天有记录`);

    const bars = root.createDiv({ cls: 'daily-todolist-stats-bars' });
    this.renderStatsBar(bars, '已完成', completed, tasks.length);
    this.renderStatsBar(bars, '未完成', active, tasks.length);
    this.renderStatsBar(bars, '有排期', planned.length, tasks.length);
    this.renderStatsBar(bars, '备忘录活跃天', memoDays, window.moment(end).diff(window.moment(start), 'days') + 1);

    root.createEl('h3', { text: '最近备忘录' });
    this.renderMemoList(root, memos.slice(-8).reverse(), '本月还没有备忘录。');
  }

  private getMonthRange(): { start: string; end: string } {
    const current = window.moment(this.currentMonth, 'YYYY-MM');
    return {
      start: current.clone().startOf('month').format('YYYY-MM-DD'),
      end: current.clone().endOf('month').format('YYYY-MM-DD'),
    };
  }

  private renderOverviewCard(parent: HTMLElement, label: string, value: string, detail: string): void {
    const card = parent.createDiv({ cls: 'daily-todolist-overview-card' });
    card.createDiv({ cls: 'daily-todolist-overview-value', text: value });
    card.createDiv({ cls: 'daily-todolist-overview-label', text: label });
    card.createDiv({ cls: 'daily-todolist-overview-detail', text: detail });
  }

  private renderQuickTabButton(parent: HTMLElement, tab: DailyTodoListTab, text: string): void {
    parent.createEl('button', { text }).addEventListener('click', () => this.setTab(tab));
  }

  private renderStatsBar(parent: HTMLElement, label: string, value: number, total: number): void {
    const row = parent.createDiv({ cls: 'daily-todolist-stats-bar-row' });
    row.createDiv({ cls: 'daily-todolist-stats-bar-label', text: `${label} · ${value}` });
    const track = row.createDiv({ cls: 'daily-todolist-stats-bar-track' });
    const fill = track.createDiv({ cls: 'daily-todolist-stats-bar-fill' });
    fill.style.width = `${total === 0 ? 0 : Math.round((value / total) * 100)}%`;
  }

  private async renderCalendar(root: HTMLElement, refreshId: number): Promise<void> {
    root.empty();
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

    const summaries = await this.getMonthSummaries(this.currentMonth);
    if (!this.canRender(refreshId)) return;
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

    await this.renderSelectedDate(root, refreshId);
  }

  private async getMonthSummaries(month: string): Promise<CalendarDaySummary[]> {
    const cached = this.monthCache.get(month);
    if (cached) return cached;

    const summaries = await getMonthSummaries(this.app, this.plugin.settings, month);
    this.monthCache.set(month, summaries);
    return summaries;
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

  private async renderSelectedDate(root: HTMLElement, refreshId: number): Promise<void> {
    root.createEl('h3', { text: `${this.selectedDate} 待办` });
    const path = getDailyNotePathForDate(this.app, this.plugin.settings, this.selectedDate);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      root.createDiv({ cls: 'daily-todolist-empty', text: '该日期没有 Daily Note。' });
      return;
    }

    const tasks = await this.readTasks(file, this.selectedDate, path);
    if (!this.canRender(refreshId)) return;
    this.renderTaskList(root, file, tasks, '该日期没有待办。');
  }

  private async renderGantt(root: HTMLElement, refreshId: number): Promise<void> {
    root.empty();
    const { start, end } = this.getGanttRange();
    this.renderGanttRangeShortcuts(root);
    const tasks = await this.getRangeTasks(start, end);
    if (!this.canRender(refreshId)) return;

    const planned = scheduledTasks(tasks);
    this.renderGanttHero(root, planned, start, end);

    if (planned.length === 0) {
      root.createDiv({ cls: 'daily-todolist-empty', text: '当前范围内没有带排期的任务。' });
      return;
    }

    this.renderGanttSummary(root, planned);
    this.renderGanttTimeline(root, planned, start, end);
  }

  private getGanttRange(): { start: string; end: string } {
    const today = window.moment();
    if (this.ganttRangePreset === 'week') {
      return {
        start: today.clone().startOf('week').format('YYYY-MM-DD'),
        end: today.clone().endOf('week').format('YYYY-MM-DD'),
      };
    }
    if (this.ganttRangePreset === 'month') {
      return {
        start: today.clone().startOf('month').format('YYYY-MM-DD'),
        end: today.clone().endOf('month').format('YYYY-MM-DD'),
      };
    }
    if (this.ganttRangePreset === 'quarter') {
      return {
        start: today.clone().startOf('quarter').format('YYYY-MM-DD'),
        end: today.clone().endOf('quarter').format('YYYY-MM-DD'),
      };
    }

    return {
      start: today.clone().subtract(this.plugin.settings.ganttLookbackDays, 'day').format('YYYY-MM-DD'),
      end: today.clone().add(this.plugin.settings.ganttLookaheadDays, 'day').format('YYYY-MM-DD'),
    };
  }

  private renderGanttRangeShortcuts(root: HTMLElement): void {
    const toolbar = root.createDiv({ cls: 'daily-todolist-gantt-range' });
    this.renderGanttRangeButton(toolbar, null, '设置范围');
    this.renderGanttRangeButton(toolbar, 'week', '本周');
    this.renderGanttRangeButton(toolbar, 'month', '本月');
    this.renderGanttRangeButton(toolbar, 'quarter', '本季度');
  }

  private renderGanttRangeButton(parent: HTMLElement, preset: GanttRangePreset, text: string): void {
    const button = parent.createEl('button', {
      cls: this.ganttRangePreset === preset ? 'daily-todolist-tab is-active' : 'daily-todolist-tab',
      text,
    });
    button.addEventListener('click', async () => {
      if (this.ganttRangePreset === preset) return;
      this.ganttRangePreset = preset;
      await this.refresh();
    });
  }

  private async getRangeTasks(start: string, end: string): Promise<DailyTask[]> {
    const cacheKey = `${start}:${end}`;
    const cached = this.rangeCache.get(cacheKey);
    if (cached) return cached;

    const tasks = await readTasksForDateRange(this.app, this.plugin.settings, start, end);
    this.rangeCache.set(cacheKey, tasks);
    return tasks;
  }

  private renderGanttHero(root: HTMLElement, tasks: DailyTask[], start: string, end: string): void {
    const hero = root.createDiv({ cls: 'daily-todolist-gantt-hero' });
    const copy = hero.createDiv({ cls: 'daily-todolist-gantt-hero-copy' });
    copy.createDiv({ cls: 'daily-todolist-gantt-kicker', text: 'Timeline Board' });
    copy.createDiv({ cls: 'daily-todolist-gantt-hero-title', text: '排期总览' });
    copy.createDiv({
      cls: 'daily-todolist-gantt-hero-subtitle',
      text: `${window.moment(start).format('MM月DD日')} - ${window.moment(end).format('MM月DD日')} · ${tasks.length} 个排期任务`,
    });

    const metrics = hero.createDiv({ cls: 'daily-todolist-gantt-metrics' });
    this.renderGanttMetric(metrics, '总任务', String(tasks.length));
    this.renderGanttMetric(metrics, '已完成', String(tasks.filter((task) => task.completed).length));
    this.renderGanttMetric(metrics, '进行中', String(tasks.filter((task) => !task.completed).length));
  }

  private renderGanttMetric(parent: HTMLElement, label: string, value: string): void {
    const metric = parent.createDiv({ cls: 'daily-todolist-gantt-metric' });
    metric.createDiv({ cls: 'daily-todolist-gantt-metric-value', text: value });
    metric.createDiv({ cls: 'daily-todolist-gantt-metric-label', text: label });
  }

  private renderGanttSummary(root: HTMLElement, tasks: DailyTask[]): void {
    const preview = root.createDiv({ cls: 'daily-todolist-gantt-preview' });
    preview.createDiv({ cls: 'daily-todolist-gantt-preview-title', text: `${tasks.length} 个排期任务` });
    const renderButton = preview.createEl('button', {
      cls: 'daily-todolist-add-button',
      text: '渲染 Mermaid 甘特图',
    });
    renderButton.addEventListener('click', async () => {
      renderButton.detach();
      await MarkdownRenderer.render(this.app, createMermaidGantt(tasks), preview, '', this);
    });
  }

  private renderGanttTimeline(root: HTMLElement, tasks: DailyTask[], rangeStart: string, rangeEnd: string): void {
    const start = window.moment(rangeStart, 'YYYY-MM-DD').startOf('day');
    const end = window.moment(rangeEnd, 'YYYY-MM-DD').endOf('day');
    const totalMinutes = Math.max(1, end.diff(start, 'minutes'));
    const timeline = root.createDiv({ cls: 'daily-todolist-gantt-timeline' });

    this.renderGanttScale(timeline, start, end);
    this.renderTodayMarker(timeline, start, totalMinutes);
    for (const task of tasks) {
      this.renderGanttBar(timeline, task, start, totalMinutes);
    }
  }

  private renderGanttScale(parent: HTMLElement, start: moment.Moment, end: moment.Moment): void {
    const scale = parent.createDiv({ cls: 'daily-todolist-gantt-scale' });
    const months = scale.createDiv({ cls: 'daily-todolist-gantt-scale-months' });
    const days = scale.createDiv({ cls: 'daily-todolist-gantt-scale-days' });
    const cursor = start.clone().startOf('day');
    let currentMonth = '';

    while (cursor.isSameOrBefore(end, 'day')) {
      const month = cursor.format('YYYY-MM');
      if (month !== currentMonth) {
        currentMonth = month;
        months.createDiv({ cls: 'daily-todolist-gantt-scale-month', text: cursor.format('YYYY MMM') });
      }
      days.createDiv({
        cls: cursor.isSame(window.moment(), 'day')
          ? 'daily-todolist-gantt-scale-day is-today'
          : 'daily-todolist-gantt-scale-day',
        text: cursor.format('DD'),
      });
      cursor.add(1, 'day');
    }
  }

  private renderTodayMarker(parent: HTMLElement, rangeStart: moment.Moment, totalMinutes: number): void {
    const now = window.moment();
    const left = (now.diff(rangeStart, 'minutes') / totalMinutes) * 100;
    if (left < 0 || left > 100) return;

    const marker = parent.createDiv({ cls: 'daily-todolist-gantt-today-marker' });
    marker.style.left = `calc(112px + (100% - 112px) * ${left / 100})`;
    marker.createSpan({ text: 'Today' });
  }

  private renderGanttBar(parent: HTMLElement, task: DailyTask, rangeStart: moment.Moment, totalMinutes: number): void {
    const start = parseGanttMoment(task.startDate ?? task.dueDate ?? task.date);
    const end = parseGanttMoment(task.endDate ?? task.dueDate ?? task.startDate ?? task.date, true);
    const left = Math.max(0, Math.min(96, (start.diff(rangeStart, 'minutes') / totalMinutes) * 100));
    const width = Math.max(4, Math.min(100 - left, (end.diff(start, 'minutes') / totalMinutes) * 100));
    const option = getPriorityOption(this.plugin.settings.priorityOptions, task.priority);
    const isOverdue = !task.completed && end.isBefore(window.moment());
    const row = parent.createDiv({ cls: isOverdue ? 'daily-todolist-gantt-row is-overdue' : 'daily-todolist-gantt-row' });
    row.addEventListener('click', async () => {
      await this.openTaskSource(task);
    });
    const label = row.createDiv({ cls: 'daily-todolist-gantt-row-label' });
    label.createDiv({ cls: 'daily-todolist-gantt-row-title', text: task.displayText || task.text });
    label.createDiv({ cls: 'daily-todolist-gantt-row-date', text: `${start.format('MM-DD HH:mm')} → ${end.format('MM-DD HH:mm')}` });

    const track = row.createDiv({ cls: 'daily-todolist-gantt-track' });
    const bar = track.createDiv({ cls: task.completed ? 'daily-todolist-gantt-bar is-done' : 'daily-todolist-gantt-bar' });
    bar.style.left = `${left}%`;
    bar.style.width = `${width}%`;
    bar.style.setProperty('--daily-todolist-priority-color', option?.color ?? 'var(--dtl-accent)');
    bar.createSpan({ cls: 'daily-todolist-gantt-bar-title', text: task.displayText || task.text });
    renderPriorityBadge(bar, this.plugin.settings.priorityOptions, task.priority);
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

  private async readMemos(
    file: TFile,
    date = window.moment().format('YYYY-MM-DD'),
    path = file.path,
  ): Promise<DailyMemo[]> {
    const content = await this.app.vault.read(file);
    return parseMemosFromContent(content, this.plugin.settings.memoHeading)
      .map((memo) => ({ ...memo, date, filePath: path }));
  }

  private renderMemoList(root: HTMLElement, memos: DailyMemo[], emptyText: string, file?: TFile): void {
    const list = root.createDiv({ cls: 'daily-todolist-list daily-todolist-memo-list' });
    if (memos.length === 0) {
      list.createDiv({ cls: 'daily-todolist-empty', text: emptyText });
      return;
    }

    for (const memo of memos) {
      const item = list.createDiv({ cls: 'daily-todolist-item daily-todolist-memo-item' });
      const text = item.createDiv({ cls: 'daily-todolist-item-text', text: memo.text });
      text.createDiv({ cls: 'daily-todolist-task-meta', text: memo.date });
      const actions = item.createDiv({ cls: 'daily-todolist-task-actions' });
      actions.createEl('button', { cls: 'daily-todolist-edit', text: '打开' })
        .addEventListener('click', async () => this.openMemoSource(memo));
      if (file) {
        actions.createEl('button', { cls: 'daily-todolist-delete', text: '删除' })
          .addEventListener('click', async () => this.deleteMemo(file, memo));
      }
    }
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
    renderPriorityBadge(text, this.plugin.settings.priorityOptions, task.priority);
    if (task.startDate || task.endDate || task.dueDate) {
      text.createDiv({
        cls: 'daily-todolist-task-meta',
        text: `${task.startDate ?? task.dueDate ?? ''}${task.endDate ? ` → ${task.endDate}` : ''}`,
      });
    }

    const taskActions = item.createDiv({ cls: 'daily-todolist-task-actions' });
    taskActions.createEl('button', { cls: 'daily-todolist-edit', text: '编辑' })
      .addEventListener('click', () => this.openEditTaskModal(file, task));
    taskActions.createEl('button', { cls: 'daily-todolist-delete', text: '删除' })
      .addEventListener('click', async () => {
        await this.deleteTask(file, task);
      });
  }

  private async openTaskSource(task: DailyTask): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(task.filePath);
    if (!(file instanceof TFile)) {
      new Notice('来源 Daily Note 不存在');
      return;
    }

    await this.app.workspace.getLeaf(false).openFile(file);
  }

  private async openMemoSource(memo: DailyMemo): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(memo.filePath);
    if (!(file instanceof TFile)) {
      new Notice('来源 Daily Note 不存在');
      return;
    }

    await this.app.workspace.getLeaf(false).openFile(file);
  }

  private openEditTaskModal(file: TFile, task: TodoTask): void {
    new EditTaskModal(this.app, task, this.plugin.settings.priorityOptions, async (value) => {
      const taskText = formatTaskInput(value);
      const content = await this.app.vault.read(file);
      const nextContent = updateTaskInContent(content, task, taskText);
      if (nextContent === null) {
        new Notice('任务已变化，请刷新后重试');
        await this.refresh();
        return;
      }

      await this.app.vault.modify(file, nextContent);
      this.clearCaches();
      await this.refresh();
    }).open();
  }


  private async addTodoFromInput(): Promise<void> {
    const text = this.inputEl?.value.trim() ?? '';
    if (!text) return;

    const input = {
      text,
      startDate: this.startDateEl?.value.trim(),
      endDate: this.endDateEl?.value.trim(),
      dueDate: this.dueDateEl?.value.trim(),
      priority: this.priorityEl?.value,
    };
    const error = validateTaskScheduleInput(input);
    if (error) {
      new Notice(error);
      return;
    }

    const taskText = formatTaskInput(input);
    const file = await getOrCreateTodayDailyNote(this.app, this.plugin.settings);
    if (!file) return;

    const content = await this.app.vault.read(file);
    const nextContent = addTaskToContent(
      content,
      this.plugin.settings.todoHeading,
      taskText,
      this.plugin.settings.insertPosition,
    );
    await this.app.vault.modify(file, nextContent);
    this.clearCaches();
    if (this.inputEl) this.inputEl.value = '';
    if (this.startDateEl) this.startDateEl.value = '';
    if (this.endDateEl) this.endDateEl.value = '';
    if (this.dueDateEl) this.dueDateEl.value = '';
    if (this.priorityEl) this.priorityEl.value = '';
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
    this.clearCaches();
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
    this.clearCaches();
    await this.refresh();
  }

  private async addMemoFromInput(): Promise<void> {
    const text = this.memoInputEl?.value.trim() ?? '';
    if (!text) return;

    const file = await getOrCreateTodayDailyNote(this.app, this.plugin.settings);
    if (!file) return;

    const content = await this.app.vault.read(file);
    const nextContent = addMemoToContent(content, this.plugin.settings.memoHeading, text);
    await this.app.vault.modify(file, nextContent);
    this.clearCaches();
    if (this.memoInputEl) this.memoInputEl.value = '';
    await this.refresh();
  }

  private async deleteMemo(file: TFile, memo: DailyMemo): Promise<void> {
    const content = await this.app.vault.read(file);
    const nextContent = deleteMemoFromContent(content, memo);
    if (nextContent === null) {
      new Notice('备忘录已变化，请刷新后重试');
      await this.refresh();
      return;
    }

    await this.app.vault.modify(file, nextContent);
    this.clearCaches();
    await this.refresh();
  }

  private clearCaches(): void {
    this.monthCache.clear();
    this.rangeCache.clear();
  }
}
