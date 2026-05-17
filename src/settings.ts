import { App, PluginSettingTab, Setting } from 'obsidian';
import type DailyTodoListPlugin from './main';
import type { DailyTodoListSettings, PriorityOption } from './types';

export const DEFAULT_SETTINGS: DailyTodoListSettings = {
  useDailyNotesPluginSettings: true,
  dailyNoteFolder: 'Daily Notes',
  dailyNoteFormat: 'YYYY-MM-DD',
  todoHeading: 'TodoList',
  memoHeading: 'Memo',
  journalHeading: 'Journal',
  insertPosition: 'bottom',
  showCompleted: true,
  openViewOnStartup: false,
  autoCreateDailyNote: true,
  calendarDefaultView: 'today',
  ganttLookbackDays: 14,
  ganttLookaheadDays: 30,
  priorityOptions: [
    { id: 'low', label: '低优先级', color: '#16a34a' },
    { id: 'medium', label: '中优先级', color: '#d97706' },
    { id: 'high', label: '高优先级', color: '#dc2626' },
  ],
};

export class DailyTodoListSettingTab extends PluginSettingTab {
  plugin: DailyTodoListPlugin;

  constructor(app: App, plugin: DailyTodoListPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Daily TodoList 设置' });

    new Setting(containerEl)
      .setName('优先使用 Daily Notes 设置')
      .setDesc('启用后优先读取 Obsidian Daily Notes / Periodic Notes 插件的目录和日期格式。')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.useDailyNotesPluginSettings)
        .onChange(async (value) => {
          this.plugin.settings.useDailyNotesPluginSettings = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Daily Note 目录')
      .setDesc('Vault 内相对路径，留空表示根目录。')
      .addText((text) => text
        .setPlaceholder('Daily Notes')
        .setValue(this.plugin.settings.dailyNoteFolder)
        .onChange(async (value) => {
          this.plugin.settings.dailyNoteFolder = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Daily Note 日期格式')
      .setDesc('使用 moment 格式，例如 YYYY-MM-DD。')
      .addText((text) => text
        .setPlaceholder('YYYY-MM-DD')
        .setValue(this.plugin.settings.dailyNoteFormat)
        .onChange(async (value) => {
          this.plugin.settings.dailyNoteFormat = value.trim() || DEFAULT_SETTINGS.dailyNoteFormat;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Todo 标题')
      .setDesc('每日笔记中用于保存待办的标题名称。')
      .addText((text) => text
        .setPlaceholder('TodoList')
        .setValue(this.plugin.settings.todoHeading)
        .onChange(async (value) => {
          this.plugin.settings.todoHeading = value.trim() || DEFAULT_SETTINGS.todoHeading;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

    new Setting(containerEl)
      .setName('备忘录标题')
      .setDesc('每日笔记中用于保存备忘录的标题名称。')
      .addText((text) => text
        .setPlaceholder('Memo')
        .setValue(this.plugin.settings.memoHeading)
        .onChange(async (value) => {
          this.plugin.settings.memoHeading = value.trim() || DEFAULT_SETTINGS.memoHeading;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

    new Setting(containerEl)
      .setName('日记标题')
      .setDesc('每日笔记中用于保存日记正文的标题名称。')
      .addText((text) => text
        .setPlaceholder('Journal')
        .setValue(this.plugin.settings.journalHeading)
        .onChange(async (value) => {
          this.plugin.settings.journalHeading = value.trim() || DEFAULT_SETTINGS.journalHeading;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

    new Setting(containerEl)
      .setName('新任务插入位置')
      .setDesc('选择新任务插入 TodoList 区块顶部或底部。')
      .addDropdown((dropdown) => dropdown
        .addOption('top', '顶部')
        .addOption('bottom', '底部')
        .setValue(this.plugin.settings.insertPosition)
        .onChange(async (value: 'top' | 'bottom') => {
          this.plugin.settings.insertPosition = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('显示已完成任务')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.showCompleted)
        .onChange(async (value) => {
          this.plugin.settings.showCompleted = value;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

    new Setting(containerEl)
      .setName('自动创建 Daily Note')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.autoCreateDailyNote)
        .onChange(async (value) => {
          this.plugin.settings.autoCreateDailyNote = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('启动时打开侧边栏')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.openViewOnStartup)
        .onChange(async (value) => {
          this.plugin.settings.openViewOnStartup = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('默认视图')
      .setDesc('打开侧边栏时默认显示的页签。')
      .addDropdown((dropdown) => dropdown
        .addOption('home', '首页')
        .addOption('today', '今日')
        .addOption('journal', '日记')
        .addOption('memo', '备忘录')
        .addOption('calendar', '日历')
        .addOption('gantt', '甘特图')
        .addOption('stats', '统计')
        .setValue(this.plugin.settings.calendarDefaultView)
        .onChange(async (value: DailyTodoListSettings['calendarDefaultView']) => {
          this.plugin.settings.calendarDefaultView = value;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

    new Setting(containerEl)
      .setName('甘特图回看天数')
      .setDesc('从今天向前读取多少天的 Daily Note。')
      .addText((text) => text
        .setPlaceholder('14')
        .setValue(String(this.plugin.settings.ganttLookbackDays))
        .onChange(async (value) => {
          this.plugin.settings.ganttLookbackDays = Math.max(0, Number.parseInt(value, 10) || 0);
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

    new Setting(containerEl)
      .setName('甘特图展望天数')
      .setDesc('从今天向后读取多少天的 Daily Note。')
      .addText((text) => text
        .setPlaceholder('30')
        .setValue(String(this.plugin.settings.ganttLookaheadDays))
        .onChange(async (value) => {
          this.plugin.settings.ganttLookaheadDays = Math.max(0, Number.parseInt(value, 10) || 0);
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

    containerEl.createEl('h3', { text: '优先级' });
    this.plugin.settings.priorityOptions.forEach((priority, index) => {
      this.renderPrioritySetting(containerEl, priority, index);
    });
  }

  private renderPrioritySetting(containerEl: HTMLElement, priority: PriorityOption, index: number): void {
    const setting = new Setting(containerEl)
      .setName(`优先级 ${index + 1}`)
      .setDesc('设置添加任务时可选择的优先级名称和颜色。')
      .addText((text) => text
        .setPlaceholder('优先级名称')
        .setValue(priority.label)
        .onChange(async (value) => {
          priority.label = value.trim() || priority.id;
          await this.plugin.saveSettings();
          this.plugin.refreshViews();
        }));

    const colorInput = setting.controlEl.createEl('input', {
      type: 'color',
      cls: 'daily-todolist-priority-color-input',
    });
    colorInput.value = priority.color;
    colorInput.addEventListener('change', async () => {
      priority.color = colorInput.value;
      await this.plugin.saveSettings();
      this.plugin.refreshViews();
    });
  }
}
