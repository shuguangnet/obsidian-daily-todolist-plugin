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
import { readJournalForDate, readJournalsForDateRange, upsertJournalInContent } from './journal';
import { runAIProviderCommand } from './ai-command';
import { formatTaskInput, validateTaskScheduleInput } from './task-format';
import { EditTaskModal } from './edit-task-modal';
import { getPriorityOption, renderPriorityBadge } from './ui';
import type {
  CalendarDaySummary,
  AICommandPanelState,
  AIContextAttachment,
  AIProviderConfig,
  AIRunHandle,
  DailyJournal,
  DailyMemo,
  DailyTask,
  RankedStat,
  TimelinePoint,
  TodoTask,
  VaultNoteProfile,
} from './types';

export const DAILY_TODOLIST_VIEW_TYPE = 'daily-todolist-view';
export type DailyTodoListTab = 'home' | 'today' | 'journal' | 'memo' | 'calendar' | 'gantt' | 'stats' | 'ai';
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
  private journalInputEl: HTMLTextAreaElement | null = null;
  private aiPromptEl: HTMLTextAreaElement | null = null;
  private aiProviderEl: HTMLSelectElement | null = null;
  private aiCurrentNoteToggleEl: HTMLInputElement | null = null;
  private aiTodayJournalToggleEl: HTMLInputElement | null = null;
  private aiTodayTasksToggleEl: HTMLInputElement | null = null;
  private aiRunHandle: AIRunHandle | null = null;
  private aiState: AICommandPanelState;
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
    this.aiState = {
      selectedProviderId: plugin.settings.aiProviders[0]?.id ?? 'claude-code',
      prompt: '',
      contextSelection: {
        currentNote: true,
        todayJournal: false,
        todayTasks: false,
      },
      execution: {
        status: 'idle',
        stdout: '',
        stderr: '',
        commandSummary: '',
      },
    };
  }

  getViewType(): string {
    return DAILY_TODOLIST_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Vault Atlas HQ';
  }

  getIcon(): string {
    return 'layout-dashboard';
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
    if (this.isWideWorkspace()) root.addClass('is-wide-workspace');
    this.renderHeader(root);
    const body = root.createDiv({ cls: 'daily-todolist-body' });
    if (this.isWideWorkspace()) body.addClass('is-wide-workspace');

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
    } else if (this.activeTab === 'journal') {
      await this.renderJournal(root, refreshId);
    } else if (this.activeTab === 'stats') {
      await this.renderStats(root, refreshId);
    } else if (this.activeTab === 'ai') {
      await this.renderAI(root, refreshId);
    } else {
      await this.renderToday(root, refreshId);
    }
  }

  private canRender(refreshId: number): boolean {
    return refreshId === this.refreshId;
  }

  private isWideWorkspace(): boolean {
    return this.leaf.getRoot() !== this.app.workspace.rightSplit;
  }

  private renderHeader(root: HTMLElement): void {
    const header = root.createDiv({ cls: 'daily-todolist-header' });
    header.createDiv({ cls: 'daily-todolist-title', text: 'Vault Atlas HQ' });
    header.createDiv({ text: window.moment().format('YYYY-MM-DD') });

    const tabs = root.createDiv({ cls: 'daily-todolist-tabs daily-todolist-tabs-wide' });
    this.renderTabButton(tabs, 'home', '首页');
    this.renderTabButton(tabs, 'today', '今日');
    this.renderTabButton(tabs, 'journal', '日记');
    this.renderTabButton(tabs, 'memo', '备忘录');
    this.renderTabButton(tabs, 'calendar', '日历');
    this.renderTabButton(tabs, 'gantt', '甘特图');
    this.renderTabButton(tabs, 'stats', '统计');
    this.renderTabButton(tabs, 'ai', 'AI');
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
    const [tasks, memos, journals, analytics] = await Promise.all([
      this.getRangeTasks(start, end),
      readMemosForDateRange(this.app, this.plugin.settings, start, end),
      readJournalsForDateRange(this.app, this.plugin.settings, start, end),
      this.plugin.getVaultAnalytics(),
    ]);
    if (!this.canRender(refreshId)) return;

    const todayTasks = tasks.filter((task) => task.date === today);
    const todayMemos = memos.filter((memo) => memo.date === today);
    const todayJournal = journals.find((journal) => journal.date === today);
    const journalDays = journals.filter((journal) => journal.text.trim().length > 0).length;
    const hasJournalToday = Boolean(todayJournal?.text.trim());
    const hero = root.createDiv({ cls: 'daily-todolist-home-hero daily-todolist-atlas-hero' });
    hero.createDiv({ cls: 'daily-todolist-gantt-kicker', text: 'Knowledge Atlas' });
    hero.createDiv({ cls: 'daily-todolist-gantt-hero-title', text: '你的知识库总控台' });
    hero.createDiv({
      cls: 'daily-todolist-gantt-hero-subtitle',
      text: `${today} · ${analytics.totalNotes} 篇笔记 · ${analytics.totalTags} 个标签 · ${analytics.totalFolders} 个目录`,
    });
    const pulse = hero.createDiv({ cls: 'daily-todolist-atlas-pulse' });
    pulse.createDiv({
      cls: 'daily-todolist-atlas-pulse-value',
      text: analytics.weeklyGrowth >= 0 ? `+${analytics.weeklyGrowth}` : String(analytics.weeklyGrowth),
    });
    pulse.createDiv({ cls: 'daily-todolist-atlas-pulse-label', text: '近 7 天活跃变化' });

    const cards = root.createDiv({ cls: 'daily-todolist-overview-grid' });
    this.renderOverviewCard(cards, '知识库笔记', String(analytics.totalNotes), `${analytics.totalWords.toLocaleString()} 字内容`);
    this.renderOverviewCard(cards, '近 7 天更新', String(analytics.recentNotes), analytics.weeklyGrowth >= 0 ? `较上周 +${analytics.weeklyGrowth}` : `较上周 ${analytics.weeklyGrowth}`);
    this.renderOverviewCard(cards, '孤岛笔记', String(analytics.orphanNotes), `${analytics.totalInboundLinks} 条入链 / ${analytics.totalOutboundLinks} 条出链`);
    this.renderOverviewCard(cards, '今日捕捉', `${todayTasks.length} 待办`, `${todayMemos.length} 条备忘录`);
    this.renderOverviewCard(cards, '日记记录', `${journalDays} 天`, hasJournalToday ? '今天已写日记' : '今天还没写日记');

    const quick = root.createDiv({ cls: 'daily-todolist-home-actions' });
    quick.createEl('button', { text: '刷新首页' }).addEventListener('click', async () => {
      this.plugin.invalidateVaultAnalytics();
      await this.refresh();
    });
    quick.createEl('button', { text: '宽屏打开' }).addEventListener('click', async () => {
      await this.plugin.openView('wide', this.activeTab);
    });
    this.renderQuickTabButton(quick, 'today', '记录待办');
    this.renderQuickTabButton(quick, 'journal', hasJournalToday ? '继续写日记' : '写日记');
    this.renderQuickTabButton(quick, 'memo', '写备忘录');
    this.renderQuickTabButton(quick, 'stats', '查看统计');
    quick.createEl('button', { text: '打开今日笔记' }).addEventListener('click', () => {
      openTodayDailyNote(this.app, this.plugin.settings);
    });

    const atlasGrid = root.createDiv({ cls: 'daily-todolist-atlas-grid' });
    this.renderRankedCard(atlasGrid, '目录分布', '按顶层目录聚合', analytics.topFolders, '还没有目录数据。');
    this.renderRankedCard(atlasGrid, '标签热区', '最常被使用的标签', analytics.topTags, '还没有标签数据。');
    this.renderRankedCard(atlasGrid, '结构字段', 'frontmatter 最常见字段', analytics.topFrontmatterKeys, '还没有 frontmatter。');

    const insightRow = root.createDiv({ cls: 'daily-todolist-insight-grid' });
    this.renderActivityCard(insightRow, analytics.activityLast7Days);
    this.renderRankedCard(insightRow, '链接枢纽', '被最多笔记引用的核心节点', analytics.topLinkedNotes, '还没有链接热点。', true);

    const noteRow = root.createDiv({ cls: 'daily-todolist-insight-grid' });
    this.renderNoteCard(noteRow, '最近更新', '最新被修改的笔记', analytics.recentlyUpdatedNotes, (note) => this.formatRelativeTime(note.updatedAt));
    this.renderNoteCard(noteRow, '沉睡但有料', '字数高但链接薄弱，适合继续整理', analytics.quietNotes, (note) => `${note.wordCount} 字 · ${note.inboundLinks}/${note.outboundLinks} 链接`);

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

  private async renderJournal(root: HTMLElement, refreshId: number): Promise<void> {
    root.empty();
    const compose = root.createDiv({ cls: 'daily-todolist-compose daily-todolist-memo-compose' });
    compose.createDiv({ cls: 'daily-todolist-compose-title', text: '今日日记' });
    this.journalInputEl = compose.createEl('textarea', {
      cls: 'daily-todolist-input daily-todolist-memo-input',
      attr: { placeholder: '记录今天的进展、复盘和想法...' },
    });

    const actions = compose.createDiv({ cls: 'daily-todolist-actions' });
    actions.createEl('button', { cls: 'daily-todolist-add-button', text: '保存日记' })
      .addEventListener('click', () => this.saveJournalFromInput());
    actions.createEl('button', { text: '打开今日笔记' }).addEventListener('click', () => {
      openTodayDailyNote(this.app, this.plugin.settings);
    });

    const file = await getOrCreateTodayDailyNote(this.app, this.plugin.settings);
    if (!this.canRender(refreshId)) return;
    if (!file) {
      root.createDiv({ cls: 'daily-todolist-empty', text: '今日 Daily Note 不存在。' });
      return;
    }

    const journal = await this.readJournal(file);
    if (!this.canRender(refreshId)) return;
    if (this.journalInputEl) this.journalInputEl.value = journal.text;
    root.createDiv({
      cls: 'daily-todolist-stats',
      text: journal.text.trim().length > 0 ? '今日日记已存在内容' : '今日日记还是空白',
    });
  }

  private async renderAI(root: HTMLElement, refreshId: number): Promise<void> {
    root.empty();
    if (!this.plugin.isDesktopApp()) {
      root.createDiv({ cls: 'daily-todolist-empty', text: 'AI Command Panel 仅支持桌面端 Obsidian。' });
      return;
    }

    const panel = root.createDiv({ cls: 'daily-todolist-compose daily-todolist-memo-compose' });
    panel.createDiv({ cls: 'daily-todolist-compose-title', text: 'AI Command Panel' });

    const providerField = panel.createDiv({ cls: 'daily-todolist-field' });
    providerField.createDiv({ cls: 'daily-todolist-field-label', text: 'Provider' });
    this.aiProviderEl = providerField.createEl('select', { cls: 'daily-todolist-priority-select' });
    for (const provider of this.plugin.settings.aiProviders.filter((item) => item.enabled)) {
      this.aiProviderEl.createEl('option', { text: provider.label, value: provider.id });
    }
    this.aiProviderEl.value = this.aiState.selectedProviderId;
    this.aiProviderEl.addEventListener('change', () => {
      this.aiState.selectedProviderId = this.aiProviderEl?.value as AIProviderConfig['id'];
    });

    this.aiPromptEl = panel.createEl('textarea', {
      cls: 'daily-todolist-input daily-todolist-memo-input',
      attr: { placeholder: '输入要交给 AI CLI 的 prompt...' },
    });
    this.aiPromptEl.value = this.aiState.prompt;
    this.aiPromptEl.addEventListener('input', () => {
      this.aiState.prompt = this.aiPromptEl?.value ?? '';
    });

    const toggles = panel.createDiv({ cls: 'daily-todolist-actions' });
    this.aiCurrentNoteToggleEl = this.createAICheckbox(toggles, '当前笔记', this.aiState.contextSelection.currentNote, (value) => {
      this.aiState.contextSelection.currentNote = value;
    });
    this.aiTodayJournalToggleEl = this.createAICheckbox(toggles, '今日日记', this.aiState.contextSelection.todayJournal, (value) => {
      this.aiState.contextSelection.todayJournal = value;
    });
    this.aiTodayTasksToggleEl = this.createAICheckbox(toggles, '今日任务', this.aiState.contextSelection.todayTasks, (value) => {
      this.aiState.contextSelection.todayTasks = value;
    });

    const actions = panel.createDiv({ cls: 'daily-todolist-actions' });
    actions.createEl('button', { cls: 'daily-todolist-add-button', text: '运行' })
      .addEventListener('click', () => this.runAICommand());
    actions.createEl('button', { text: '停止' })
      .addEventListener('click', () => this.stopAICommand());
    actions.createEl('button', { text: '存为备忘录' })
      .addEventListener('click', () => this.saveAIOutputToMemo());
    actions.createEl('button', { text: '追加到日记' })
      .addEventListener('click', () => this.saveAIOutputToJournal());
    actions.createEl('button', { text: '新建笔记' })
      .addEventListener('click', () => this.saveAIOutputToNote());

    root.createDiv({
      cls: 'daily-todolist-stats',
      text: `状态：${this.aiState.execution.status}${this.aiState.execution.commandSummary ? ` · ${this.aiState.execution.commandSummary}` : ''}`,
    });

    const output = root.createDiv({ cls: 'daily-todolist-list daily-todolist-memo-list' });
    output.createDiv({ cls: 'daily-todolist-item-text', text: this.aiState.execution.stdout || '标准输出会显示在这里。' });
    if (this.aiState.execution.stderr.trim().length > 0) {
      output.createDiv({ cls: 'daily-todolist-item-text', text: this.aiState.execution.stderr });
    }

    if (!this.canRender(refreshId)) return;
  }

  private createAICheckbox(parent: HTMLElement, label: string, checked: boolean, onChange: (value: boolean) => void): HTMLInputElement {
    const wrapper = parent.createEl('label', { cls: 'daily-todolist-field-label' });
    const input = wrapper.createEl('input', { type: 'checkbox' });
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    wrapper.appendText(` ${label}`);
    return input;
  }

  private async saveJournalFromInput(): Promise<void> {
    const file = await getOrCreateTodayDailyNote(this.app, this.plugin.settings);
    if (!file) return;

    const content = await this.app.vault.read(file);
    const nextContent = upsertJournalInContent(
      content,
      this.plugin.settings.journalHeading,
      this.journalInputEl?.value ?? '',
    );
    await this.app.vault.modify(file, nextContent);
    this.clearCaches();
    new Notice('今日日记已保存');
    await this.refresh();
  }

  private async readJournal(
    file: TFile,
    date = window.moment().format('YYYY-MM-DD'),
    path = file.path,
  ): Promise<DailyJournal> {
    const journal = await readJournalForDate(this.app, this.plugin.settings, date);
    if (journal) return journal;
    return { text: '', date, filePath: path };
  }

  private async renderStats(root: HTMLElement, refreshId: number): Promise<void> {
    root.empty();
    const { start, end } = this.getMonthRange();
    const [tasks, memos, journals, analytics] = await Promise.all([
      this.getRangeTasks(start, end),
      readMemosForDateRange(this.app, this.plugin.settings, start, end),
      readJournalsForDateRange(this.app, this.plugin.settings, start, end),
      this.plugin.getVaultAnalytics(),
    ]);
    if (!this.canRender(refreshId)) return;

    const completed = tasks.filter((task) => task.completed).length;
    const active = tasks.length - completed;
    const planned = scheduledTasks(tasks);
    const journalDays = journals.filter((journal) => journal.text.trim().length > 0).length;
    const hasJournalToday = journals.some((journal) => journal.date === window.moment().format('YYYY-MM-DD') && journal.text.trim().length > 0);
    const overdue = planned.filter((task) => {
      const endDate = task.endDate ?? task.dueDate ?? task.startDate;
      return !task.completed && endDate && parseGanttMoment(endDate, true).isBefore(window.moment());
    }).length;
    const memoDays = new Set(memos.map((memo) => memo.date)).size;

    root.createDiv({ cls: 'daily-todolist-stats-title', text: `${window.moment(start).format('YYYY年MM月')} 知识库统计` });
    const cards = root.createDiv({ cls: 'daily-todolist-overview-grid' });
    this.renderOverviewCard(cards, '待办总数', String(tasks.length), `${completed} 已完成 / ${active} 未完成`);
    this.renderOverviewCard(cards, '知识库标签', String(analytics.totalTags), `${analytics.notesWithFrontmatter} 篇有 frontmatter`);
    this.renderOverviewCard(cards, '排期任务', String(planned.length), overdue > 0 ? `${overdue} 个已逾期` : '无逾期');
    this.renderOverviewCard(cards, '未解析链接', String(analytics.unresolvedLinks), `${analytics.orphanNotes} 篇孤岛笔记`);
    this.renderOverviewCard(cards, '备忘录', String(memos.length), `${memoDays} 天有记录`);
    this.renderOverviewCard(cards, '日记记录', `${journalDays} 天`, hasJournalToday ? '今天已写日记' : '今天还没写日记');
    this.renderOverviewCard(cards, '平均篇幅', `${analytics.averageWordsPerNote}`, '每篇笔记平均字数');

    const bars = root.createDiv({ cls: 'daily-todolist-stats-bars' });
    this.renderStatsBar(bars, '已完成', completed, tasks.length);
    this.renderStatsBar(bars, '未完成', active, tasks.length);
    this.renderStatsBar(bars, '有排期', planned.length, tasks.length);
    this.renderStatsBar(bars, '备忘录活跃天', memoDays, window.moment(end).diff(window.moment(start), 'days') + 1);
    this.renderStatsBar(bars, 'Frontmatter 覆盖', analytics.notesWithFrontmatter, analytics.totalNotes);
    this.renderStatsBar(bars, '任务型笔记', analytics.notesWithTasks, analytics.totalNotes);

    const atlasGrid = root.createDiv({ cls: 'daily-todolist-atlas-grid' });
    this.renderRankedCard(atlasGrid, '目录层级', '观察知识库结构深度', analytics.folderDepthBands, '还没有结构分布。');
    this.renderRankedCard(atlasGrid, '标签热度', '常用语义分类', analytics.topTags, '还没有标签数据。');
    this.renderRankedCard(atlasGrid, '链接中枢', '最值得放到首页的枢纽笔记', analytics.topLinkedNotes, '还没有链接中心。', true);

    const noteRow = root.createDiv({ cls: 'daily-todolist-insight-grid' });
    this.renderActivityCard(noteRow, analytics.activityLast7Days);
    this.renderNoteCard(noteRow, '新建笔记', '最近创建的内容', analytics.newestNotes, (note) => this.formatDateTime(note.createdAt));

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

  private renderRankedCard(
    parent: HTMLElement,
    title: string,
    subtitle: string,
    items: RankedStat[],
    emptyText: string,
    openPath = false,
  ): void {
    const card = parent.createDiv({ cls: 'daily-todolist-insight-card' });
    card.createDiv({ cls: 'daily-todolist-insight-title', text: title });
    card.createDiv({ cls: 'daily-todolist-insight-subtitle', text: subtitle });
    if (items.length === 0) {
      card.createDiv({ cls: 'daily-todolist-empty', text: emptyText });
      return;
    }

    const list = card.createDiv({ cls: 'daily-todolist-ranked-list' });
    const max = Math.max(...items.map((item) => item.value), 1);
    items.forEach((item, index) => {
      const row = list.createDiv({ cls: 'daily-todolist-ranked-row' });
      if (openPath && item.path) {
        row.addClass('is-clickable');
        row.addEventListener('click', async () => this.openVaultFile(item.path!));
      }
      row.style.setProperty('--daily-todolist-rank-accent', item.accent ?? 'var(--dtl-accent)');
      row.createDiv({ cls: 'daily-todolist-ranked-index', text: `${index + 1}` });
      const copy = row.createDiv({ cls: 'daily-todolist-ranked-copy' });
      copy.createDiv({ cls: 'daily-todolist-ranked-label', text: item.label });
      if (item.hint) {
        copy.createDiv({ cls: 'daily-todolist-ranked-hint', text: item.hint });
      }
      const metric = row.createDiv({ cls: 'daily-todolist-ranked-metric' });
      metric.createDiv({ cls: 'daily-todolist-ranked-value', text: String(item.value) });
      const bar = metric.createDiv({ cls: 'daily-todolist-ranked-bar' });
      const fill = bar.createDiv({ cls: 'daily-todolist-ranked-bar-fill' });
      fill.style.width = `${Math.max(12, Math.round((item.value / max) * 100))}%`;
    });
  }

  private renderActivityCard(parent: HTMLElement, points: TimelinePoint[]): void {
    const card = parent.createDiv({ cls: 'daily-todolist-insight-card daily-todolist-activity-card' });
    card.createDiv({ cls: 'daily-todolist-insight-title', text: '最近 7 天活跃度' });
    card.createDiv({ cls: 'daily-todolist-insight-subtitle', text: '按笔记更新时间统计每日活跃数' });
    const chart = card.createDiv({ cls: 'daily-todolist-activity-chart' });
    const max = Math.max(...points.map((point) => point.value), 1);
    for (const point of points) {
      const column = chart.createDiv({ cls: 'daily-todolist-activity-column' });
      column.createDiv({ cls: 'daily-todolist-activity-value', text: String(point.value) });
      const bar = column.createDiv({ cls: 'daily-todolist-activity-bar' });
      bar.style.height = `${Math.max(14, Math.round((point.value / max) * 128))}px`;
      column.createDiv({ cls: 'daily-todolist-activity-label', text: point.label });
    }
  }

  private renderNoteCard(
    parent: HTMLElement,
    title: string,
    subtitle: string,
    notes: VaultNoteProfile[],
    meta: (note: VaultNoteProfile) => string,
  ): void {
    const card = parent.createDiv({ cls: 'daily-todolist-insight-card' });
    card.createDiv({ cls: 'daily-todolist-insight-title', text: title });
    card.createDiv({ cls: 'daily-todolist-insight-subtitle', text: subtitle });
    if (notes.length === 0) {
      card.createDiv({ cls: 'daily-todolist-empty', text: '还没有可展示的笔记。' });
      return;
    }

    const list = card.createDiv({ cls: 'daily-todolist-note-list' });
    for (const note of notes) {
      const item = list.createDiv({ cls: 'daily-todolist-note-row' });
      item.addEventListener('click', async () => this.openVaultFile(note.path));
      const header = item.createDiv({ cls: 'daily-todolist-note-header' });
      header.createDiv({ cls: 'daily-todolist-note-title', text: note.name });
      header.createDiv({ cls: 'daily-todolist-note-meta', text: meta(note) });
      item.createDiv({ cls: 'daily-todolist-note-folder', text: note.folder });
      item.createDiv({ cls: 'daily-todolist-note-preview', text: note.preview || '这篇笔记还没有正文摘要。' });
    }
  }

  private formatRelativeTime(value: number): string {
    return window.moment(value).fromNow();
  }

  private formatDateTime(value: number): string {
    return window.moment(value).format('MM-DD HH:mm');
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
    await this.openVaultFile(task.filePath, '来源 Daily Note 不存在');
  }

  private async openMemoSource(memo: DailyMemo): Promise<void> {
    await this.openVaultFile(memo.filePath, '来源 Daily Note 不存在');
  }

  private async openVaultFile(path: string, missingText = '来源文件不存在'): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      new Notice(missingText);
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

  private getSelectedAIProvider(): AIProviderConfig | null {
    const providerId = this.aiProviderEl?.value ?? this.aiState.selectedProviderId;
    return this.plugin.settings.aiProviders.find((provider) => provider.id === providerId && provider.enabled) ?? null;
  }

  private async collectAIContext(): Promise<AIContextAttachment[]> {
    const attachments: AIContextAttachment[] = [];

    if (this.aiState.contextSelection.currentNote) {
      const file = this.app.workspace.getActiveFile();
      if (file) {
        const content = await this.app.vault.read(file);
        attachments.push({ source: 'current-note', label: `当前笔记: ${file.basename}`, content });
      }
    }

    if (this.aiState.contextSelection.todayJournal) {
      const file = await getOrCreateTodayDailyNote(this.app, this.plugin.settings);
      if (file) {
        const journal = await this.readJournal(file);
        if (journal.text.trim()) attachments.push({ source: 'today-journal', label: '今日日记', content: journal.text });
      }
    }

    if (this.aiState.contextSelection.todayTasks) {
      const file = await getOrCreateTodayDailyNote(this.app, this.plugin.settings);
      if (file) {
        const tasks = await this.readTasks(file);
        if (tasks.length > 0) {
          const content = tasks.map((task) => `- ${task.displayText || task.text}`).join('\n');
          attachments.push({ source: 'today-tasks', label: '今日任务', content });
        }
      }
    }

    return attachments;
  }

  private async runAICommand(): Promise<void> {
    const provider = this.getSelectedAIProvider();
    if (!provider) {
      new Notice('请先启用并选择一个 AI provider。');
      return;
    }

    const prompt = this.aiPromptEl?.value.trim() ?? '';
    if (!prompt) {
      new Notice('请输入 prompt。');
      return;
    }

    const attachments = await this.collectAIContext();
    const contextText = attachments.map((item) => `## ${item.label}\n\n${item.content}`).join('\n\n');
    const activeFile = this.app.workspace.getActiveFile();
    const workingDirectory = provider.workingDirectory.trim() || activeFile?.parent?.path || '/';

    this.aiState.execution = {
      status: 'running',
      stdout: '',
      stderr: '',
      commandSummary: '',
    };
    await this.refresh();

    this.aiRunHandle = runAIProviderCommand(
      {
        provider,
        prompt,
        contextText,
        workingDirectory,
      },
      {
        onStdout: (chunk) => {
          this.aiState.execution.stdout += chunk;
          void this.refresh();
        },
        onStderr: (chunk) => {
          this.aiState.execution.stderr += chunk;
          void this.refresh();
        },
        onExit: (code) => {
          this.aiState.execution.status = code === 0 ? 'success' : 'error';
          this.aiRunHandle = null;
          void this.refresh();
        },
        onError: (error) => {
          this.aiState.execution.status = 'error';
          this.aiState.execution.stderr += `${error.message}\n`;
          this.aiRunHandle = null;
          void this.refresh();
        },
      },
    );
    this.aiState.execution.commandSummary = this.aiRunHandle.commandSummary;
    await this.refresh();
  }

  private stopAICommand(): void {
    if (!this.aiRunHandle) return;
    this.aiRunHandle.stop();
    this.aiRunHandle = null;
    this.aiState.execution.status = 'stopped';
    void this.refresh();
  }

  private getAIOutputText(): string {
    return [this.aiState.execution.stdout.trim(), this.aiState.execution.stderr.trim()].filter(Boolean).join('\n\n');
  }

  private async saveAIOutputToMemo(): Promise<void> {
    const text = this.getAIOutputText();
    if (!text) return;
    const file = await getOrCreateTodayDailyNote(this.app, this.plugin.settings);
    if (!file) return;
    const content = await this.app.vault.read(file);
    const nextContent = addMemoToContent(content, this.plugin.settings.memoHeading, text);
    await this.app.vault.modify(file, nextContent);
    this.clearCaches();
    new Notice('AI 输出已保存到备忘录');
  }

  private async saveAIOutputToJournal(): Promise<void> {
    const text = this.getAIOutputText();
    if (!text) return;
    const file = await getOrCreateTodayDailyNote(this.app, this.plugin.settings);
    if (!file) return;
    const content = await this.app.vault.read(file);
    const journal = await this.readJournal(file);
    const nextContent = upsertJournalInContent(
      content,
      this.plugin.settings.journalHeading,
      [journal.text.trim(), text].filter(Boolean).join('\n\n'),
    );
    await this.app.vault.modify(file, nextContent);
    this.clearCaches();
    new Notice('AI 输出已追加到日记');
  }

  private async saveAIOutputToNote(): Promise<void> {
    const text = this.getAIOutputText();
    if (!text) return;
    const folder = this.plugin.settings.aiOutputFolder.trim();
    if (folder) {
      await this.app.vault.createFolder(folder).catch(() => undefined);
    }
    const filename = `AI Output ${window.moment().format('YYYY-MM-DD HH-mm-ss')}.md`;
    const path = folder ? `${folder}/${filename}` : filename;
    const file = await this.app.vault.create(path, text);
    await this.app.workspace.getLeaf(false).openFile(file);
    new Notice('AI 输出已保存为新笔记');
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
    this.plugin.invalidateVaultAnalytics();
  }
}
