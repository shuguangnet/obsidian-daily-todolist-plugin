import { Plugin } from 'obsidian';
import { registerDailyTodoListCommands } from './commands';
import { DAILY_TODOLIST_VIEW_TYPE, DailyTodoListView } from './view';
import { DailyTodoListSettingTab, DEFAULT_SETTINGS } from './settings';
import { NotificationService } from './notification';
import { analyzeVault } from './vault-analytics';
import type { DailyTodoListSettings, DailyTodoListTab, VaultAnalytics } from './types';

export default class DailyTodoListPlugin extends Plugin {
  settings: DailyTodoListSettings;
  private vaultAnalyticsPromise: Promise<VaultAnalytics> | null = null;
  private notificationService: NotificationService | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(
      DAILY_TODOLIST_VIEW_TYPE,
      (leaf) => new DailyTodoListView(leaf, this),
    );

    registerDailyTodoListCommands(this);
    this.addSettingTab(new DailyTodoListSettingTab(this.app, this));
    this.notificationService = new NotificationService(this);

    this.addRibbonIcon('layout-dashboard', 'Vault Atlas HQ', () => {
      this.activateView();
    });

    this.registerEvent(this.app.vault.on('create', () => this.invalidateVaultAnalytics()));
    this.registerEvent(this.app.vault.on('modify', () => this.invalidateVaultAnalytics()));
    this.registerEvent(this.app.vault.on('delete', () => this.invalidateVaultAnalytics()));
    this.registerEvent(this.app.vault.on('rename', () => this.invalidateVaultAnalytics()));

    if (this.settings.openViewOnStartup) {
      this.app.workspace.onLayoutReady(() => {
        this.activateView();
      });
    }

    this.app.workspace.onLayoutReady(() => {
      this.refreshNotificationService();
    });
  }

  async onunload(): Promise<void> {
    this.notificationService?.stop();
    this.app.workspace.detachLeavesOfType(DAILY_TODOLIST_VIEW_TYPE);
  }

  async activateView(tab?: DailyTodoListTab): Promise<void> {
    await this.openView('sidebar', tab);
  }

  async openView(mode: 'sidebar' | 'wide', tab?: DailyTodoListTab): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(DAILY_TODOLIST_VIEW_TYPE);
    const matchingLeaf = leaves.find((leaf) => {
      if (mode === 'wide') return leaf.getRoot() !== this.app.workspace.rightSplit;
      return leaf.getRoot() === this.app.workspace.rightSplit;
    });
    if (matchingLeaf) {
      this.app.workspace.revealLeaf(matchingLeaf);
      const view = matchingLeaf.view;
      if (tab && view instanceof DailyTodoListView) await view.setTab(tab);
      return;
    }

    const leaf = mode === 'wide'
      ? this.app.workspace.getLeaf(false)
      : this.app.workspace.getRightLeaf(false);
    if (!leaf) return;

    await leaf.setViewState({ type: DAILY_TODOLIST_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
    const view = leaf.view;
    if (tab && view instanceof DailyTodoListView) await view.setTab(tab);
  }

  refreshViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(DAILY_TODOLIST_VIEW_TYPE)) {
      const view = leaf.view;
      if (view instanceof DailyTodoListView) {
        view.refresh();
      }
    }
  }

  async getVaultAnalytics(forceRefresh = false): Promise<VaultAnalytics> {
    if (forceRefresh || !this.vaultAnalyticsPromise) {
      this.vaultAnalyticsPromise = analyzeVault(this.app);
    }
    return this.vaultAnalyticsPromise;
  }

  invalidateVaultAnalytics(): void {
    this.vaultAnalyticsPromise = null;
  }

  refreshNotificationService(): void {
    if (!this.notificationService) return;
    if (!this.settings.notificationsEnabled) {
      this.notificationService.stop();
      return;
    }
    this.notificationService.start();
  }

  stopNotificationService(): void {
    this.notificationService?.stop();
  }

  async sendManualDigest(): Promise<void> {
    if (!this.notificationService) return;
    await this.notificationService.sendManualDigest();
  }

  async sendTestWebhook(): Promise<void> {
    if (!this.notificationService) return;
    await this.notificationService.sendTestWebhook();
  }

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...loaded,
      priorityOptions: loaded?.priorityOptions ?? DEFAULT_SETTINGS.priorityOptions,
      notificationHistory: loaded?.notificationHistory ?? DEFAULT_SETTINGS.notificationHistory,
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
