export type DailyTodoListTab = 'home' | 'today' | 'journal' | 'memo' | 'calendar' | 'gantt' | 'stats' | 'ai';
export type AIProviderId = 'claude-code' | 'codex' | 'opencode';
export type AIContextSource = 'current-note' | 'today-journal' | 'today-tasks';
export type AIExecutionStatus = 'idle' | 'running' | 'success' | 'error' | 'stopped';

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
  aiOutputFolder: string;
  aiProviders: AIProviderConfig[];
  priorityOptions: PriorityOption[];
}

export interface AIProviderConfig {
  id: AIProviderId;
  label: string;
  executablePath: string;
  argsTemplate: string;
  workingDirectory: string;
  enabled: boolean;
}

export interface AIContextSelection {
  currentNote: boolean;
  todayJournal: boolean;
  todayTasks: boolean;
}

export interface AIExecutionState {
  status: AIExecutionStatus;
  stdout: string;
  stderr: string;
  commandSummary: string;
}

export interface AIContextAttachment {
  source: AIContextSource;
  label: string;
  content: string;
}

export interface AIRunRequest {
  provider: AIProviderConfig;
  prompt: string;
  contextText: string;
  workingDirectory: string;
}

export interface AIExecutionCallbacks {
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
  onExit?: (exitCode: number | null) => void;
  onError?: (error: Error) => void;
}

export interface AIRunHandle {
  commandSummary: string;
  stop: () => void;
}

export interface AIProviderResolvedCommand {
  command: string;
  args: string[];
  cwd: string;
}

export interface AIProviderAdapter {
  buildRequest: (request: AIRunRequest) => AIProviderResolvedCommand;
}

export interface AICommandPanelState {
  selectedProviderId: AIProviderId;
  prompt: string;
  contextSelection: AIContextSelection;
  execution: AIExecutionState;
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
