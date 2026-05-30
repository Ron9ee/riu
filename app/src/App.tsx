import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  Sidebar,
} from "@/components/ui/sidebar"
import React from "react"
import { TodoProvider, useTodo } from "@/contexts/TodoContext"
import { DarkModeProvider, useDarkMode } from "@/contexts/DarkModeContext"
import { RiuProvider } from "@/contexts/RiuContext"
import CategorySidebar from "@/components/CategorySidebar"
import TasksPage from "@/components/TasksPage"
import SettingsPage from "@/components/SettingsPage"
import EventsPage from "@/components/EventsPage"
import DashboardPage from "@/components/DashboardPage"
import PomodoroPage from "@/components/PomodoroPage"
import NotesPage from "@/components/NotesPage"
import RiuPage from "@/components/RiuPage"
import SchedulePage from "@/components/SchedulePage"
import OnboardingModal from "@/components/OnboardingModal"
import { updateSettings } from "@/utils/storage"

const ONBOARDING_STORAGE_KEY = 'riu_onboarding_completed';
const ONBOARDING_FORCE_SHOW_KEY = 'riu_onboarding_force_show';

function AppContent() {
  const { userData } = useTodo();
  const { setThemeMode } = useDarkMode();
  const [currentPage, setCurrentPage] = React.useState<'dashboard' | 'tasks' | 'reminders' | 'events' | 'notifications' | 'pomodoro' | 'notes' | 'activity' | 'timetracking' | 'settings' | 'riu' | 'schedule'>('dashboard');
  const [currentView, setCurrentView] = React.useState<'today' | 'tomorrow' | 'next7days' | 'completed' | string>('next7days');
  const [showOnboarding, setShowOnboarding] = React.useState(false);

  
  const theme = (userData.settings?.theme as 'clean' | 'retro') || 'clean';

  
  React.useEffect(() => {
    console.log('🎨 Current theme:', theme);
    console.log('📦 Settings:', userData.settings);
  }, [theme, userData.settings]);

  
  React.useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    const forceShow = localStorage.getItem(ONBOARDING_FORCE_SHOW_KEY);

    
    const isFirstTimeUser =
      !hasCompletedOnboarding &&
      userData.tasks.length === 0 &&
      userData.completedTasks.length === 0;

    
    const shouldForceShow = forceShow === 'true';

    if (isFirstTimeUser || shouldForceShow) {
      setShowOnboarding(true);
      
      if (shouldForceShow) {
        localStorage.removeItem(ONBOARDING_FORCE_SHOW_KEY);
      }
    }
  }, [userData.tasks.length, userData.completedTasks.length]);

  const handleOnboardingComplete = (selectedDesign: 'clean' | 'retro', themeMode: 'light' | 'dark' | 'auto') => {
    
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');

    
    updateSettings({
      theme: selectedDesign,
      themeMode: themeMode
    });

    
    setThemeMode(themeMode);

    
    window.location.reload();
  };










  return (
    <>
      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleOnboardingComplete}
      />

      <SidebarProvider>
        <Sidebar>
          <CategorySidebar
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            currentView={currentView}
            onViewChange={setCurrentView}
            theme={theme}
          />
        </Sidebar>
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">
                      Riu Dashboard
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>
                      {currentPage === 'dashboard' ? 'Dashboard' :
                        currentPage === 'tasks' ? 'Tasks' :
                          currentPage === 'schedule' ? 'Schedule' :
                            currentPage === 'events' ? 'Events' :
                              currentPage === 'pomodoro' ? 'Pomodoro Timer' :
                                currentPage === 'settings' ? 'Settings' :
                                  currentPage === 'riu' ? 'Riu' : 'Dashboard'}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>

          </header>
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            {currentPage === 'dashboard' ? (
              <DashboardPage
                onNavigateToActivity={() => setCurrentPage('activity')}
                onPageChange={setCurrentPage}
                theme={theme}
              />
            ) : currentPage === 'tasks' ? (
              <TasksPage
                currentView={currentView}
                onViewChange={setCurrentView}
                onPageChange={setCurrentPage}
                theme={theme}
              />
            ) : currentPage === 'schedule' ? (
              <SchedulePage
                theme={theme}
                onNavigateToPomodoro={() => setCurrentPage('pomodoro')}
              />

            ) : currentPage === 'events' ? (
              <EventsPage theme={theme} />

            ) : currentPage === 'pomodoro' ? (
              <PomodoroPage onPageChange={setCurrentPage} theme={theme} />
            ) : currentPage === 'notes' ? (
              <NotesPage onPageChange={setCurrentPage} theme={theme} />

            ) : currentPage === 'settings' ? (
              <SettingsPage onPageChange={setCurrentPage} theme={theme} />
            ) : currentPage === 'riu' ? (
              <RiuPage onPageChange={setCurrentPage} theme={theme} />
            ) : (
              <>

                {/* Main Content Area */}
                <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min p-6">
                  <div className="space-y-6">
                    <div>
                      <h1 className="text-3xl font-bold">🛠️ Welcome to Riu Dashboard</h1>
                      <p className="text-muted-foreground mt-2">
                        Your little local desk assistant — a cute robot that watches, listens, speaks, and helps.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="p-4 bg-card rounded-lg border">
                        <h3 className="font-semibold mb-2">🗣️ Voice & Expressions</h3>
                        <p className="text-sm text-muted-foreground">
                          Talk to Riu with voice commands and watch facial expressions
                        </p>
                      </div>

                      <div className="p-4 bg-card rounded-lg border">
                        <h3 className="font-semibold mb-2">✅ Task Management</h3>
                        <p className="text-sm text-muted-foreground">
                          Manage your to-do list, add tasks, and check them off
                        </p>
                      </div>

                      <div className="p-4 bg-card rounded-lg border">
                        <h3 className="font-semibold mb-2">⏲️ Pomodoro Timer</h3>
                        <p className="text-sm text-muted-foreground">
                          Start focused work sessions: "Start pomodoro for [Task]"
                        </p>
                      </div>

                      <div className="p-4 bg-card rounded-lg border">
                        <h3 className="font-semibold mb-2">🔔 Smart Reminders</h3>
                        <p className="text-sm text-muted-foreground">
                          Set custom reminders: "Drink water every 30 mins"
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </SidebarInset>

      </SidebarProvider>
    </>
  )
}

export default function Page() {
  return (
    <DarkModeProvider>
      <TodoProvider>
        <RiuProvider>
          <AppContent />
        </RiuProvider>
      </TodoProvider>
    </DarkModeProvider>
  )
}
