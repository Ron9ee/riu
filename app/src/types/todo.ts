export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  created: Date;
}

export interface TimeBlock {
  id: string;
  categoryId: string;
  dayOfWeek: number; 
  startTime: number; 
  endTime: number;   
  taskId?: string;      
  label?: string;       
  isBusy?: boolean;     
  date?: string;        
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  categoryId?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  created: Date;
  updated: Date;
  pomodoroSessions: PomodoroSession[];
  estimatedPomodoros?: number;
  order: number;
  workspaceUrls?: string[]; 

  
  scheduledDate?: string; 
  scheduledTime?: number; 
  duration?: number; 
}

export interface CompletedTask {
  id: string;
  title: string;
  description?: string;
  categoryId?: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  created: Date;
  completed: Date;
  pomodoroSessions: PomodoroSession[];
  estimatedPomodoros?: number;
  totalPomodoros: number; 
}

export interface PomodoroSession {
  id: string;
  taskId: string;
  started: Date;
  ended?: Date;
  duration: number; 
  completed: boolean; 
  type: 'work' | 'shortBreak' | 'longBreak';
  pauses?: { start: Date; end: Date }[]; 
}

export interface Notes {
  global: string; 
  categories: { [categoryId: string]: string }; 
}

export interface UserData {
  categories: Category[];
  tasks: Task[];
  completedTasks: CompletedTask[];
  pomodoroSessions: PomodoroSession[];
  timeBlocks: TimeBlock[]; 
  notes?: Notes; 
  settings: {
    workDuration: number; 
    shortBreakDuration: number; 
    longBreakDuration: number; 
    sessionsUntilLongBreak: number;
    autoStartBreaks: boolean;
    autoStartPomodoros: boolean;
    theme?: 'clean' | 'retro'; 
    themeMode?: 'light' | 'dark' | 'auto'; 
    pomodoroSound?: boolean; 
  };
}

export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: 'work',
    name: 'Work',
    color: '#3B82F6',
    icon: '💼',
    created: new Date(),
  },
  {
    id: 'coding',
    name: 'Coding',
    color: '#10B981',
    icon: '💻',
    created: new Date(),
  },
  {
    id: 'hobby',
    name: 'Hobby',
    color: '#F59E0B',
    icon: '🎨',
    created: new Date(),
  },
  {
    id: 'personal',
    name: 'Personal',
    color: '#EF4444',
    icon: '🏠',
    created: new Date(),
  },
];

export const DEFAULT_SETTINGS = {
  workDuration: 30,
  shortBreakDuration: 5,
  longBreakDuration: 10,
  sessionsUntilLongBreak: 4,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  theme: 'clean' as 'clean' | 'retro',
  themeMode: 'auto' as 'light' | 'dark' | 'auto',
  pomodoroSound: true,
};
