import { Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Moon,
  User,
  Loader2,
  Disc,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { axiosClient } from '../api/axiosClient';
import { SidebarPlayer } from './SidebarPlayer';
import { Taskbar } from './Taskbar';
import { MobileMiniPlayer } from './MobileMiniPlayer';
import { useSleepTimer } from '../context/SleepTimerContext';
import { useAuth } from '../context/AuthContext';
import { UploadQueuePanel } from './UploadQueuePanel';
import { SetLocalPasswordModal } from './SetLocalPasswordModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import { SleepTimerModal } from './SleepTimerModal';
import { db } from '../lib/db';
import { clearCachedAudio } from '../utils/mediaCache';
import { clearCovers } from '../utils/idb';
import { useGlobalAudio } from '../context/AudioContext';
import { LOCAL_STORAGE_KEY, PLAYBACK_STORAGE_KEY } from '../hooks/audioStorage';

export function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, setIsAuthenticated, user } = useAuth();
  const { playerState } = useGlobalAudio();
  const { state: sleepTimerState, openModal: openSleepTimerModal } = useSleepTimer();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isMobilePlayerOpen, setIsMobilePlayerOpen] = useState(false);
  const [isDesktopPlayerCollapsed, setIsDesktopPlayerCollapsed] = useState(false);

  // Close mobile player drawer on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobilePlayerOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      try {
        await axiosClient.post('/api/auth/logout');
      } catch {
        // ignore logout error
      }
    } finally {
      setIsAuthenticated(false);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem(PLAYBACK_STORAGE_KEY);
      await Promise.allSettled([
        db.clear(),
        clearCachedAudio(),
        clearCovers(),
      ]);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem(PLAYBACK_STORAGE_KEY);
      setIsLoggingOut(false);
      navigate('/login');
    }
  };

  const showNowPlayingDisc = () => {
    globalThis.dispatchEvent(new Event('rhythm:show-now-playing-disc'));
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-background text-slate-100 selection:bg-primary/30 selection:text-white font-sans relative">
      {/* Subtle Ambient Background Lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/3 -right-40 w-[30rem] h-[30rem] bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-cyan-600/5 rounded-full blur-[120px]" />
      </div>

      {/* Main Workspace (Side Player + Main Content) */}
      <div className="flex flex-1 overflow-hidden relative z-10 pb-14 md:pb-16">
        {/* Left Side: Sidebar Player (thanh nhạc ở bên nav) */}
        <SidebarPlayer
          isMobileOpen={isMobilePlayerOpen}
          onCloseMobile={() => setIsMobilePlayerOpen(false)}
          isCollapsed={isDesktopPlayerCollapsed}
          onToggleCollapse={() => setIsDesktopPlayerCollapsed((prev) => !prev)}
        />

        {/* Center / Right: Main Content Area */}
        <div className="flex-1 relative flex flex-col min-w-0 overflow-hidden bg-background">
          {/* Mobile Header (Hidden on md+) */}
          <header className="md:hidden p-3 border-b border-white/[0.06] flex items-center justify-between bg-[#08101e]/90 backdrop-blur-xl z-[40] shrink-0">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsMobilePlayerOpen(true)}
                className="text-slate-300 hover:text-primary transition-colors p-1 rounded-lg hover:bg-white/[0.05]"
                aria-label="Open Music Player"
                title="Open Music Player"
              >
                <Disc size={20} className={playerState.isPlaying ? 'text-primary animate-spin-slow' : ''} />
              </button>
              <Link to="/" onClick={showNowPlayingDisc} className="hover:opacity-90 transition-opacity">
                <h1 className="text-base font-bold font-display text-white tracking-tight flex items-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                    <rect x="3" y="9" width="4" height="12" rx="2" fill="currentColor" />
                    <rect x="10" y="3" width="4" height="18" rx="2" fill="currentColor" />
                    <rect x="17" y="7" width="4" height="14" rx="2" fill="currentColor" />
                  </svg>
                  Rhythm
                </h1>
              </Link>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openSleepTimerModal}
                className={`p-1.5 rounded-lg border transition-all ${
                  sleepTimerState.isActive
                    ? 'bg-primary/20 text-primary border-primary/40 shadow-sm'
                    : 'bg-white/[0.05] text-slate-300 hover:text-white border-white/[0.06]'
                }`}
                title={t('sleepTimer.title', 'Sleep Timer')}
                aria-label="Sleep Timer"
              >
                <Moon size={15} className={sleepTimerState.isActive ? 'text-primary animate-pulse' : ''} />
              </button>

              {isAuthenticated ? (
                <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center overflow-hidden">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User size={13} className="text-primary" />
                  )}
                </div>
              ) : (
                <Link
                  to="/login"
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20"
                >
                  Login
                </Link>
              )}
            </div>
          </header>

          {/* Main Page Scroll Container */}
          <main className="flex-1 overflow-y-auto w-full relative">
            {playerState.isLoadingTrack && (
              <div className="fixed top-16 md:top-4 left-1/2 -translate-x-1/2 z-[100] flex max-w-[calc(100vw_-_2rem)] items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-4 py-3 text-primary shadow-lg backdrop-blur-md">
                <Loader2 size={20} className="animate-spin shrink-0" />
                <span className="truncate text-sm font-medium">
                  {playerState.loadingTrackPhase === 'processing'
                    ? t('layout.processingTrack', 'Đang tính toán âm thanh...')
                    : t('layout.downloadingTrack', 'Đang tải nhạc về...')}
                </span>
              </div>
            )}
            <div className="px-3 py-4 sm:px-4 md:px-6 lg:px-8 max-w-7xl 2xl:max-w-[1500px] 3xl:max-w-[1800px] 4k:max-w-[2800px] mx-auto min-h-full w-full pb-20 md:pb-24">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Floating Mini Player for Mobile (< 768px) */}
      <MobileMiniPlayer onOpenSidebar={() => setIsMobilePlayerOpen(true)} />

      {/* Persistent Bottom Taskbar (navbar chuyển xuống thành taskbar) */}
      <UploadQueuePanel />
      <Taskbar
        isSidebarPlayerOpen={!isDesktopPlayerCollapsed}
        onToggleSidebarPlayer={() => {
          if (globalThis.innerWidth < 768) {
            setIsMobilePlayerOpen((prev) => !prev);
          } else {
            setIsDesktopPlayerCollapsed((prev) => !prev);
          }
        }}
        onOpenChangePasswordModal={() => setIsChangePasswordModalOpen(true)}
        onOpenSetPasswordModal={() => setIsPasswordModalOpen(true)}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      {/* Modals */}
      <SetLocalPasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        defaultEmail={isAuthenticated ? (user?.email || user?.loginId) : ''}
      />
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />
      <SleepTimerModal />
    </div>
  );
}
