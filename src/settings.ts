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
  notificationsEnabled: false,
  notificationTimes: '09:00,18:00,21:30',
  notificationGraceMinutes: 10,
  notificationIncludePending: true,
  notificationIncludeCompleted: true,
  notificationIncludeJournal: true,
  notificationIncludeMemos: false,
  localNoticeEnabled: true,
  systemNotificationEnabled: false,
  webhookEnabled: false,
  webhookUrl: '',
  webhookMethod: 'POST',
  webhookSecret: '',
  webhookHeaders: '',
  notificationHistory: {},
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

    containerEl.createEl('h3', { text: '通知与 Webhook' });

    new Setting(containerEl)
      .setName('启用定时通知')
      .setDesc('按设定时间汇总今日未完成、已完成待办与日记，并推送到本地或 webhook。')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.notificationsEnabled)
        .onChange(async (value) => {
          this.plugin.settings.notificationsEnabled = value;
          await this.plugin.saveSettings();
          this.plugin.refreshNotificationService();
        }));

    new Setting(containerEl)
      .setName('通知时间')
      .setDesc('使用 24 小时制，多个时间用英文逗号分隔，例如 09:00,18:00,21:30。')
      .addText((text) => text
        .setPlaceholder('09:00,18:00,21:30')
        .setValue(this.plugin.settings.notificationTimes)
        .onChange(async (value) => {
          this.plugin.settings.notificationTimes = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('补发窗口（分钟）')
      .setDesc('Obsidian 在计划时间后多少分钟内启动，仍允许补发该时段通知。')
      .addText((text) => text
        .setPlaceholder('10')
        .setValue(String(this.plugin.settings.notificationGraceMinutes))
        .onChange(async (value) => {
          this.plugin.settings.notificationGraceMinutes = Math.max(0, Number.parseInt(value, 10) || 0);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('包含未完成待办')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.notificationIncludePending)
        .onChange(async (value) => {
          this.plugin.settings.notificationIncludePending = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('包含今日已完成')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.notificationIncludeCompleted)
        .onChange(async (value) => {
          this.plugin.settings.notificationIncludeCompleted = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('包含今日日记')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.notificationIncludeJournal)
        .onChange(async (value) => {
          this.plugin.settings.notificationIncludeJournal = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('包含今日备忘录')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.notificationIncludeMemos)
        .onChange(async (value) => {
          this.plugin.settings.notificationIncludeMemos = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Obsidian 内提醒')
      .setDesc('使用 Notice 在应用内弹出摘要。')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.localNoticeEnabled)
        .onChange(async (value) => {
          this.plugin.settings.localNoticeEnabled = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('系统通知')
      .setDesc('使用浏览器 Notification API。部分平台可能需要系统权限。')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.systemNotificationEnabled)
        .onChange(async (value) => {
          this.plugin.settings.systemNotificationEnabled = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('启用 webhook')
      .setDesc('向外部自动化平台发送 JSON 摘要，例如 n8n、飞书机器人或自建服务。')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.webhookEnabled)
        .onChange(async (value) => {
          this.plugin.settings.webhookEnabled = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Webhook URL')
      .addText((text) => text
        .setPlaceholder('https://example.com/webhook')
        .setValue(this.plugin.settings.webhookUrl)
        .onChange(async (value) => {
          this.plugin.settings.webhookUrl = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Webhook 方法')
      .addDropdown((dropdown) => dropdown
        .addOption('POST', 'POST')
        .addOption('PUT', 'PUT')
        .setValue(this.plugin.settings.webhookMethod)
        .onChange(async (value: 'POST' | 'PUT') => {
          this.plugin.settings.webhookMethod = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Webhook Secret')
      .setDesc('如果填写，会作为 `x-dtl-secret` 请求头发送。')
      .addText((text) => text
        .setPlaceholder('optional-secret')
        .setValue(this.plugin.settings.webhookSecret)
        .onChange(async (value) => {
          this.plugin.settings.webhookSecret = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('自定义请求头')
      .setDesc('填写 JSON 对象，例如 {\"Authorization\":\"Bearer xxx\"}。解析失败时会忽略。')
      .addTextArea((text) => text
        .setPlaceholder('{"Authorization":"Bearer xxx"}')
        .setValue(this.plugin.settings.webhookHeaders)
        .onChange(async (value) => {
          this.plugin.settings.webhookHeaders = value.trim();
          await this.plugin.saveSettings();
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
