export interface DailyTodoListSettings {
  useDailyNotesPluginSettings: boolean;
  dailyNoteFolder: string;
  dailyNoteFormat: string;
  todoHeading: string;
  insertPosition: 'top' | 'bottom';
  showCompleted: boolean;
  openViewOnStartup: boolean;
  autoCreateDailyNote: boolean;
  calendarDefaultView: 'today' | 'calendar' | 'gantt';
  ganttLookbackDays: number;
  ganttLookaheadDays: number;
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
}

export interface DailyTask extends TodoTask {
  date: string;
  filePath: string;
}

export interface CalendarDaySummary {
  date: string;
  total: number;
  completed: number;
  scheduled: number;
}
