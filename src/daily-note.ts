import { App, Notice, TFile, normalizePath } from 'obsidian';
import type { DailyTodoListSettings } from './types';

interface DailyNoteSettings {
  folder: string;
  format: string;
}

interface InternalPluginInstance {
  enabled?: boolean;
  instance?: {
    options?: Record<string, unknown>;
  };
}

function readPluginOptions(app: App, pluginId: string): Record<string, unknown> | null {
  const internalApp = app as App & {
    internalPlugins?: { plugins?: Record<string, InternalPluginInstance> };
    plugins?: { plugins?: Record<string, InternalPluginInstance> };
  };

  const plugin = internalApp.internalPlugins?.plugins?.[pluginId] ?? internalApp.plugins?.plugins?.[pluginId];
  if (!plugin?.enabled || !plugin.instance?.options) return null;
  return plugin.instance.options;
}

function optionString(options: Record<string, unknown>, keys: string[], fallback: string): string {
  for (const key of keys) {
    const value = options[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return fallback;
}

export function getDailyNoteSettingsFromObsidian(app: App): DailyNoteSettings | null {
  const dailyNotes = readPluginOptions(app, 'daily-notes');
  if (dailyNotes) {
    return {
      folder: optionString(dailyNotes, ['folder'], ''),
      format: optionString(dailyNotes, ['format'], 'YYYY-MM-DD'),
    };
  }

  const periodicNotes = readPluginOptions(app, 'periodic-notes');
  const daily = periodicNotes?.daily;
  if (daily && typeof daily === 'object') {
    const dailyOptions = daily as Record<string, unknown>;
    return {
      folder: optionString(dailyOptions, ['folder'], ''),
      format: optionString(dailyOptions, ['format'], 'YYYY-MM-DD'),
    };
  }

  return null;
}

function getResolvedDailyNoteSettings(app: App, settings: DailyTodoListSettings): DailyNoteSettings {
  const obsidianSettings = settings.useDailyNotesPluginSettings
    ? getDailyNoteSettingsFromObsidian(app)
    : null;
  return {
    folder: obsidianSettings?.folder ?? settings.dailyNoteFolder,
    format: obsidianSettings?.format ?? settings.dailyNoteFormat,
  };
}

export function getDailyNotePathForDate(app: App, settings: DailyTodoListSettings, date: string): string {
  const resolved = getResolvedDailyNoteSettings(app, settings);
  const filename = `${window.moment(date, 'YYYY-MM-DD').format(resolved.format || 'YYYY-MM-DD')}.md`;
  return normalizePath(resolved.folder ? `${resolved.folder}/${filename}` : filename);
}

export function getTodayDailyNotePath(app: App, settings: DailyTodoListSettings): string {
  return getDailyNotePathForDate(app, settings, window.moment().format('YYYY-MM-DD'));
}

export async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
  const normalized = normalizePath(folderPath);
  if (!normalized || normalized === '/') return;

  const parts = normalized.split('/').filter(Boolean);
  let current = '';

  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!(await app.vault.adapter.exists(current))) {
      await app.vault.createFolder(current);
    }
  }
}

export async function getOrCreateDailyNoteForDate(
  app: App,
  settings: DailyTodoListSettings,
  date: string,
): Promise<TFile | null> {
  const path = getDailyNotePathForDate(app, settings, date);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) return existing;

  if (!settings.autoCreateDailyNote) {
    new Notice(`${date} Daily Note 不存在：${path}`);
    return null;
  }

  const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  await ensureFolderExists(app, parent);
  return app.vault.create(path, '');
}

export async function getOrCreateTodayDailyNote(app: App, settings: DailyTodoListSettings): Promise<TFile | null> {
  return getOrCreateDailyNoteForDate(app, settings, window.moment().format('YYYY-MM-DD'));
}

export async function openDailyNoteForDate(
  app: App,
  settings: DailyTodoListSettings,
  date: string,
): Promise<void> {
  const file = await getOrCreateDailyNoteForDate(app, settings, date);
  if (!file) return;

  const leaf = app.workspace.getLeaf(false);
  await leaf.openFile(file);
}

export async function openTodayDailyNote(app: App, settings: DailyTodoListSettings): Promise<void> {
  await openDailyNoteForDate(app, settings, window.moment().format('YYYY-MM-DD'));
}
