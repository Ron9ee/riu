import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { UserData, Category, Task, PomodoroSession, CompletedTask, TimeBlock } from '@/types/todo';
import { DEFAULT_CATEGORIES } from '@/types/todo';
import { loadUserData, saveUserData, generateId, loadPomodoroState, savePomodoroState, clearPomodoroState, type PomodoroState } from '@/utils/storage';
import { computeTimeLeftSeconds, sanitizePausedSeconds } from '@/utils/pomodoroTime';

type OvertimeAutoPausedState = {
  sessionType: 'work' | 'shortBreak' | 'longBreak';
  triggeredAt: Date;
  overtimeSeconds: number;
};

interface TodoContextType {
  userData: UserData;
  selectedCategoryId: string | null;
  currentTaskId: string | null;
  currentTask: Task | null;
  pomodoroTimer: {
    isRunning: boolean;
    timeLeft: number; 
    currentSession: PomodoroSession | null;
    sessionType: 'work' | 'shortBreak' | 'longBreak';
    justCompleted: boolean; 
    pausedAt: Date | null; 
    totalPausedTime: number; 
    overtimeAutoPaused: OvertimeAutoPausedState | null;
  };

  
  addCategory: (name: string, color: string, icon: string) => void;
  updateCategory: (categoryId: string, updates: Partial<Category>) => void;
  deleteCategory: (categoryId: string) => void;
  setSelectedCategory: (categoryId: string | null) => void;
  resetCategoriesToDefault: () => void;

  
  addTask: (title: string, categoryId?: string, description?: string, dueDate?: Date, estimatedPomodoros?: number, workspaceUrls?: string[]) => string;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  deleteTask: (taskId: string) => void;
  toggleTaskComplete: (taskId: string) => void;
  reorderTasks: (taskIds: string[]) => void;

  
  startPomodoro: (task: Task) => void;
  pausePomodoro: () => void;
  resumePomodoro: () => void;
  stopPomodoro: () => void;
  completePomodoro: () => void;
  completeWorkSession: () => Promise<void>; 
  startNextSession: () => Promise<void>; 
  skipBreak: () => void; 
  debugSetTimerTo10Seconds: () => void; 
  debugSetTimerTo14m45Overtime: () => void; 
  debugStart30SecondTimer: () => void; 
  debugAdd23Minutes: () => void; 

  
  updateUserNotes: (type: 'global' | 'category', content: string, categoryId?: string) => void;

  
  addTimeBlock: (categoryId: string, dayOfWeek: number, startTime: number, endTime: number, taskId?: string, label?: string, isBusy?: boolean, date?: string) => void;
  updateTimeBlock: (id: string, updates: Partial<TimeBlock>) => void;
  deleteTimeBlock: (id: string) => void;
}

const TodoContext = createContext<TodoContextType | undefined>(undefined);

export const useTodo = () => {
  const context = useContext(TodoContext);
  if (context === undefined) {
    throw new Error('useTodo must be used within a TodoProvider');
  }
  return context;
};

export const TodoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userData, setUserData] = useState<UserData>(loadUserData);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const isStoppingRef = useRef(false);

  
  const [pomodoroTimer, setPomodoroTimer] = useState(() => {
    const savedState = loadPomodoroState();
    if (savedState) {
      const safeTotalPausedTime = sanitizePausedSeconds(savedState.totalPausedTime);
      const restoredTimeLeft = savedState.isRunning && savedState.currentSession && savedState.startedAt
        ? computeTimeLeftSeconds({
          startedAt: savedState.startedAt,
          durationMinutes: savedState.currentSession.duration,
          totalPausedSeconds: safeTotalPausedTime,
          isRunning: savedState.isRunning,
          pausedAt: savedState.pausedAt ?? null,
        })
        : savedState.timeLeft;

      return {
        isRunning: savedState.isRunning,
        timeLeft: restoredTimeLeft,
        currentSession: savedState.currentSession,
        sessionType: savedState.sessionType,
        justCompleted: savedState.justCompleted,
        pausedAt: savedState.pausedAt ? new Date(savedState.pausedAt) : null,
        totalPausedTime: safeTotalPausedTime,
        overtimeAutoPaused: savedState.overtimeAutoPaused
          ? {
            sessionType: savedState.overtimeAutoPaused.sessionType,
            triggeredAt: new Date(savedState.overtimeAutoPaused.triggeredAt),
            overtimeSeconds: savedState.overtimeAutoPaused.overtimeSeconds,
          }
          : null,
      };
    }
    return {
      isRunning: false,
      timeLeft: 0,
      currentSession: null as PomodoroSession | null,
      sessionType: 'work' as 'work' | 'shortBreak' | 'longBreak',
      justCompleted: false,
      pausedAt: null as Date | null,
      totalPausedTime: 0,
      overtimeAutoPaused: null,
    };
  });

  
  const getCurrentTask = (): Task | null => {
    return currentTaskId ? userData.tasks.find(t => t.id === currentTaskId) || null : null;
  };

  
  useEffect(() => {
    const savedState = loadPomodoroState();
    if (savedState?.currentTaskId && !currentTaskId) {
      const task = userData.tasks.find(t => t.id === savedState.currentTaskId);
      if (task) {
        setCurrentTaskId(savedState.currentTaskId);
      }
    }
  }, [userData, currentTaskId]);

  
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'riu_pomodoro_state' && e.newValue) {
        try {
          const savedState = JSON.parse(e.newValue);
          
          
          setPomodoroTimer(prev => {
            const timeDiff = Math.abs(prev.timeLeft - savedState.timeLeft);
            const shouldUpdate =
              prev.isRunning !== savedState.isRunning ||
              prev.sessionType !== savedState.sessionType ||
              timeDiff > 2 ||
              prev.currentSession?.id !== savedState.currentSession?.id;

            if (shouldUpdate) {
              
              const safeTotalPausedTime = typeof savedState.totalPausedTime === 'number'
                ? savedState.totalPausedTime
                : 0;

              return {
                isRunning: savedState.isRunning,
                timeLeft: savedState.timeLeft,
                currentSession: savedState.currentSession ? {
                  ...savedState.currentSession,
                  started: new Date(savedState.currentSession.started),
                  ended: savedState.currentSession.ended ? new Date(savedState.currentSession.ended) : undefined,
                } : null,
                sessionType: savedState.sessionType,
                justCompleted: savedState.justCompleted,
                pausedAt: savedState.pausedAt ? new Date(savedState.pausedAt) : null,
                totalPausedTime: safeTotalPausedTime,
                overtimeAutoPaused: savedState.overtimeAutoPaused
                  ? {
                    sessionType: savedState.overtimeAutoPaused.sessionType,
                    triggeredAt: new Date(savedState.overtimeAutoPaused.triggeredAt),
                    overtimeSeconds: savedState.overtimeAutoPaused.overtimeSeconds,
                  }
                  : null,
              };
            }
            return prev;
          });
        } catch (err) {
          console.error('Failed to parse synced pomodoro state', err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveUserData(userData);
    }, 100); 

    return () => clearTimeout(timeoutId);
  }, [userData]);

  
  useEffect(() => {
    if (isStoppingRef.current) return;

    const pomodoroState: PomodoroState = {
      isRunning: pomodoroTimer.isRunning,
      timeLeft: pomodoroTimer.timeLeft,
      currentSession: pomodoroTimer.currentSession,
      sessionType: pomodoroTimer.sessionType,
      justCompleted: pomodoroTimer.justCompleted,
      currentTaskId: currentTaskId,
      startedAt: pomodoroTimer.currentSession
        ? pomodoroTimer.currentSession.started.getTime()
        : null,
      pausedAt: pomodoroTimer.pausedAt ? pomodoroTimer.pausedAt.getTime() : null,
      totalPausedTime: sanitizePausedSeconds(pomodoroTimer.totalPausedTime),
      overtimeAutoPaused: pomodoroTimer.overtimeAutoPaused ? {
        ...pomodoroTimer.overtimeAutoPaused,
        triggeredAt: pomodoroTimer.overtimeAutoPaused.triggeredAt.getTime()
      } : null,
    };

    
    if (pomodoroTimer.currentSession || pomodoroTimer.justCompleted) {
      savePomodoroState(pomodoroState);
    } else {
      clearPomodoroState();
    }
  }, [pomodoroTimer, currentTaskId]);

  
  useEffect(() => {
    const currentTask = getCurrentTask();
    if (pomodoroTimer.currentSession && currentTask) {
      
      const absSeconds = Math.abs(pomodoroTimer.timeLeft);
      const minutes = Math.floor(absSeconds / 60);
      const seconds = absSeconds % 60;
      const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      const formattedTime = pomodoroTimer.timeLeft < 0 ? `+${timeStr}` : timeStr;

      const emoji = pomodoroTimer.sessionType === 'work' ? '🍅' : '☕';
      const sessionName = pomodoroTimer.sessionType === 'work' ? 'Focus' : 'Break';

      document.title = `${emoji} ${formattedTime} - ${sessionName} | ${currentTask.title} | Riu`;
    } else {
      document.title = 'Riu Dashboard';
    }

    
    return () => {
      document.title = 'Riu Dashboard';
    };
  }, [pomodoroTimer.timeLeft, pomodoroTimer.sessionType, currentTaskId, pomodoroTimer.currentSession]);

  
  const playNotificationSound = (soundFile: string = '/sound.mp3') => {
    
    if (userData.settings.pomodoroSound === false) {
      console.log('🔇 Sounds are disabled in settings');
      return;
    }

    try {
      console.log(`🔊 Attempting to play notification sound: ${soundFile}`);

      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      
      fetch(soundFile)
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
        .then(audioBuffer => {
          const source = audioContext.createBufferSource();
          const gainNode = audioContext.createGain();

          source.buffer = audioBuffer;
          source.connect(gainNode);
          gainNode.connect(audioContext.destination);

          gainNode.gain.setValueAtTime(0.7, audioContext.currentTime);

          source.start(audioContext.currentTime);
          console.log(`🔊 Sound played successfully: ${soundFile}`);
        })
        .catch(error => {
          console.log(`🔊 Could not load audio file ${soundFile}:`, error);
          
          console.log('🔊 Trying fallback beep sound...');
          try {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
            console.log('🔊 Fallback beep played');
          } catch (fallbackError) {
            console.log('🔊 Fallback beep also failed:', fallbackError);
          }
        });
    } catch (error) {
      console.log('🔊 Could not play notification sound:', error);
    }
  };

  
  const playPomodoroCompleteSound = () => playNotificationSound('/pomodoro_complete.mp3');
  const playBreakCompleteSound = () => playNotificationSound('/break_complete.mp3');
  const playTaskCompleteSound = () => playNotificationSound('/task_complete.wa.mp3');
  const playOvertimeReminderSound = () => playNotificationSound('/overtime_reminder.mp3');
  const playBreakOvertimeReminderSound = () => playNotificationSound('/break_complete_reminder.mp3');

  
  const showNotification = (title: string, body: string, icon?: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: icon || '/favicon.ico',
        tag: 'pomodoro-notification'
      });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, {
            body,
            icon: icon || '/favicon.ico',
            tag: 'pomodoro-notification'
          });
        }
      });
    }
  };

  
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let lastOvertimeNotification = 0; 

    if (pomodoroTimer.isRunning && pomodoroTimer.currentSession) {
      interval = setInterval(() => {
        const now = Date.now();
        const safeTotalPausedTime = sanitizePausedSeconds(pomodoroTimer.totalPausedTime);
        const actualTimeLeft = computeTimeLeftSeconds({
          startedAt: pomodoroTimer.currentSession!.started,
          durationMinutes: pomodoroTimer.currentSession!.duration,
          totalPausedSeconds: safeTotalPausedTime,
          isRunning: true,
          now,
        });
        const safeActualTimeLeft = Number.isFinite(actualTimeLeft) ? actualTimeLeft : pomodoroTimer.timeLeft;

        setPomodoroTimer(prev => {
          
          
          if (!prev.isRunning) return prev;

          const currentTask = getCurrentTask();

          if (safeActualTimeLeft <= 0 && prev.timeLeft > 0) {
            if (prev.sessionType === 'shortBreak') {
              playBreakCompleteSound();
              showNotification(
                '☕ Break Complete!',
                'Break time is over. Ready to get back to work?'
              );
            } else if (prev.sessionType === 'work') {
              playPomodoroCompleteSound();
              showNotification(
                '🍅 Pomodoro Complete!',
                `Great job! You completed a focus session${currentTask ? ` on "${currentTask.title}"` : ''}. You can continue working or take a break!`
              );
            }
          }

          const overtimeSeconds = Math.abs(safeActualTimeLeft);
          const hasExceededOvertimeThreshold = safeActualTimeLeft <= -900; 
          const isAlreadyAutoPaused = prev.overtimeAutoPaused !== null;
          const shouldAutoPause = hasExceededOvertimeThreshold && !isAlreadyAutoPaused;
          const shouldNotifyOvertime = safeActualTimeLeft < 0;
          const overtimeMinutes = Math.floor(overtimeSeconds / 60);
          const timeSinceLastNotification = now - lastOvertimeNotification;
          const isNotificationIntervalReached = overtimeMinutes > 0 && overtimeMinutes % 5 === 0 && timeSinceLastNotification > 4 * 60 * 1000;
          const isWorkSession = prev.sessionType === 'work';
          const isBreakSession = prev.sessionType === 'shortBreak';

          if (shouldAutoPause) {
            if (isWorkSession) {
              playOvertimeReminderSound();
            } else if (isBreakSession) {
              playBreakOvertimeReminderSound();
            }
            showNotification(
              isWorkSession ? '⏰ Focus Session Paused' : '⏰ Break Paused',
              `You have been ${isWorkSession ? 'working' : 'on break'} ${overtimeMinutes} minutes overtime. Are you still there?`
            );

            return {
              ...prev,
              isRunning: false,
              pausedAt: new Date(now),
              timeLeft: safeActualTimeLeft,
              overtimeAutoPaused: {
                sessionType: prev.sessionType,
                triggeredAt: new Date(now),
                overtimeSeconds,
              },
            };
          }

          if (shouldNotifyOvertime && isNotificationIntervalReached && !shouldAutoPause) {
            if (isWorkSession) {
              playOvertimeReminderSound();
              showNotification(
                '⏰ Still Working!',
                `You've been working for ${overtimeMinutes} minutes overtime. Consider taking a break!`
              );
            } else if (isBreakSession) {
              playBreakOvertimeReminderSound();
              showNotification(
                '⏰ Break Overdue!',
                `You've been on break for ${overtimeMinutes} minutes longer than planned. Ready to get back to work?`
              );
            }
            lastOvertimeNotification = now;
          }

          return {
            ...prev,
            timeLeft: safeActualTimeLeft,
            totalPausedTime: safeTotalPausedTime,
            overtimeAutoPaused: shouldNotifyOvertime ? prev.overtimeAutoPaused : null,
          };
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [pomodoroTimer.isRunning, pomodoroTimer.currentSession, pomodoroTimer.totalPausedTime, currentTaskId]);

  
  useEffect(() => {
    const savedState = loadPomodoroState();
    if (savedState && savedState.currentSession) {
      
      const associatedTask = userData.tasks.find(task => task.id === savedState.currentSession!.taskId);
      if (associatedTask && associatedTask.completed) {
        
        console.log('Not restoring pomodoro session - associated task is completed:', associatedTask.title);
        clearPomodoroState();
        setPomodoroTimer(createSafePomodoroState());
        setCurrentTaskId(null);
        return;
      }

      
      const safeTotalPausedTime = sanitizePausedSeconds(savedState.totalPausedTime);
      const actualTimeLeft = computeTimeLeftSeconds({
        startedAt: savedState.currentSession.started,
        durationMinutes: savedState.currentSession.duration,
        totalPausedSeconds: safeTotalPausedTime,
        isRunning: savedState.isRunning,
        pausedAt: savedState.pausedAt ?? null,
      });

      
      if (actualTimeLeft < 0) {
        if (savedState.sessionType === 'work') {
          showNotification(
            '⏰ Session Overdue!',
            `Your pomodoro session has been running longer than planned. Consider taking a break!`
          );
        }
      }

      
      const maxAllowedTime = savedState.currentSession.duration * 120; 
      if (actualTimeLeft < -maxAllowedTime) {
        
        showNotification(
          '⏰ Session Auto-Stopped',
          'Your pomodoro session was running for too long and has been automatically stopped.'
        );
        clearPomodoroState();
        setPomodoroTimer(createSafePomodoroState());
        setCurrentTaskId(null);
      } else {
        
        setPomodoroTimer(createSafePomodoroState({
          isRunning: savedState.isRunning,
          timeLeft: savedState.isRunning ? actualTimeLeft : savedState.timeLeft,
          currentSession: savedState.currentSession,
          sessionType: savedState.sessionType,
          justCompleted: false,
          pausedAt: savedState.pausedAt ? new Date(savedState.pausedAt) : null,
          totalPausedTime: safeTotalPausedTime,
        }));

        
        if (savedState.currentTaskId) {
          setCurrentTaskId(savedState.currentTaskId);
        }
      }
    }
  }, [userData.tasks]);

  
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (pomodoroTimer.currentSession) {
        if (document.hidden) {
          
          
        } else {
          
          const safeTotalPausedTime = sanitizePausedSeconds(pomodoroTimer.totalPausedTime);
          const actualTimeLeft = computeTimeLeftSeconds({
            startedAt: pomodoroTimer.currentSession.started,
            durationMinutes: pomodoroTimer.currentSession.duration,
            totalPausedSeconds: safeTotalPausedTime,
            isRunning: pomodoroTimer.isRunning,
            pausedAt: pomodoroTimer.pausedAt,
          });

          
          if (Math.abs(actualTimeLeft - pomodoroTimer.timeLeft) > 1) {
            setPomodoroTimer(prev => ({
              ...prev,
              timeLeft: actualTimeLeft,
            }));
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pomodoroTimer.isRunning, pomodoroTimer.currentSession, pomodoroTimer.timeLeft]);

  
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pomodoro_state') {
        const newState = loadPomodoroState();
        if (!newState) {
          
          setPomodoroTimer(createSafePomodoroState());
          setCurrentTaskId(null);
        } else {
          
          
          
          setPomodoroTimer(prev => {
            
            if (prev.isRunning && !newState.isRunning) {
              return createSafePomodoroState(newState);
            }
            
            if (!prev.isRunning && newState.isRunning) {
              
              const safeTotalPausedTime = sanitizePausedSeconds(newState.totalPausedTime);
              const actualTimeLeft = computeTimeLeftSeconds({
                startedAt: newState.currentSession!.started,
                durationMinutes: newState.currentSession!.duration,
                totalPausedSeconds: safeTotalPausedTime,
                isRunning: newState.isRunning,
                pausedAt: newState.pausedAt ? new Date(newState.pausedAt) : null,
              });

              return {
                ...newState,
                timeLeft: actualTimeLeft,
                currentSession: newState.currentSession,
                pausedAt: newState.pausedAt ? new Date(newState.pausedAt) : null,
                overtimeAutoPaused: newState.overtimeAutoPaused ? {
                  ...newState.overtimeAutoPaused,
                  triggeredAt: new Date(newState.overtimeAutoPaused.triggeredAt)
                } : null
              };
            }
            return prev;
          });

          if (newState.currentTaskId) {
            setCurrentTaskId(newState.currentTaskId);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  
  useEffect(() => {
    const handleFocus = () => {
      if (pomodoroTimer.currentSession) {
        const safeTotalPausedTime = sanitizePausedSeconds(pomodoroTimer.totalPausedTime);
        const actualTimeLeft = computeTimeLeftSeconds({
          startedAt: pomodoroTimer.currentSession.started,
          durationMinutes: pomodoroTimer.currentSession.duration,
          totalPausedSeconds: safeTotalPausedTime,
          isRunning: pomodoroTimer.isRunning,
          pausedAt: pomodoroTimer.pausedAt,
        });

        
        if (Math.abs(actualTimeLeft - pomodoroTimer.timeLeft) > 1) {
          setPomodoroTimer(prev => ({
            ...prev,
            timeLeft: actualTimeLeft,
          }));
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [pomodoroTimer.currentSession, pomodoroTimer.isRunning, pomodoroTimer.timeLeft]);

  
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pomodoroTimer.currentSession && !isStoppingRef.current) {
        
        const safeTotalPausedTime = sanitizePausedSeconds(pomodoroTimer.totalPausedTime);

        const pomodoroState: PomodoroState = {
          isRunning: pomodoroTimer.isRunning,
          timeLeft: pomodoroTimer.timeLeft,
          currentSession: pomodoroTimer.currentSession,
          sessionType: pomodoroTimer.sessionType,
          justCompleted: pomodoroTimer.justCompleted,
          currentTaskId: currentTaskId,
          startedAt: pomodoroTimer.currentSession.started.getTime(),
          
          
          pausedAt: !pomodoroTimer.isRunning
            ? (pomodoroTimer.pausedAt ? pomodoroTimer.pausedAt.getTime() : Date.now())
            : null,
          totalPausedTime: safeTotalPausedTime,
          overtimeAutoPaused: pomodoroTimer.overtimeAutoPaused ? {
            ...pomodoroTimer.overtimeAutoPaused,
            triggeredAt: pomodoroTimer.overtimeAutoPaused.triggeredAt.getTime()
          } : null,
        };
        savePomodoroState(pomodoroState);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pomodoroTimer, currentTaskId]);

  
  const addCategory = (name: string, color: string, icon: string) => {
    const newCategory: Category = {
      id: generateId(),
      name,
      color,
      icon,
      created: new Date(),
    };

    setUserData(prev => ({
      ...prev,
      categories: [...prev.categories, newCategory],
    }));
  };

  const updateCategory = (categoryId: string, updates: Partial<Category>) => {
    setUserData(prev => ({
      ...prev,
      categories: prev.categories.map(cat =>
        cat.id === categoryId ? { ...cat, ...updates } : cat
      ),
    }));
  };

  const deleteCategory = (categoryId: string) => {
    setUserData(prev => ({
      ...prev,
      categories: prev.categories.filter(cat => cat.id !== categoryId),
      tasks: prev.tasks.filter(task => task.categoryId !== categoryId),
    }));
    if (selectedCategoryId === categoryId) {
      setSelectedCategoryId(null);
    }
  };

  const setSelectedCategory = (categoryId: string | null) => {
    setSelectedCategoryId(categoryId);
  };

  const resetCategoriesToDefault = () => {
    setUserData(prev => ({
      ...prev,
      categories: [...DEFAULT_CATEGORIES],
    }));
  };

  
  const addTask = (title: string, categoryId?: string, description?: string, dueDate?: Date, estimatedPomodoros?: number, workspaceUrls?: string[]): string => {
    const taskId = generateId();
    const nextOrder = Math.max(...userData.tasks.map(t => t.order), 0) + 1;
    const newTask: Task = {
      id: taskId,
      title,
      description,
      categoryId,
      completed: false,
      priority: 'medium',
      created: new Date(),
      updated: new Date(),
      dueDate,
      pomodoroSessions: [],
      estimatedPomodoros: estimatedPomodoros || 3,
      order: nextOrder,
      workspaceUrls: workspaceUrls || [],
    };
    setUserData(prev => ({
      ...prev,
      tasks: [...prev.tasks, newTask],
    }));
    return taskId;
  };

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    setUserData(prev => ({
      ...prev,
      tasks: prev.tasks.map(task =>
        task.id === taskId ? { ...task, ...updates, updated: new Date() } : task
      ),
    }));
  };

  const deleteTask = (taskId: string) => {
    setUserData(prev => ({
      ...prev,
      tasks: prev.tasks.filter(task => task.id !== taskId),
      pomodoroSessions: prev.pomodoroSessions.filter(session => session.taskId !== taskId),
    }));
    if (currentTaskId === taskId) {
      setCurrentTaskId(null);
      stopPomodoro();
    }
  };

  const toggleTaskComplete = (taskId: string) => {
    const task = userData.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (!task.completed) {
      
      const completedPomodoros = task.pomodoroSessions?.filter(s => s.completed && s.type === 'work').length || 0;

      const completedTask: CompletedTask = {
        id: task.id,
        title: task.title,
        description: task.description,
        categoryId: task.categoryId,
        priority: task.priority,
        dueDate: task.dueDate,
        created: task.created,
        completed: new Date(),
        pomodoroSessions: task.pomodoroSessions || [],
        estimatedPomodoros: task.estimatedPomodoros,
        totalPomodoros: completedPomodoros,
      };

      setUserData(prev => ({
        ...prev,
        tasks: prev.tasks.filter(t => t.id !== taskId),
        completedTasks: [...prev.completedTasks, completedTask],
      }));
    } else {
      
      const completedTask = userData.completedTasks.find(t => t.id === taskId);
      if (completedTask) {
        const restoredTask: Task = {
          id: completedTask.id,
          title: completedTask.title,
          description: completedTask.description,
          categoryId: completedTask.categoryId,
          completed: false,
          priority: completedTask.priority,
          dueDate: completedTask.dueDate,
          created: completedTask.created,
          updated: new Date(),
          pomodoroSessions: completedTask.pomodoroSessions || [],
          estimatedPomodoros: completedTask.estimatedPomodoros,
          order: Math.max(...userData.tasks.map(t => t.order), 0) + 1,
        };

        setUserData(prev => ({
          ...prev,
          tasks: [...prev.tasks, restoredTask],
          completedTasks: prev.completedTasks.filter(t => t.id !== taskId),
        }));
      }
    }
  };

  const reorderTasks = (taskIds: string[]) => {
    setUserData(prev => ({
      ...prev,
      tasks: prev.tasks.map(task => {
        const newOrder = taskIds.indexOf(task.id);
        return newOrder >= 0 ? { ...task, order: newOrder, updated: new Date() } : task;
      }),
    }));
  };

  
  const openWorkspaceUrls = (urls: string[]) => {
    if (!urls || urls.length === 0) return;

    console.log(`🔗 Opening ${urls.length} workspace URLs for focused work session...`);

    urls.forEach((url, index) => {
      try {
        
        const formattedUrl = url.startsWith('http://') || url.startsWith('https://')
          ? url
          : `https://${url}`;

        
        setTimeout(() => {
          const newTab = window.open(formattedUrl, '_blank');
          if (!newTab) {
            console.warn(`⚠️ Failed to open URL (popup blocked?): ${formattedUrl}`);
          } else {
            console.log(`✅ Opened workspace tab: ${formattedUrl}`);
          }
        }, index * 100); 
      } catch (error) {
        console.error(`❌ Error opening URL: ${url}`, error);
      }
    });
  };

  
  const startPomodoro = async (task: Task) => {
    isStoppingRef.current = false;
    const session: PomodoroSession = {
      id: generateId(),
      taskId: task.id,
      started: new Date(),
      duration: userData.settings.workDuration,
      completed: false,
      type: 'work',
    };

    setCurrentTaskId(task.id);
    setPomodoroTimer({
      isRunning: true,
      timeLeft: userData.settings.workDuration * 60, 
      currentSession: session,
      sessionType: 'work',
      justCompleted: false,
      pausedAt: null, 
      totalPausedTime: 0,
      overtimeAutoPaused: null,
    });

    
    if (task.workspaceUrls && task.workspaceUrls.length > 0) {
      openWorkspaceUrls(task.workspaceUrls);
    }

  };

  const pausePomodoro = () => {
    setPomodoroTimer(prev => ({
      ...prev,
      isRunning: false,
      pausedAt: new Date(), 
      timeLeft: computeTimeLeftSeconds({
        startedAt: prev.currentSession?.started ?? new Date(),
        durationMinutes: prev.currentSession?.duration ?? 0,
        totalPausedSeconds: sanitizePausedSeconds(prev.totalPausedTime),
        isRunning: false,
        pausedAt: new Date(),
      }),
    }));
  };

  
  const createSafePomodoroState = (overrides: any = {}) => {
    return {
      isRunning: false,
      timeLeft: 0,
      currentSession: null,
      sessionType: 'work' as 'work' | 'shortBreak' | 'longBreak',
      justCompleted: false,
      pausedAt: null,
      totalPausedTime: 0,
      ...overrides,
    };
  };

  const resumePomodoro = () => {
    setPomodoroTimer(prev => {
      if (prev.pausedAt && prev.currentSession) {
        
        
        const pauseDuration = Math.ceil((Date.now() - prev.pausedAt.getTime()) / 1000);

        
        const newPause = { start: prev.pausedAt, end: new Date() };
        const updatedSession = {
          ...prev.currentSession,
          pauses: [...(prev.currentSession.pauses || []), newPause]
        };

        
        const currentTotalPausedTime = sanitizePausedSeconds(prev.totalPausedTime);

        const newTotalPausedTime = currentTotalPausedTime + pauseDuration;

        
        
        return {
          ...prev,
          isRunning: true,
          pausedAt: null,
          totalPausedTime: newTotalPausedTime,
          overtimeAutoPaused: null,
          currentSession: updatedSession,
        };
      }
      return prev;
    });
  };

  const stopPomodoro = async () => {
    console.log('🛑 stopPomodoro called');
    isStoppingRef.current = true;

    
    
    clearPomodoroState();

    if (pomodoroTimer.currentSession) {
      
      const isOvertime = pomodoroTimer.timeLeft < 0;

      
      let finalPauses = pomodoroTimer.currentSession.pauses || [];
      if (pomodoroTimer.pausedAt) {
        finalPauses = [...finalPauses, { start: pomodoroTimer.pausedAt, end: new Date() }];
      }

      
      const session = {
        ...pomodoroTimer.currentSession,
        ended: new Date(),
        completed: isOvertime,
        pauses: finalPauses,
      };

      setUserData(prev => ({
        ...prev,
        pomodoroSessions: [...prev.pomodoroSessions, session],
      }));

      
      if (isOvertime && pomodoroTimer.currentSession.taskId) {
        const currentTask = userData.tasks.find(t => t.id === pomodoroTimer.currentSession!.taskId);
        if (currentTask) {
          updateTask(currentTask.id, {
            pomodoroSessions: [...currentTask.pomodoroSessions, session]
          });
        }
      }
    }

    setPomodoroTimer(createSafePomodoroState());
    setCurrentTaskId(null);

    
    setTimeout(() => {
      console.log('🛑 stopPomodoro delayed clear');
      clearPomodoroState();
    }, 100);

    
    setTimeout(() => {
      isStoppingRef.current = false;
    }, 2000);
  };

  const startNextSession = async () => {
    const currentTask = getCurrentTask();
    if (!currentTask) return;

    const completedWorkSessions = currentTask.pomodoroSessions?.filter(s => s.completed && s.type === 'work').length || 0;
    const estimatedSessions = currentTask.estimatedPomodoros || 3;

    
    const shouldContinue = completedWorkSessions < estimatedSessions ||
      (pomodoroTimer.sessionType === 'work' && completedWorkSessions === estimatedSessions);

    if (pomodoroTimer.sessionType === 'work' && shouldContinue) {
      
      const breakSession: PomodoroSession = {
        id: generateId(),
        taskId: currentTask.id,
        started: new Date(),
        duration: userData.settings.shortBreakDuration,
        completed: false,
        type: 'shortBreak',
      };

      setPomodoroTimer(createSafePomodoroState({
        isRunning: true,
        timeLeft: userData.settings.shortBreakDuration * 60,
        currentSession: breakSession,
        sessionType: 'shortBreak',
        justCompleted: false,
        overtimeAutoPaused: null,
      }));

      
      savePomodoroState({
        isRunning: true,
        timeLeft: userData.settings.shortBreakDuration * 60,
        currentSession: breakSession,
        sessionType: 'shortBreak',
        justCompleted: false,
        currentTaskId: currentTask.id,
        startedAt: Date.now(),
        pausedAt: null,
        totalPausedTime: 0,
        overtimeAutoPaused: null,
      });

    } else if (pomodoroTimer.sessionType === 'shortBreak') {
      
      const workSession: PomodoroSession = {
        id: generateId(),
        taskId: currentTask.id,
        started: new Date(),
        duration: userData.settings.workDuration,
        completed: false,
        type: 'work',
      };

      setPomodoroTimer(createSafePomodoroState({
        isRunning: true,
        timeLeft: userData.settings.workDuration * 60,
        currentSession: workSession,
        sessionType: 'work',
        justCompleted: false,
        overtimeAutoPaused: null,
      }));

      
      savePomodoroState({
        isRunning: true,
        timeLeft: userData.settings.workDuration * 60,
        currentSession: workSession,
        sessionType: 'work',
        justCompleted: false,
        currentTaskId: currentTask.id,
        startedAt: Date.now(),
        pausedAt: null,
        totalPausedTime: 0,
        overtimeAutoPaused: null,
      });

    } else {
      
      setPomodoroTimer({
        isRunning: false,
        timeLeft: 0,
        currentSession: null,
        sessionType: 'work',
        justCompleted: false,
        pausedAt: null,
        totalPausedTime: 0,
        overtimeAutoPaused: null,
      });
      setCurrentTaskId(null);
      clearPomodoroState();
    }
  };

  const completePomodoro = () => {
    if (pomodoroTimer.currentSession) {
      
      let finalPauses = pomodoroTimer.currentSession.pauses || [];
      if (pomodoroTimer.pausedAt) {
        finalPauses = [...finalPauses, { start: pomodoroTimer.pausedAt, end: new Date() }];
      }

      
      const completedSession = {
        ...pomodoroTimer.currentSession,
        ended: new Date(),
        pauses: finalPauses,
        completed: true,
      };

      setUserData(prev => ({
        ...prev,
        pomodoroSessions: [...prev.pomodoroSessions, completedSession],
      }));

      
      const currentTask = getCurrentTask();
      if (currentTask) {
        updateTask(currentTask.id, {
          pomodoroSessions: [...currentTask.pomodoroSessions, completedSession],
        });
      }


      
      const completedWorkSessions = (currentTask?.pomodoroSessions?.filter(s => s.completed && s.type === 'work').length || 0) +
        (pomodoroTimer.sessionType === 'work' ? 1 : 0);
      const isLastSession = completedWorkSessions >= (currentTask?.estimatedPomodoros || 3);

      if (isLastSession) {
        
        playTaskCompleteSound();
        showNotification(
          '🎉 Task Complete!',
          `Congratulations! You completed all pomodoros for "${currentTask?.title}"`
        );

        setPomodoroTimer({
          isRunning: false,
          timeLeft: 0,
          currentSession: null,
          sessionType: 'work',
          justCompleted: true,
          pausedAt: null,
          totalPausedTime: 0,
          overtimeAutoPaused: null,
        });
        
        
        setTimeout(() => {
          clearPomodoroState();
        }, 5000);
      } else {
        
        
        setPomodoroTimer(prev => ({
          ...prev,
          isRunning: false,
          timeLeft: 0,
          justCompleted: true,
          pausedAt: null,
          totalPausedTime: 0,
          overtimeAutoPaused: null,
        }));
      }
    }
  };

  const completeWorkSession = async () => {
    const currentTask = getCurrentTask();
    if (pomodoroTimer.sessionType === 'work' && pomodoroTimer.currentSession && currentTask) {
      
      completePomodoro();

      
      const breakSession: PomodoroSession = {
        id: generateId(),
        taskId: currentTask.id,
        started: new Date(),
        duration: userData.settings.shortBreakDuration,
        completed: false,
        type: 'shortBreak',
      };

      setPomodoroTimer({
        isRunning: true,
        timeLeft: userData.settings.shortBreakDuration * 60,
        currentSession: breakSession,
        sessionType: 'shortBreak',
        justCompleted: false,
        pausedAt: null,
        totalPausedTime: 0,
        overtimeAutoPaused: null,
      });

    }
  };

  const skipBreak = () => {
    const currentTask = getCurrentTask();
    if (pomodoroTimer.sessionType === 'shortBreak' && currentTask) {
      
      if (pomodoroTimer.currentSession) {
        const completedSession = {
          ...pomodoroTimer.currentSession,
          ended: new Date(),
          completed: true,
        };

        setUserData(prev => ({
          ...prev,
          pomodoroSessions: [...prev.pomodoroSessions, completedSession],
        }));

        updateTask(currentTask.id, {
          pomodoroSessions: [...currentTask.pomodoroSessions, completedSession],
        });
      }

      
      const completedWorkSessions = currentTask.pomodoroSessions?.filter(s => s.completed && s.type === 'work').length || 0;
      const isLastSession = completedWorkSessions >= (currentTask.estimatedPomodoros || 3);

      if (isLastSession) {
        
        playTaskCompleteSound();
        showNotification(
          '🎉 Task Complete!',
          `Congratulations! You completed all pomodoros for "${currentTask.title}"`
        );

        setPomodoroTimer({
          isRunning: false,
          timeLeft: 0,
          currentSession: null,
          sessionType: 'work',
          justCompleted: true,
          pausedAt: null,
          totalPausedTime: 0,
          overtimeAutoPaused: null,
        });
        setTimeout(() => {
          clearPomodoroState();
        }, 5000);
      } else {
        
        const workSession: PomodoroSession = {
          id: generateId(),
          taskId: currentTask.id,
          started: new Date(),
          duration: userData.settings.workDuration,
          completed: false,
          type: 'work',
        };

        setPomodoroTimer({
          isRunning: true,
          timeLeft: userData.settings.workDuration * 60,
          currentSession: workSession,
          sessionType: 'work',
          justCompleted: false,
          pausedAt: null,
          totalPausedTime: 0,
          overtimeAutoPaused: null,
        });
      }
    }
  };

  const debugSetTimerTo10Seconds = () => {
    if (pomodoroTimer.currentSession) {
      const now = new Date();
      const totalDurationSeconds = pomodoroTimer.currentSession.duration * 60;
      const newStartedAt = new Date(now.getTime() - (totalDurationSeconds - 10) * 1000);

      setPomodoroTimer(prev => ({
        ...prev,
        currentSession: {
          ...prev.currentSession!,
          started: newStartedAt,
        },
        timeLeft: 10,
        isRunning: true,
        pausedAt: null,
        overtimeAutoPaused: null,
      }));

      showNotification('🔧 Debug Mode', 'Timer set to 10 seconds for testing');
    }
  };

  const debugSetTimerTo14m45Overtime = () => {
    if (pomodoroTimer.currentSession) {
      const now = Date.now();
      const targetTimeLeft = -885; 
      const totalDurationSeconds = pomodoroTimer.currentSession.duration * 60;
      const elapsedSeconds = totalDurationSeconds - targetTimeLeft;
      const newStartedAt = new Date(now - elapsedSeconds * 1000);

      setPomodoroTimer(prev => ({
        ...prev,
        currentSession: prev.currentSession
          ? {
            ...prev.currentSession,
            started: newStartedAt,
          }
          : null,
        timeLeft: targetTimeLeft,
        isRunning: true,
        pausedAt: null,
        overtimeAutoPaused: null,
      }));

      showNotification('🔧 Debug Mode', 'Timer set to 14:45 overtime for testing');
    }
  };

  const debugStart30SecondTimer = () => {
    const debugTask: Task = {
      id: 'debug-test-' + Date.now(),
      title: 'Debug Test (0:30)',
      description: 'Test timer for debugging animations',
      completed: false,
      categoryId: 'work',
      estimatedPomodoros: 1,
      pomodoroSessions: [],
      created: new Date(),
      priority: 'medium',
      updated: new Date(),
      order: 0,
    };

    const session: PomodoroSession = {
      id: generateId(),
      taskId: debugTask.id,
      started: new Date(),
      duration: 0.5, 
      completed: false,
      type: 'work',
    };

    setCurrentTaskId(debugTask.id);
    setPomodoroTimer({
      isRunning: true,
      timeLeft: 30, 
      currentSession: session,
      sessionType: 'work',
      justCompleted: false,
      pausedAt: null,
      totalPausedTime: 0,
      overtimeAutoPaused: null,
    });

    showNotification('🔧 Debug Mode', 'Started 30-second test timer');
  };

  const debugAdd23Minutes = () => {
    if (pomodoroTimer.currentSession) {
      setPomodoroTimer(prev => ({
        ...prev,
        timeLeft: prev.timeLeft - (23 * 60), 
      }));

      showNotification('🐛 Debug -23min', 'Subtracted 23 minutes from timer');
    }
  };

  const updateUserNotes = (type: 'global' | 'category', content: string, categoryId?: string) => {
    setUserData(prev => {
      const currentNotes = prev.notes || { global: '', categories: {} };

      if (type === 'global') {
        return {
          ...prev,
          notes: {
            ...currentNotes,
            global: content
          }
        };
      } else if (type === 'category' && categoryId) {
        return {
          ...prev,
          notes: {
            ...currentNotes,
            categories: {
              ...currentNotes.categories,
              [categoryId]: content
            }
          }
        };
      }

      return prev;
    });
  };

  const addTimeBlock = (categoryId: string, dayOfWeek: number, startTime: number, endTime: number, taskId?: string, label?: string, isBusy?: boolean, date?: string) => {
    const newBlock: TimeBlock = {
      id: generateId(),
      categoryId,
      dayOfWeek,
      startTime,
      endTime,
      taskId,
      label,
      isBusy,
      date,
    };
    setUserData(prev => ({
      ...prev,
      timeBlocks: [...(prev.timeBlocks || []), newBlock]
    }));
  };

  const updateTimeBlock = (id: string, updates: Partial<TimeBlock>) => {
    setUserData(prev => ({
      ...prev,
      timeBlocks: (prev.timeBlocks || []).map(block =>
        block.id === id ? { ...block, ...updates } : block
      )
    }));
  };

  const deleteTimeBlock = (id: string) => {
    setUserData(prev => ({
      ...prev,
      timeBlocks: (prev.timeBlocks || []).filter(block => block.id !== id)
    }));
  };

  const value: TodoContextType = {
    userData,
    selectedCategoryId,
    currentTaskId,
    currentTask: getCurrentTask(),
    pomodoroTimer,

    addCategory,
    updateCategory,
    deleteCategory,
    setSelectedCategory,
    resetCategoriesToDefault,

    addTask,
    updateTask,
    deleteTask,
    toggleTaskComplete,
    reorderTasks,

    startPomodoro,
    pausePomodoro,
    resumePomodoro,
    stopPomodoro,
    completePomodoro,
    completeWorkSession,
    startNextSession,
    skipBreak,
    debugSetTimerTo10Seconds,
    debugSetTimerTo14m45Overtime,
    debugStart30SecondTimer,
    debugAdd23Minutes,

    updateUserNotes,

    addTimeBlock,
    updateTimeBlock,
    deleteTimeBlock,
  };

  return <TodoContext.Provider value={value} > {children}</TodoContext.Provider >;
}; 