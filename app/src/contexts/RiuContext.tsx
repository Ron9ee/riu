import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTodo } from './TodoContext';

const TABBIE_HOSTNAME = "riu.local";
const RECONNECT_INTERVAL = 5000; 
const STATUS_UPDATE_INTERVAL = 5000; 
const CONNECTION_TIMEOUT = 3000; 

interface RiuStatus {
  status: string;
  animation: string;
  task: string;
  uptime: number;
  connectedDevices: number;
  ip: string;
}

type RiuActivityState = 'idle' | 'pomodoro' | 'break' | 'complete' | 'focus' | 'paused';

interface RiuContextType {
  isConnected: boolean;
  isConnecting: boolean;
  riuStatus: RiuStatus | null;
  connectionError: string;
  customIP: string;
  activityState: RiuActivityState;

  
  checkConnection: () => Promise<void>;
  setCustomIP: (ip: string) => void;
  sendAnimation: (animation: string, task?: string, duration?: number) => Promise<boolean>;
  triggerTaskCompletion: (taskTitle: string) => void;
  triggerDebug: () => Promise<void>;
  disconnect: () => void;
}

const RiuContext = createContext<RiuContextType | undefined>(undefined);

export const useRiuSync = () => {
  const context = useContext(RiuContext);
  if (context === undefined) {
    throw new Error('useRiuSync must be used within a RiuProvider');
  }
  return context;
};

export const RiuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userData, pomodoroTimer, currentTaskId } = useTodo();

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [riuStatus, setRiuStatus] = useState<RiuStatus | null>(null);
  const [connectionError, setConnectionError] = useState<string>('');
  const [customIP, setCustomIP] = useState(() => {
    
    const saved = localStorage.getItem('riu_ip');
    return saved || TABBIE_HOSTNAME;
  });
  const [activityState, setActivityState] = useState<RiuActivityState>('idle');
  const [isPlayingCompletionAnimation, setIsPlayingCompletionAnimation] = useState(false);
  const [lastSyncedAnimation, setLastSyncedAnimation] = useState<string | null>(null);

  
  useEffect(() => {
    localStorage.setItem('riu_ip', customIP);
  }, [customIP]);

  
  const tryConnect = useCallback(async (address: string): Promise<boolean> => {
    try {
      const response = await fetch(`http://${address}/api/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
      });

      if (response.ok) {
        const status = await response.json();
        setRiuStatus(status);
        setIsConnected(true);
        setConnectionError('');
        
        
        if (status.ip && status.ip !== address) {
          localStorage.setItem('riu_last_working_ip', status.ip);
        } else if (address !== TABBIE_HOSTNAME) {
          localStorage.setItem('riu_last_working_ip', address);
        }
        
        console.log('✅ Connected to Riu at', address, ':', status);
        return true;
      }
    } catch (error) {
      console.log(`⏳ Could not reach ${address}`);
    }
    return false;
  }, []);

  const checkConnection = useCallback(async () => {
    setIsConnecting(true);
    setConnectionError('');

    
    const addressesToTry: string[] = [];
    
    
    if (customIP && customIP !== TABBIE_HOSTNAME) {
      addressesToTry.push(customIP);
    }
    
    
    addressesToTry.push(TABBIE_HOSTNAME);
    
    
    const lastWorkingIP = localStorage.getItem('riu_last_working_ip');
    if (lastWorkingIP && !addressesToTry.includes(lastWorkingIP)) {
      addressesToTry.push(lastWorkingIP);
    }

    console.log('🔍 Trying to connect to Riu at:', addressesToTry);

    
    for (const address of addressesToTry) {
      if (await tryConnect(address)) {
        
        if (address !== customIP) {
          setCustomIP(address);
        }
        setIsConnecting(false);
        return;
      }
    }

    
    setIsConnected(false);
    setRiuStatus(null);
    setConnectionError('🔍 Cannot find Riu. Make sure it\'s powered on and connected to the same WiFi network. Press "Show Debug Info" on Riu to see its IP address.');
    setIsConnecting(false);
  }, [customIP, tryConnect, setCustomIP]);

  const updateStatus = useCallback(async () => {
    if (!isConnected) return;

    try {
      const response = await fetch(`http://${customIP}/api/status`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const status = await response.json();
        setRiuStatus(status);
      }
    } catch (error) {
      
      
      console.log('⚠️ Status update failed:', error);
    }
  }, [isConnected, customIP]);

  const sendAnimation = useCallback(async (animation: string, task?: string, duration?: number): Promise<boolean> => {
    

    try {
      const payload: { animation: string; task: string; duration?: number } = {
        animation: animation,
        task: task || ''
      };
      
      
      if (duration && duration > 0) {
        payload.duration = duration;
      }
      
      console.log('🎨 Sending animation to Riu:', animation, task, duration ? `(${duration}s)` : '');
      const response = await fetch(`http://${customIP}/api/animation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
      });

      if (response.ok) {
        console.log('✅ Animation sent successfully:', animation);
        setLastSyncedAnimation(animation);
        
        if (!isConnected) {
          setIsConnected(true);
          setConnectionError('');
        }
        
        setTimeout(updateStatus, 500);
        return true;
      } else {
        console.log('❌ Failed to send animation:', response.statusText);
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to send animation:', error);
      
      if (isConnected) {
        setIsConnected(false);
      }
      return false;
    }
  }, [isConnected, customIP, updateStatus]);

  const triggerDebug = useCallback(async () => {
    if (!isConnected) {
      console.log('⚠️ Not connected to Riu, cannot trigger debug mode');
      return;
    }

    try {
      console.log('🔧 Triggering debug mode on Riu...');
      const response = await fetch(`http://${customIP}/api/debug`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(CONNECTION_TIMEOUT),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Debug mode activated:', data);
      } else {
        console.log('❌ Failed to trigger debug mode:', response.statusText);
      }
    } catch (error) {
      console.error('❌ Failed to trigger debug mode:', error);
    }
  }, [isConnected, customIP]);

  const triggerTaskCompletion = useCallback((taskTitle: string) => {
    if (!isConnected) {
      console.log('⚠️ Not connected to Riu, skipping task completion animation');
      return;
    }

    console.log('🎉 Task completed - triggering love animation:', taskTitle);
    setIsPlayingCompletionAnimation(true);
    setActivityState('complete');
    sendAnimation('love', taskTitle);

    
    setTimeout(() => {
      console.log('💤 Returning to idle state after task completion');
      setIsPlayingCompletionAnimation(false);
      setActivityState('idle');
      sendAnimation('idle');
    }, 9000);
  }, [isConnected, sendAnimation]);

  const disconnect = useCallback(() => {
    setIsConnected(false);
    setRiuStatus(null);
    setConnectionError('');
  }, []);

  
  useEffect(() => {
    const timer = setTimeout(() => {
      checkConnection();
    }, 2000); 
    
    return () => clearTimeout(timer);
  }, [checkConnection]);

  
  useEffect(() => {
    if (isConnected) return; 

    const interval = setInterval(() => {
      if (!isConnecting) {
        console.log('🔄 Auto-retrying connection to Riu...');
        checkConnection();
      }
    }, RECONNECT_INTERVAL);

    return () => clearInterval(interval);
  }, [isConnected, isConnecting, checkConnection]);

  
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      updateStatus();
    }, STATUS_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, [isConnected, updateStatus]);

  
  useEffect(() => {
    if (!isConnected) {
      setLastSyncedAnimation(null);
    }
  }, [isConnected]);

  
  useEffect(() => {
    
    

    
    if (isPlayingCompletionAnimation) return;

    const currentTask = currentTaskId
      ? userData.tasks.find(t => t.id === currentTaskId)
      : null;

    
    
    const needsSync = (targetAnim: string) => {
      
      if (lastSyncedAnimation !== targetAnim) return true;
      
      if (isConnected && riuStatus && riuStatus.animation !== targetAnim) return true;
      return false;
    };

    
    if (pomodoroTimer.isRunning) {
      
      if (pomodoroTimer.sessionType === 'work') {
        
        setActivityState('focus');
        if (needsSync('focus')) {
          
          const remainingSeconds = Math.max(0, Math.floor(pomodoroTimer.timeLeft));
          sendAnimation('focus', currentTask?.title || 'Focus Session', remainingSeconds);
          console.log('🍅 Pomodoro running - sending focus animation with remaining:', remainingSeconds, 'seconds');
        }
      } else if (pomodoroTimer.sessionType === 'shortBreak') {
        
        setActivityState('break');
        if (needsSync('break')) {
          const remainingSeconds = Math.max(0, Math.floor(pomodoroTimer.timeLeft));
          sendAnimation('break', 'Break Time', remainingSeconds);
          console.log('☕ Break running - sending break animation with remaining:', remainingSeconds, 'seconds');
        }
      }
    } else if (pomodoroTimer.justCompleted) {
      
      setActivityState('complete');
      if (needsSync('complete')) {
        const completionMessage = pomodoroTimer.sessionType === 'work'
          ? currentTask?.title || 'Task Complete!'
          : 'Break Complete!';
        sendAnimation('complete', completionMessage);
        console.log('✅ Session completed - sending complete animation');
      }
    } else if (pomodoroTimer.currentSession && !pomodoroTimer.isRunning) {
      
      setActivityState('paused');
      if (needsSync('paused')) {
        sendAnimation('paused', 'Paused');
        console.log('⏸️ Session paused - sending paused animation');
      }
    } else {
      
      setActivityState('idle');
      if (needsSync('idle')) {
        sendAnimation('idle');
        console.log('💤 Idle state - sending idle animation');
      }
    }
  }, [
    isConnected,
    riuStatus, 
    isPlayingCompletionAnimation,
    pomodoroTimer.isRunning,
    pomodoroTimer.justCompleted,
    pomodoroTimer.sessionType,
    pomodoroTimer.currentSession,
    currentTaskId,
    userData.tasks,
    lastSyncedAnimation,
    sendAnimation
  ]);

  const value: RiuContextType = {
    isConnected,
    isConnecting,
    riuStatus,
    connectionError,
    customIP,
    activityState,
    checkConnection,
    setCustomIP,
    sendAnimation,
    triggerTaskCompletion,
    triggerDebug,
    disconnect,
  };

  return <RiuContext.Provider value={value}>{children}</RiuContext.Provider>;
};

