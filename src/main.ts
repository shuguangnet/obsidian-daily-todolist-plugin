import { Plugin } from 'obsidian';
import { registerDailyTodoListCommands } from './commands';
import { DAILY_TODOLIST_VIEW_TYPE, DailyTodoListView, type DailyTodoListTab } from './view';
import { DailyTodoListSettingTab, DEFAULT_SETTINGS } from './settings';
import type { DailyTodoListSettings } from './types';

export default class DailyTodoListPlugin extends Plugin {
  settings: DailyTodoListSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(
      DAILY_TODOLIST_VIEW_TYPE,
      (leaf) => new DailyTodoListView(leaf, this),
    );

    registerDailyTodoListCommands(this);
    this.addSettingTab(new DailyTodoListSettingTab(this.app, this));

    this.addRibbonIcon('check-square', 'Daily TodoList', () => {
      this.activateView();
    });

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

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
