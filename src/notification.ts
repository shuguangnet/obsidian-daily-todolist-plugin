import { Notice, requestUrl } from 'obsidian';
import type DailyTodoListPlugin from './main';
import { getDailyNotePathForDate } from './daily-note';
import { readJournalForDate } from './journal';
import { readMemosForDate } from './memos';
import { readTasksForDate } from './schedule';
import type { DailyTask, NotificationDigest } from './types';

type NotificationReason = 'scheduled' | 'manual' | 'test-webhook';

interface DeliveryResult {
  localNotice: boolean;
  systemNotification: boolean;
  webhook: boolean;
}

export class NotificationService {
  private plugin: DailyTodoListPlugin;
  private timer: number | null = null;
  private running = false;

  constructor(plugin: DailyTodoListPlugin) {
    this.plugin = plugin;
  }

  start(): void {
    this.stop();
    this.timer = window.setInterval(() => {
      void this.checkSchedule();
    }, 60_000);
    void this.checkSchedule();
  }

  stop(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  async checkSchedule(now = window.moment()): Promise<void> {
    if (this.running || !this.plugin.settings.notificationsEnabled) return;

    const slots = parseNotificationTimes(this.plugin.settings.notificationTimes);
    if (slots.length === 0) return;

    this.running = true;
    try {
      const date = now.format('YYYY-MM-DD');
      for (const slot of slots) {
        if (!this.shouldSendSlot(slot, now, date)) continue;
        await this.sendDigest({
          date,
          slot,
          reason: 'scheduled',
          markAsSent: true,
        });
      }
    } finally {
      this.running = false;
    }
  }

  async sendManualDigest(): Promise<void> {
    await this.sendDigest({
      date: window.moment().format('YYYY-MM-DD'),
      reason: 'manual',
      showSuccessNotice: true,
    });
  }

  async sendTestWebhook(): Promise<void> {
    if (!this.plugin.settings.webhookEnabled || !this.plugin.settings.webhookUrl.trim()) {
      throw new Error('请先在设置中启用 webhook 并填写 URL');
    }

    await this.sendDigest({
      date: window.moment().format('YYYY-MM-DD'),
      reason: 'test-webhook',
      onlyWebhook: true,
      showSuccessNotice: true,
    });
  }

  private shouldSendSlot(slot: string, now: moment.Moment, date: string): boolean {
    const key = `${date}@${slot}`;
    if (this.plugin.settings.notificationHistory[key]) return false;

    const target = window.moment(`${date} ${slot}`, 'YYYY-MM-DD HH:mm');
    if (!target.isValid()) return false;

    const diffMinutes = now.diff(target, 'minutes');
    return diffMinutes >= 0 && diffMinutes <= this.plugin.settings.notificationGraceMinutes;
  }

  private async sendDigest(options: {
    date: string;
    reason: NotificationReason;
    slot?: string;
    markAsSent?: boolean;
    onlyWebhook?: boolean;
    showSuccessNotice?: boolean;
  }): Promise<void> {
    const digest = await this.buildDigest(options.date);
    const result = await this.deliverDigest(digest, options.reason, options.slot, options.onlyWebhook ?? false);
    if (!result.localNotice && !result.systemNotification && !result.webhook) {
      throw new Error('没有可用的通知通道，请检查设置');
    }

    if (options.markAsSent && options.slot) {
      await this.markSlotAsSent(options.date, options.slot);
    }

    if (options.showSuccessNotice) {
      new Notice('今日摘要已发送');
    }
  }

  private async buildDigest(date: string): Promise<NotificationDigest> {
    const [tasks, journal, memos] = await Promise.all([
      readTasksForDate(this.plugin.app, this.plugin.settings, date),
      readJournalForDate(this.plugin.app, this.plugin.settings, date),
      readMemosForDate(this.plugin.app, this.plugin.settings, date),
    ]);

    return {
      date,
      filePath: getDailyNotePathForDate(this.plugin.app, this.plugin.settings, date),
      pendingTasks: tasks.filter((task) => !task.completed),
      completedTasks: tasks.filter((task) => task.completed),
      journal,
      memos,
    };
  }

  private async deliverDigest(
    digest: NotificationDigest,
    reason: NotificationReason,
    slot?: string,
    onlyWebhook = false,
  ): Promise<DeliveryResult> {
    const result: DeliveryResult = {
      localNotice: false,
      systemNotification: false,
      webhook: false,
    };

    if (!onlyWebhook && this.plugin.settings.localNoticeEnabled) {
      new Notice(this.formatNotice(digest), 12_000);
      result.localNotice = true;
    }

    if (!onlyWebhook && this.plugin.settings.systemNotificationEnabled) {
      result.systemNotification = await this.sendSystemNotification(digest);
    }

    if (this.plugin.settings.webhookEnabled && this.plugin.settings.webhookUrl.trim()) {
      await this.sendWebhook(digest, reason, slot);
      result.webhook = true;
    }

    return result;
  }

  private async sendSystemNotification(digest: NotificationDigest): Promise<boolean> {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission !== 'granted') return false;

    const journalText = digest.journal?.text.trim() ?? '';
    const lines = [
      `未完成 ${digest.pendingTasks.length} 项，已完成 ${digest.completedTasks.length} 项`,
      journalText ? `日记：${truncate(journalText, 36)}` : '今天还没有日记内容',
    ];

    new Notification(`Vault Atlas HQ ${digest.date}`, {
      body: lines.join('\n'),
    });
    return true;
  }

  private async sendWebhook(digest: NotificationDigest, reason: NotificationReason, slot?: string): Promise<void> {
    const headers = parseWebhookHeaders(this.plugin.settings.webhookHeaders);
    headers['Content-Type'] = 'application/json';
    if (this.plugin.settings.webhookSecret.trim()) {
      headers['x-dtl-secret'] = this.plugin.settings.webhookSecret.trim();
    }

    const response = await requestUrl({
      url: this.plugin.settings.webhookUrl.trim(),
      method: this.plugin.settings.webhookMethod,
      headers,
      body: JSON.stringify(this.buildWebhookPayload(digest, reason, slot)),
    });

    if (response.status >= 400) {
      throw new Error(`Webhook 请求失败：${response.status}`);
    }
  }

  private buildWebhookPayload(digest: NotificationDigest, reason: NotificationReason, slot?: string): Record<string, unknown> {
    const includedPending = this.plugin.settings.notificationIncludePending ? digest.pendingTasks : [];
    const includedCompleted = this.plugin.settings.notificationIncludeCompleted ? digest.completedTasks : [];
    const includedJournal = this.plugin.settings.notificationIncludeJournal ? digest.journal?.text.trim() ?? '' : '';
    const includedMemos = this.plugin.settings.notificationIncludeMemos ? digest.memos : [];

    return {
      plugin: 'obsidian-daily-todolist',
      pluginName: 'Vault Atlas HQ',
      reason,
      slot: slot ?? null,
      generatedAt: new Date().toISOString(),
      date: digest.date,
      filePath: digest.filePath,
      summary: {
        pendingCount: digest.pendingTasks.length,
        completedCount: digest.completedTasks.length,
        memoCount: digest.memos.length,
        hasJournal: Boolean(digest.journal?.text.trim()),
      },
      blocks: {
        pending: includedPending.map((task) => this.mapTask(task)),
        completed: includedCompleted.map((task) => this.mapTask(task)),
        journal: includedJournal,
        memos: includedMemos.map((memo) => memo.text),
      },
      text: this.formatWebhookText(digest),
    };
  }

  private mapTask(task: DailyTask): Record<string, unknown> {
    return {
      text: task.displayText ?? task.text,
      raw: task.text,
      priority: task.priority ?? null,
      dueDate: task.dueDate ?? null,
      startDate: task.startDate ?? null,
      endDate: task.endDate ?? null,
      completed: task.completed,
      filePath: task.filePath,
      date: task.date,
    };
  }

  private formatNotice(digest: NotificationDigest): string {
    const sections = [
      `今日未完成 ${digest.pendingTasks.length} 项`,
      `今日已完成 ${digest.completedTasks.length} 项`,
    ];

    if (this.plugin.settings.notificationIncludePending && digest.pendingTasks.length > 0) {
      sections.push(`待办：${digest.pendingTasks.slice(0, 3).map((task) => truncate(task.displayText ?? task.text, 18)).join(' / ')}`);
    }

    if (this.plugin.settings.notificationIncludeJournal) {
      const journalText = digest.journal?.text.trim() ?? '';
      sections.push(journalText ? `日记：${truncate(journalText, 24)}` : '日记：今天还没有内容');
    }

    return sections.join('\n');
  }

  private formatWebhookText(digest: NotificationDigest): string {
    const lines = [
      `# ${digest.date} Daily Digest`,
      `- 未完成待办：${digest.pendingTasks.length}`,
      `- 今日已完成：${digest.completedTasks.length}`,
      `- 今日备忘录：${digest.memos.length}`,
      `- 日记状态：${digest.journal?.text.trim() ? '已记录' : '空白'}`,
    ];

    if (this.plugin.settings.notificationIncludePending && digest.pendingTasks.length > 0) {
      lines.push('', '## 未完成待办');
      for (const task of digest.pendingTasks) {
        lines.push(`- ${task.displayText ?? task.text}`);
      }
    }

    if (this.plugin.settings.notificationIncludeCompleted && digest.completedTasks.length > 0) {
      lines.push('', '## 今日已完成');
      for (const task of digest.completedTasks) {
        lines.push(`- ${task.displayText ?? task.text}`);
      }
    }

    if (this.plugin.settings.notificationIncludeJournal) {
      lines.push('', '## 今日日记');
      lines.push(digest.journal?.text.trim() || '(空白)');
    }

    if (this.plugin.settings.notificationIncludeMemos && digest.memos.length > 0) {
      lines.push('', '## 今日备忘录');
      for (const memo of digest.memos) {
        lines.push(`- ${memo.text}`);
      }
    }

    return lines.join('\n');
  }

  private async markSlotAsSent(date: string, slot: string): Promise<void> {
    const history = { ...this.plugin.settings.notificationHistory };
    history[`${date}@${slot}`] = Date.now();
    this.plugin.settings.notificationHistory = pruneHistory(history);
    await this.plugin.saveSettings();
  }
}

function parseNotificationTimes(value: string): string[] {
  const uniq = new Set<string>();
  for (const segment of value.split(',')) {
    const normalized = segment.trim();
    if (/^\d{2}:\d{2}$/.test(normalized)) uniq.add(normalized);
  }
  return [...uniq].sort();
}

function parseWebhookHeaders(value: string): Record<string, string> {
  if (!value.trim()) return {};

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const headers: Record<string, string> = {};
    for (const key in parsed) {
      const headerValue = parsed[key];
      if (typeof headerValue === 'string') {
        headers[key] = headerValue;
      }
    }
    return headers;
  } catch {
    return {};
  }
}

function pruneHistory(history: Record<string, number>): Record<string, number> {
  const cutoff = window.moment().subtract(14, 'day');
  const nextHistory: Record<string, number> = {};
  for (const key in history) {
    const date = key.split('@')[0];
    if (window.moment(date, 'YYYY-MM-DD', true).isSameOrAfter(cutoff, 'day')) {
      nextHistory[key] = history[key];
    }
  }
  return nextHistory;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}
