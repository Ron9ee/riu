import type { UserData, Category, Task, PomodoroSession, CompletedTask } from '@/types/todo';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from '@/types/todo';
import { computeTimeLeftSeconds, sanitizePausedSeconds } from '@/utils/pomodoroTime';

const STORAGE_KEY = 'riu_user_data';
const POMODORO_STATE_KEY = 'riu_pomodoro_state';


const reviveDate = (_key: string, value: unknown) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)) {
    return new Date(value);
  }
  return value;
};


export interface PomodoroState {
  isRunning: boolean;
  timeLeft: number; 
  currentSession: PomodoroSession | null;
  sessionType: 'work' | 'shortBreak' | 'longBreak';
  justCompleted: boolean;
  currentTaskId: string | null;
  startedAt: number | null; 
  pausedAt: number | null; 
  totalPausedTime: number; 
  overtimeAutoPaused: {
    sessionType: 'work' | 'shortBreak' | 'longBreak';
    triggeredAt: number;
    overtimeSeconds: number;
  } | null;
}


export const loadPomodoroState = (): PomodoroState | null => {
  try {
    const storedState = localStorage.getItem(POMODORO_STATE_KEY);
    if (storedState) {
      const parsed = JSON.parse(storedState, reviveDate) as PomodoroState;

      
      const safeTotalPausedTime = sanitizePausedSeconds(parsed.totalPausedTime);

      
      if (parsed.isRunning && parsed.startedAt && parsed.currentSession) {
        const actualTimeLeft = computeTimeLeftSeconds({
          startedAt: parsed.startedAt,
          durationMinutes: parsed.currentSession.duration,
          totalPausedSeconds: safeTotalPausedTime,
          isRunning: parsed.isRunning,
        });

        return {
          ...parsed,
          timeLeft: actualTimeLeft,
          totalPausedTime: safeTotalPausedTime,
        };
      }

      
      if (!parsed.isRunning && parsed.pausedAt && parsed.currentSession) {
        return {
          ...parsed,
          totalPausedTime: safeTotalPausedTime,
        };
      }

      return {
        ...parsed,
        totalPausedTime: safeTotalPausedTime,
        overtimeAutoPaused: parsed.overtimeAutoPaused
          ? {
            ...parsed.overtimeAutoPaused,
            triggeredAt: new Date(parsed.overtimeAutoPaused.triggeredAt).getTime(),
          }
          : null,
      };
    }
  } catch (error) {
    console.error('Error loading pomodoro state:', error);
  }

  return null;
};


export const savePomodoroState = (state: PomodoroState): void => {
  try {
    localStorage.setItem(POMODORO_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving pomodoro state:', error);
  }
};


export const clearPomodoroState = (): void => {
  try {
    localStorage.removeItem(POMODORO_STATE_KEY);
  } catch (error) {
    console.error('Error clearing pomodoro state:', error);
  }
};


export const debugPomodoroState = (): void => {
  const savedState = loadPomodoroState();
  const userData = loadUserData();

  console.log('=== Pomodoro State Debug ===');
  console.log('Saved pomodoro state:', savedState);
  console.log('User data tasks:', userData.tasks.length);
  console.log('User data pomodoro sessions:', userData.pomodoroSessions.length);
  console.log('===========================');
};


export const loadUserData = (): UserData => {
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      const parsed = JSON.parse(storedData, reviveDate) as UserData;

      
      const tasks = (parsed.tasks || []).map((task, index) => ({
        ...task,
        
        order: task.order !== undefined ? task.order : index,
      }));

      
      let categories = parsed.categories || DEFAULT_CATEGORIES;

      
      categories = categories.map(category => ({
        id: category.id || generateId(),
        name: category.name || 'Unnamed Category',
        color: category.color || '#6B7280',
        icon: category.icon || '📁',
        created: category.created || new Date(),
      }));

      
      const uniqueCategories = categories.filter((category, index, self) =>
        index === self.findIndex(c => c.id === category.id)
      );

      
      if (uniqueCategories.length === 0) {
        categories = DEFAULT_CATEGORIES;
      }

      
      const validCategoryIds = new Set(uniqueCategories.map(c => c.id));
      const migratedTasks = tasks.map(task => {
        if (task.categoryId && !validCategoryIds.has(task.categoryId)) {
          console.warn(`Task "${task.title}" had invalid category ID "${task.categoryId}", migrating to default category`);
          return { ...task, categoryId: uniqueCategories[0].id };
        }
        return task;
      });


      return {
        categories: uniqueCategories,
        tasks: migratedTasks,
        completedTasks: parsed.completedTasks || [],
        pomodoroSessions: parsed.pomodoroSessions || [],
        notes: parsed.notes || { global: '', categories: {} },
        settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
        timeBlocks: parsed.timeBlocks || [],
      };
    }
  } catch (error) {
    console.error('Error loading user data:', error);
  }

  
  return {
    categories: DEFAULT_CATEGORIES,
    tasks: [],
    completedTasks: [],
    pomodoroSessions: [],
    notes: { global: '', categories: {} },
    settings: DEFAULT_SETTINGS,
  };
};


export const saveUserData = (userData: UserData): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
  } catch (error) {
    console.error('Error saving user data:', error);
  }
};


export const saveCategory = (category: Category): void => {
  const userData = loadUserData();
  const existingIndex = userData.categories.findIndex(c => c.id === category.id);

  
  const validatedCategory: Category = {
    id: category.id || generateId(),
    name: category.name || 'Unnamed Category',
    color: category.color || '#6B7280',
    icon: category.icon || '📁',
    created: category.created || new Date(),
  };

  if (existingIndex >= 0) {
    userData.categories[existingIndex] = validatedCategory;
  } else {
    userData.categories.push(validatedCategory);
  }

  saveUserData(userData);
};

export const deleteCategory = (categoryId: string): void => {
  const userData = loadUserData();
  userData.categories = userData.categories.filter(c => c.id !== categoryId);
  
  userData.tasks = userData.tasks.filter(t => t.categoryId !== categoryId);
  saveUserData(userData);
};

export const saveTask = (task: Task): void => {
  const userData = loadUserData();
  const existingIndex = userData.tasks.findIndex(t => t.id === task.id);

  if (existingIndex >= 0) {
    userData.tasks[existingIndex] = { ...task, updated: new Date() };
  } else {
    userData.tasks.push(task);
  }

  saveUserData(userData);
};

export const deleteTask = (taskId: string): void => {
  const userData = loadUserData();
  userData.tasks = userData.tasks.filter(t => t.id !== taskId);
  userData.pomodoroSessions = userData.pomodoroSessions.filter(p => p.taskId !== taskId);
  saveUserData(userData);
};

export const savePomodoroSession = (session: PomodoroSession): void => {
  const userData = loadUserData();
  const existingIndex = userData.pomodoroSessions.findIndex(p => p.id === session.id);

  if (existingIndex >= 0) {
    userData.pomodoroSessions[existingIndex] = session;
  } else {
    userData.pomodoroSessions.push(session);
  }

  saveUserData(userData);
};

export const updateSettings = (settings: Partial<UserData['settings']>): void => {
  const userData = loadUserData();
  userData.settings = { ...userData.settings, ...settings };
  saveUserData(userData);
};

export const saveCompletedTask = (completedTask: CompletedTask): void => {
  const userData = loadUserData();
  const existingIndex = userData.completedTasks.findIndex(t => t.id === completedTask.id);

  if (existingIndex >= 0) {
    userData.completedTasks[existingIndex] = completedTask;
  } else {
    userData.completedTasks.push(completedTask);
  }

  saveUserData(userData);
};


export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};



