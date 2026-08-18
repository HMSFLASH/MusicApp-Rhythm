import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  Library,
  SlidersHorizontal,
  Disc,
  Search,
  LogIn,
  LogOut,
  User,
  Loader2,
  ListMusic,
  Key,
  Menu,
  Languages,
  Keyboard,
  Moon,
  Settings,
  X as CloseIcon
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { axiosClient } from '../api/axiosClient';
import { BottomPlayerBar } from './BottomPlayerBar';
import { useSleepTimer } from '../context/SleepTimerContext';
import { useAuth } from '../context/AuthContext';
import { LocalFilePicker } from './LocalFilePicker';
import { UploadQueuePanel } from './UploadQueuePanel';
import { SetLocalPasswordModal } from './SetLocalPasswordModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import { SleepTimerModal } from './SleepTimerModal';
import { db } from '../lib/db';
import { clearCachedAudio } from '../utils/mediaCache';
import { clearCovers } from '../utils/idb';
import { useGlobalAudio } from '../context/AudioContext';
import { LOCAL_STORAGE_KEY, PLAYBACK_STORAGE_KEY } from '../hooks/audioStorage';

// parseJwt removed as user data is now fetched from /me

export function Layout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, setIsAuthenticated, user } = useAuth();
  const { playerState } = useGlobalAudio();
  const { state: sleepTimerState, openModal: openSleepTimerModal } = useSleepTimer();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu on navigation
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileMenuOpen(false);
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

  const navItems = [
    { name: t('nav.nowPlaying', 'Now Playing'), path: '/', icon: <Disc size={20} /> },
    { name: t('nav.search', 'Search'), path: '/search', icon: <Search size={20} /> },
    { name: t('nav.library', 'Library'), path: '/library', icon: <Library size={20} /> },
    { name: t('nav.queue', 'Queue'), path: '/queue', icon: <ListMusic size={20} /> }
  ];

  const soundTools = [
    { name: t('nav.audioStudio', 'Audio Studio'), path: '/studio', icon: <SlidersHorizontal size={20} /> },
    { name: t('nav.settings', 'Settings'), path: '/settings', icon: <Settings size={20} /> }
  ];

  const showNowPlayingDisc = () => {
    globalThis.dispatchEvent(new Event('rhythm:show-now-playing-disc'));
  };

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-background text-slate-100 selection:bg-primary/30 selection:text-white font-sans relative">
      {/* Subtle Ambient Background Lighting (Fixed) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-primary/10 rounded-full blur-[128px]" />
        <div className="absolute top-1/3 -right-40 w-[30rem] h-[30rem] bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-cyan-600/5 rounded-full blur-[120px]" />
      </div>

      {/* Main App Area */}
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[59] md:hidden transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`w-[min(18rem,85vw)] bg-[#09111e]/95 backdrop-blur-xl border-r border-white/[0.06] flex flex-col flex-shrink-0 transition-transform duration-300 fixed inset-y-0 left-0 z-[60] md:relative md:w-64 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {/* Logo / Brand Header */}
          <div className="p-5 flex items-center justify-between border-b border-white/[0.04]">
            <Link
              to="/"
              onClick={() => {
                setIsMobileMenuOpen(false);
                showNowPlayingDisc();
              }}
              className="group flex items-center gap-3 transition-transform duration-200 hover:scale-[1.02]"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-indigo-500/10 border border-primary/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,245,255,0.2)] group-hover:shadow-[0_0_22px_rgba(0,245,255,0.4)] transition-all">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                  <rect x="3" y="10" width="3.5" height="10" rx="1.75" fill="currentColor" className="animate-pulse" style={{ animationDelay: '0ms' }} />
                  <rect x="10.25" y="4" width="3.5" height="16" rx="1.75" fill="currentColor" className="animate-pulse" style={{ animationDelay: '150ms' }} />
                  <rect x="17.5" y="7" width="3.5" height="13" rx="1.75" fill="currentColor" className="animate-pulse" style={{ animationDelay: '300ms' }} />
                </svg>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold font-display tracking-tight text-white group-hover:text-primary transition-colors flex items-center gap-1.5">
                  Rhythm
                </span>
                <span className="text-[11px] font-mono text-slate-400">Hi-Res Audio Studio</span>
              </div>
            </Link>
            <button className="md:hidden text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu">
              <CloseIcon size={22} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar px-3 py-4 space-y-6">
            <div>
              <h2 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2.5 px-3">{t('layout.discover', 'Discover')}</h2>
              <div className="flex flex-col gap-1">
                {navItems.map(item => {
                  let isLibraryChild = false;
                  if (item.path === '/library') {
                    const libraryPaths = ['/library', '/tracks', '/albums', '/artists', '/genres', '/playlist'];
                    isLibraryChild = libraryPaths.some(p => location.pathname.startsWith(p));
                  }

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => {
                        if (item.path === '/') showNowPlayingDisc();
                      }}
                      className={({ isActive }) => {
                        const active = (isActive && item.path !== '/library') || isLibraryChild;
                        return `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${active
                            ? 'bg-primary/15 text-primary shadow-[inset_0_0_12px_rgba(0,245,255,0.1)] border border-primary/25 font-semibold'
                            : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
                          }`;
                      }}
                    >
                      <span className="transition-transform group-hover:scale-110 duration-200">{item.icon}</span>
                      <span>{item.name}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2.5 px-3">{t('layout.studioTools', 'Studio Tools')}</h2>
              <div className="flex flex-col gap-1">
                {soundTools.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${isActive
                        ? 'bg-primary/15 text-primary shadow-[inset_0_0_12px_rgba(0,245,255,0.1)] border border-primary/25 font-semibold'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
                      }`
                    }
                  >
                    <span className="transition-transform group-hover:scale-110 duration-200">{item.icon}</span>
                    <span>{item.name}</span>
                  </NavLink>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    openSleepTimerModal();
                  }}
                  className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border ${
                    sleepTimerState.isActive
                      ? 'bg-primary/15 text-primary shadow-[inset_0_0_12px_rgba(0,245,255,0.1)] border-primary/25 font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="transition-transform group-hover:scale-110 duration-200">
                      <Moon size={20} className={sleepTimerState.isActive ? 'text-primary animate-pulse' : ''} />
                    </span>
                    <span>{t('sleepTimer.title', 'Hẹn Giờ Tắt Nhạc')}</span>
                  </div>
                  {sleepTimerState.isActive && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-bold">
                      {sleepTimerState.mode === 'time'
                        ? `${Math.ceil(sleepTimerState.remainingSeconds / 60)}m`
                        : 'Track'}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Local Files */}
            <div>
              <h2 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2.5 px-3">{t('layout.localFiles', 'Local Files')}</h2>
              <div className="flex flex-col gap-1">
                <LocalFilePicker />
              </div>
            </div>
          </div>

          {/* Bottom Sidebar - User Profile/Login */}
          <div className="p-3 border-t border-white/[0.06] bg-[#070e1a]/70">
            <div className="flex items-center justify-between mb-2.5 px-1.5">
              <span className="text-[11px] font-mono text-slate-400 tracking-wider">{t('layout.language', 'Ngôn ngữ')}</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
                  }}
                  className="hidden md:inline-flex p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-primary transition-all border border-white/[0.06]"
                  title="Phím tắt nhanh (?)"
                  aria-label="Keyboard Shortcuts"
                >
                  <Keyboard size={14} />
                </button>
                <button
                  onClick={() => i18n.changeLanguage(i18n.language === 'vi' ? 'en' : 'vi')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white transition-all text-xs font-mono border border-white/[0.06]"
                  aria-label="Toggle language"
                >
                  <Languages size={13} className="text-primary" />
                  <span className="font-bold">{i18n.language === 'vi' ? 'VI' : 'EN'}</span>
                </button>
              </div>
            </div>
            {isAuthenticated ? (
              <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-primary/30 transition-all relative">
                <div
                  className="flex items-center gap-2.5 overflow-hidden cursor-pointer group flex-1"
                  onClick={() => setIsAvatarMenuOpen(!isAvatarMenuOpen)}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 overflow-hidden border border-primary/30 group-hover:border-primary transition-all">
                    {user?.avatarUrl ? (
                      <img src={user?.avatarUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User size={15} />
                    )}
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-primary transition-colors truncate">
                      {user?.fullName || user?.email?.split('@')[0] || user?.username || 'User'}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">
                      {user?.email || 'Logged in'}
                    </span>
                  </div>
                </div>

                {/* Dropdown Menu */}
                {isAvatarMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsAvatarMenuOpen(false)}
                    />
                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#0c1626] border border-white/10 rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden backdrop-blur-xl">
                      {user?.hasPassword && (
                        <button
                          onClick={() => {
                            setIsAvatarMenuOpen(false);
                            setIsChangePasswordModalOpen(true);
                          }}
                          className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors"
                        >
                          <Key size={14} className="text-primary" /> Đổi mật khẩu
                        </button>
                      )}
                      {user?.hasPassword !== true && (
                        <button
                          onClick={() => {
                            setIsAvatarMenuOpen(false);
                            setIsPasswordModalOpen(true);
                          }}
                          className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors"
                        >
                          <Key size={14} className="text-primary" /> {t('layout.setLocalPassword', 'Set Local Password')}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setIsAvatarMenuOpen(false);
                          navigate('/settings');
                        }}
                        className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors"
                      >
                        <Settings size={14} className="text-primary" /> {t('nav.settings', 'Settings')}
                      </button>
                      <button
                        onClick={() => {
                          setIsAvatarMenuOpen(false);
                          handleLogout();
                        }}
                        disabled={isLoggingOut}
                        className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors disabled:opacity-50"
                      >
                        {isLoggingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                        Đăng xuất
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <NavLink
                to="/login"
                className={({ isActive }) =>
                  `w-full flex items-center justify-center gap-2 font-semibold text-xs py-2.5 rounded-xl transition-all ${isActive ? 'bg-primary text-slate-950 shadow-[0_0_15px_rgba(0,245,255,0.4)]' : 'bg-white/[0.06] hover:bg-primary/20 text-slate-200 hover:text-primary border border-white/[0.08]'
                  }`
                }
              >
                <LogIn size={15} />
                <span>{t('layout.signIn', 'Sign In')}</span>
              </NavLink>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 relative flex flex-col min-w-0 overflow-hidden bg-background">
          {/* Mobile Header (Fixed) */}
          <div className="md:hidden p-3.5 border-b border-white/[0.06] flex items-center justify-between bg-[#08101e]/90 backdrop-blur-xl z-[40] shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setIsMobileMenuOpen(true)} className="text-slate-300 hover:text-primary transition-colors p-1" aria-label="Open menu">
                <Menu size={22} />
              </button>
              <Link to="/" onClick={showNowPlayingDisc} className="hover:opacity-90 transition-opacity">
                <h1 className="text-lg font-bold font-display text-white tracking-tight flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
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
                onClick={openSleepTimerModal}
                className={`p-1.5 rounded-lg border transition-all ${
                  sleepTimerState.isActive
                    ? 'bg-primary/20 text-primary border-primary/40 shadow-sm'
                    : 'bg-white/[0.05] text-slate-300 hover:text-white border-white/[0.06]'
                }`}
                title={t('sleepTimer.title', 'Sleep Timer')}
                aria-label="Sleep Timer"
              >
                <Moon size={16} className={sleepTimerState.isActive ? 'text-primary animate-pulse' : ''} />
              </button>
              {isAuthenticated ? (
                <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center overflow-hidden">
                  {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : <User size={14} className="text-primary" />}
                </div>
              ) : (
                <Link to="/login" className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  Login
                </Link>
              )}
            </div>
          </div>

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
            <div className="px-3 py-4 sm:px-4 md:px-6 lg:px-8 max-w-7xl 2xl:max-w-[1500px] 3xl:max-w-[1800px] 4k:max-w-[2800px] mx-auto min-h-full w-full pb-28 md:pb-32">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Persistent Bottom Bar */}
      <UploadQueuePanel />
      <BottomPlayerBar />

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
