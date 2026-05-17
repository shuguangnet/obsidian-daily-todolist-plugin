import { TFile, type App } from 'obsidian';
import type { RankedStat, TimelinePoint, VaultAnalytics, VaultNoteProfile } from './types';

const previewLength = 140;

function countWords(content: string): number {
  const latinWords = content.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  const cjkCharacters = content.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  return latinWords + cjkCharacters;
}

function extractPreview(content: string): string {
  return content
    .replace(/^---[\s\S]*?---/m, '')
    .replace(/!\[\[.*?\]\]/g, ' ')
    .replace(/\[\[(.*?)(\|.*?)?\]\]/g, '$1')
    .replace(/[#>*`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, previewLength);
}

function normalizeTag(tag: string): string {
  return tag.startsWith('#') ? tag : `#${tag}`;
}

function collectFrontmatterTags(value: unknown): string[] {
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }
  return [];
}

function topFolderFromPath(path: string): string {
  const parts = path.split('/');
  return parts.length > 1 ? parts[0] : 'Vault Root';
}

function folderName(path: string): string {
  const segments = path.split('/');
  return segments.length > 1 ? segments.slice(0, -1).join('/') : 'Vault Root';
}

function createRankedStats(
  values: Map<string, number>,
  limit: number,
  hints?: Map<string, string>,
  accents?: string[],
): RankedStat[] {
  return Array.from(values.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hans-CN'))
    .slice(0, limit)
    .map(([label, value], index) => ({
      label,
      value,
      hint: hints?.get(label),
      accent: accents?.[index % accents.length],
    }));
}

function buildActivitySeries(files: TFile[]): TimelinePoint[] {
  const today = window.moment().startOf('day');
  return Array.from({ length: 7 }, (_, index) => {
    const day = today.clone().subtract(6 - index, 'day');
    const start = day.valueOf();
    const end = day.clone().endOf('day').valueOf();
    const value = files.filter((file) => file.stat.mtime >= start && file.stat.mtime <= end).length;
    return {
      date: day.format('YYYY-MM-DD'),
      label: day.format('dd'),
      value,
    };
  });
}

export async function analyzeVault(app: App): Promise<VaultAnalytics> {
  const files = app.vault.getMarkdownFiles().sort((a, b) => b.stat.mtime - a.stat.mtime);
  const resolvedLinks = app.metadataCache.resolvedLinks;
  const unresolvedLinks = app.metadataCache.unresolvedLinks;
  const folderCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const frontmatterCounts = new Map<string, number>();
  const topFolderCounts = new Map<string, number>();
  const depthBandCounts = new Map<string, number>();
  const profiles: VaultNoteProfile[] = [];
  const inboundCounts = new Map<string, number>();
  let totalWords = 0;
  let totalOutboundLinks = 0;
  let totalInboundLinks = 0;
  let notesWithFrontmatter = 0;
  let notesWithTasks = 0;

  for (const [source, targets] of Object.entries(resolvedLinks)) {
    for (const [target, count] of Object.entries(targets)) {
      inboundCounts.set(target, (inboundCounts.get(target) ?? 0) + count);
      totalInboundLinks += count;
    }
  }

  for (const file of files) {
    const cache = app.metadataCache.getFileCache(file);
    const content = await app.vault.cachedRead(file);
    const tags = new Set<string>();
    const inlineTags = cache?.tags ?? [];
    for (const tag of inlineTags) tags.add(normalizeTag(tag.tag));
    const frontmatter = cache?.frontmatter;
    if (frontmatter) {
      notesWithFrontmatter += 1;
      for (const key of Object.keys(frontmatter)) {
        frontmatterCounts.set(key, (frontmatterCounts.get(key) ?? 0) + 1);
      }
      for (const frontmatterTag of collectFrontmatterTags(frontmatter.tags)) {
        tags.add(normalizeTag(frontmatterTag));
      }
      for (const frontmatterTag of collectFrontmatterTags(frontmatter.tag)) {
        tags.add(normalizeTag(frontmatterTag));
      }
    }

    if (/^- \[[ xX]\]/m.test(content) || /^\* \[[ xX]\]/m.test(content)) {
      notesWithTasks += 1;
    }

    const folder = folderName(file.path);
    const topFolder = topFolderFromPath(file.path);
    const depth = Math.max(0, file.path.split('/').length - 2);
    const depthBand = depth === 0 ? '根目录' : depth === 1 ? '一级目录' : depth === 2 ? '二级目录' : '深层目录';
    const outboundLinks = Object.values(resolvedLinks[file.path] ?? {}).reduce((sum, count) => sum + count, 0);
    const inboundLinks = inboundCounts.get(file.path) ?? 0;
    const preview = extractPreview(content);
    const wordCount = countWords(content);
    const tagList = Array.from(tags).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
    const frontmatterKeys = frontmatter ? Object.keys(frontmatter).sort((a, b) => a.localeCompare(b)) : [];

    folderCounts.set(folder, (folderCounts.get(folder) ?? 0) + 1);
    topFolderCounts.set(topFolder, (topFolderCounts.get(topFolder) ?? 0) + 1);
    depthBandCounts.set(depthBand, (depthBandCounts.get(depthBand) ?? 0) + 1);
    for (const tag of tagList) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }

    totalWords += wordCount;
    totalOutboundLinks += outboundLinks;

    profiles.push({
      path: file.path,
      name: file.basename,
      folder,
      topFolder,
      tags: tagList,
      frontmatterKeys,
      wordCount,
      outboundLinks,
      inboundLinks,
      createdAt: file.stat.ctime,
      updatedAt: file.stat.mtime,
      preview,
      isOrphan: outboundLinks === 0 && inboundLinks === 0,
    });
  }

  const now = Date.now();
  const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000);
  const recentNotes = profiles.filter((note) => note.updatedAt >= weekAgo).length;
  const previousWindow = profiles.filter((note) => note.updatedAt >= twoWeeksAgo && note.updatedAt < weekAgo).length;
  const weeklyGrowth = recentNotes - previousWindow;
  const accents = ['#ef7d57', '#f3c969', '#6bc4a0', '#4f7cff', '#f17fb0'];

  return {
    generatedAt: now,
    totalNotes: profiles.length,
    totalFolders: folderCounts.size,
    totalTags: tagCounts.size,
    totalWords,
    totalOutboundLinks,
    totalInboundLinks,
    unresolvedLinks: Object.values(unresolvedLinks).reduce(
      (sum, targets) => sum + Object.values(targets).reduce((count, value) => count + value, 0),
      0,
    ),
    orphanNotes: profiles.filter((note) => note.isOrphan).length,
    notesWithFrontmatter,
    notesWithTasks,
    recentNotes,
    weeklyGrowth,
    averageWordsPerNote: profiles.length === 0 ? 0 : Math.round(totalWords / profiles.length),
    activityLast7Days: buildActivitySeries(files),
    topFolders: createRankedStats(topFolderCounts, 6, undefined, accents),
    topTags: createRankedStats(tagCounts, 8, undefined, accents),
    topFrontmatterKeys: createRankedStats(frontmatterCounts, 6, undefined, accents),
    topLinkedNotes: profiles
      .filter((note) => note.inboundLinks > 0)
      .sort((a, b) => b.inboundLinks - a.inboundLinks || b.updatedAt - a.updatedAt)
      .slice(0, 6)
      .map((note, index) => ({
        label: note.name,
        value: note.inboundLinks,
        hint: note.folder,
        path: note.path,
        accent: accents[index % accents.length],
      })),
    folderDepthBands: createRankedStats(depthBandCounts, 4, undefined, accents),
    recentlyUpdatedNotes: [...profiles]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 6),
    newestNotes: [...profiles]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 6),
    quietNotes: [...profiles]
      .filter((note) => note.wordCount > 0)
      .sort((a, b) => a.inboundLinks - b.inboundLinks || a.outboundLinks - b.outboundLinks || b.wordCount - a.wordCount)
      .slice(0, 6),
  };
}
