import { Plugin } from 'obsidian';
import { registerDailyTodoListCommands } from './commands';
import { DAILY_TODOLIST_VIEW_TYPE, DailyTodoListView, type DailyTodoListTab } from './view';
import { DailyTodoListSettingTab, DEFAULT_SETTINGS } from './settings';
import { analyzeVault } from './vault-analytics';
import type { DailyTodoListSettings, VaultAnalytics } from './types';

export default class DailyTodoListPlugin extends Plugin {
  settings: DailyTodoListSettings;
  private vaultAnalyticsPromise: Promise<VaultAnalytics> | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(
      DAILY_TODOLIST_VIEW_TYPE,
      (leaf) => new DailyTodoListView(leaf, this),
    );

    registerDailyTodoListCommands(this);
    this.addSettingTab(new DailyTodoListSettingTab(this.app, this));

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
  }

  async onunload(): Promise<void> {
    this.app.workspace.detachLeavesOfType(DAILY_TODOLIST_VIEW_TYPE);
  }

  async activateView(tab?: DailyTodoListTab): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(DAILY_TODOLIST_VIEW_TYPE);
    if (leaves.length > 0) {
      this.app.workspace.revealLeaf(leaves[0]);
      const view = leaves[0].view;
      if (tab && view instanceof DailyTodoListView) await view.setTab(tab);
      return;
    }

    const leaf = this.app.workspace.getRightLeaf(false);
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

  async loadSettings(): Promise<void> {
    const loaded = await this.loadData();
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...loaded,
      priorityOptions: loaded?.priorityOptions ?? DEFAULT_SETTINGS.priorityOptions,
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
