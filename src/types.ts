export interface DailyTodoListSettings {
  useDailyNotesPluginSettings: boolean;
  dailyNoteFolder: string;
  dailyNoteFormat: string;
  todoHeading: string;
  memoHeading: string;
  insertPosition: 'top' | 'bottom';
  showCompleted: boolean;
  openViewOnStartup: boolean;
  autoCreateDailyNote: boolean;
  calendarDefaultView: 'home' | 'today' | 'memo' | 'calendar' | 'gantt' | 'stats';
  ganttLookbackDays: number;
  ganttLookaheadDays: number;
  priorityOptions: PriorityOption[];
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

export interface CalendarDaySummary {
  date: string;
  total: number;
  completed: number;
  scheduled: number;
}
