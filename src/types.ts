export type DailyTodoListTab = 'home' | 'today' | 'journal' | 'memo' | 'calendar' | 'gantt' | 'stats';

export interface DailyTodoListSettings {
  useDailyNotesPluginSettings: boolean;
  dailyNoteFolder: string;
  dailyNoteFormat: string;
  todoHeading: string;
  memoHeading: string;
  journalHeading: string;
  insertPosition: 'top' | 'bottom';
  showCompleted: boolean;
  openViewOnStartup: boolean;
  autoCreateDailyNote: boolean;
  calendarDefaultView: DailyTodoListTab;
  ganttLookbackDays: number;
  ganttLookaheadDays: number;
  priorityOptions: PriorityOption[];
  notificationsEnabled: boolean;
  notificationTimes: string;
  notificationGraceMinutes: number;
  notificationIncludePending: boolean;
  notificationIncludeCompleted: boolean;
  notificationIncludeJournal: boolean;
  notificationIncludeMemos: boolean;
  localNoticeEnabled: boolean;
  systemNotificationEnabled: boolean;
  webhookEnabled: boolean;
  webhookUrl: string;
  webhookMethod: 'POST' | 'PUT';
  webhookSecret: string;
  webhookHeaders: string;
  notificationHistory: Record<string, number>;
}

export interface PriorityOption {
  id: string;
  label: string;
  color: string;
}

export interface TodoTask {
  id: string;
  line: number;
  text: string;
  completed: boolean;
  raw: string;
  displayText?: string;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  priority?: string;
}

export interface DailyTask extends TodoTask {
  date: string;
  filePath: string;
}

export interface MemoItem {
  id: string;
  line: number;
  text: string;
  raw: string;
}

export interface DailyMemo extends MemoItem {
  date: string;
  filePath: string;
}

export interface DailyJournal {
  text: string;
  date: string;
  filePath: string;
}

export interface NotificationDigest {
  date: string;
  filePath: string;
  pendingTasks: DailyTask[];
  completedTasks: DailyTask[];
  journal: DailyJournal | null;
  memos: DailyMemo[];
}

export interface CalendarDaySummary {
  date: string;
  total: number;
  completed: number;
  scheduled: number;
}

export interface RankedStat {
  label: string;
  value: number;
  hint?: string;
  path?: string;
  accent?: string;
}

export interface TimelinePoint {
  date: string;
  label: string;
  value: number;
}

export interface VaultNoteProfile {
  path: string;
  name: string;
  folder: string;
  topFolder: string;
  tags: string[];
  frontmatterKeys: string[];
  wordCount: number;
  outboundLinks: number;
  inboundLinks: number;
  createdAt: number;
  updatedAt: number;
  preview: string;
  isOrphan: boolean;
}

export interface VaultAnalytics {
  generatedAt: number;
  totalNotes: number;
  totalFolders: number;
  totalTags: number;
  totalWords: number;
  totalOutboundLinks: number;
  totalInboundLinks: number;
  unresolvedLinks: number;
  orphanNotes: number;
  notesWithFrontmatter: number;
  notesWithTasks: number;
  recentNotes: number;
  weeklyGrowth: number;
  averageWordsPerNote: number;
  activityLast7Days: TimelinePoint[];
  topFolders: RankedStat[];
  topTags: RankedStat[];
  topFrontmatterKeys: RankedStat[];
  topLinkedNotes: RankedStat[];
  folderDepthBands: RankedStat[];
  recentlyUpdatedNotes: VaultNoteProfile[];
  newestNotes: VaultNoteProfile[];
  quietNotes: VaultNoteProfile[];
}
