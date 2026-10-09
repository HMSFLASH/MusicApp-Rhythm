import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Disc,
  Search,
  Library,
  ListMusic,
  SlidersHorizontal,
  Settings,
  Moon,
  Languages,
  Keyboard,
  User,
  LogIn,
  LogOut,
  Key,
  Loader2,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useSleepTimer } from '../context/SleepTimerContext';

interface TaskbarProps {
  isSidebarPlayerOpen: boolean;
  onToggleSidebarPlayer: () => void;
  onOpenChangePasswordModal: () => void;
  onOpenSetPasswordModal: () => void;
  onLogout: () => Promise<void>;
  isLoggingOut: boolean;
}

export function Taskbar({
  isSidebarPlayerOpen,
  onToggleSidebarPlayer,
  onOpenChangePasswordModal,
  onOpenSetPasswordModal,
  onLogout,
  isLoggingOut,
}: TaskbarProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { state: sleepTimerState, openModal: openSleepTimerModal } = useSleepTimer();

  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const avatarMenuRef = useRef<HTMLDivElement>(null);

  // Close avatar menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { name: t('nav.nowPlaying', 'Now Playing'), path: '/', icon: <Disc size={18} /> },
    { name: t('nav.search', 'Search'), path: '/search', icon: <Search size={18} /> },
    { name: t('nav.library', 'Library'), path: '/library', icon: <Library size={18} /> },
    { name: t('nav.queue', 'Queue'), path: '/queue', icon: <ListMusic size={18} /> },
    { name: t('nav.audioStudio', 'Audio Studio'), path: '/studio', icon: <SlidersHorizontal size={18} /> },
    { name: t('nav.settings', 'Settings'), path: '/settings', icon: <Settings size={18} /> },
  ];

  const showNowPlayingDisc = () => {
    globalThis.dispatchEvent(new Event('rhythm:show-now-playing-disc'));
  };

  return (
    <footer className="fixed bottom-0 inset-x-0 h-14 md:h-16 bg-[#070e1b]/95 backdrop-blur-2xl border-t border-white/[0.08] z-40 select-none shadow-[0_-10px_35px_rgba(0,0,0,0.65)] px-2 sm:px-4 md:px-6 flex items-center justify-between gap-2">
      {/* Left: Brand Logo & Player Sidebar Toggle */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <button
          type="button"
          onClick={onToggleSidebarPlayer}
          className={`p-2 rounded-xl border transition-all duration-200 flex items-center justify-center ${
            isSidebarPlayerOpen
              ? 'bg-primary/15 text-primary border-primary/30 shadow-[0_0_12px_rgba(0,245,255,0.25)]'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.05] border-white/[0.06]'
          }`}
          title={isSidebarPlayerOpen ? t('taskbar.hidePlayer', 'Hide Player Panel') : t('taskbar.showPlayer', 'Show Player Panel')}
          aria-label="Toggle Player Panel"
        >
          {isSidebarPlayerOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
        </button>

        <Link
          to="/"
          onClick={showNowPlayingDisc}
          className="group flex items-center gap-2.5 transition-transform duration-200 hover:scale-[1.02]"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 via-primary/10 to-indigo-500/10 border border-primary/30 flex items-center justify-center shadow-[0_0_12px_rgba(0,245,255,0.25)] group-hover:shadow-[0_0_18px_rgba(0,245,255,0.45)] transition-all">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
              <rect x="3" y="10" width="3.5" height="10" rx="1.75" fill="currentColor" className="animate-pulse" style={{ animationDelay: '0ms' }} />
              <rect x="10.25" y="4" width="3.5" height="16" rx="1.75" fill="currentColor" className="animate-pulse" style={{ animationDelay: '150ms' }} />
              <rect x="17.5" y="7" width="3.5" height="13" rx="1.75" fill="currentColor" className="animate-pulse" style={{ animationDelay: '300ms' }} />
            </svg>
          </div>
          <div className="hidden lg:flex flex-col">
            <span className="text-sm font-bold font-display tracking-tight text-white group-hover:text-primary transition-colors">
              Rhythm
            </span>
            <span className="text-[10px] font-mono text-slate-400 -mt-0.5">Hi-Res Audio</span>
          </div>
        </Link>
      </div>

      {/* Center: Navigation Taskbar Items */}
      <nav className="flex items-center gap-1 sm:gap-1.5 md:gap-2 overflow-x-auto no-scrollbar py-1 px-1">
        {navItems.map((item) => {
          let isLibraryChild = false;
          if (item.path === '/library') {
            const libraryPaths = ['/library', '/tracks', '/albums', '/artists', '/genres', '/playlist'];
            isLibraryChild = libraryPaths.some((p) => location.pathname.startsWith(p));
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
                return `group relative flex items-center gap-2 px-2.5 sm:px-3 md:px-3.5 py-1.5 md:py-2 rounded-xl text-xs md:text-sm font-medium transition-all duration-200 shrink-0 ${
                  active
                    ? 'bg-primary/15 text-primary shadow-[inset_0_0_12px_rgba(0,245,255,0.12)] border border-primary/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
                }`;
              }}
            >
              <span className="transition-transform group-hover:scale-110 duration-200 shrink-0">
                {item.icon}
              </span>
              <span className="hidden sm:inline-block whitespace-nowrap">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Right: System Tray & User Area */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Sleep Timer */}
        <button
          type="button"
          onClick={openSleepTimerModal}
          className={`p-1.5 sm:p-2 rounded-xl border transition-all duration-200 flex items-center gap-1.5 ${
            sleepTimerState.isActive
              ? 'bg-primary/20 text-primary border-primary/40 shadow-[0_0_10px_rgba(0,245,255,0.25)]'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.05] border-white/[0.06]'
          }`}
          title={t('sleepTimer.title', 'Sleep Timer')}
          aria-label="Sleep Timer"
        >
          <Moon size={16} className={sleepTimerState.isActive ? 'text-primary animate-pulse' : ''} />
          {sleepTimerState.isActive && (
            <span className="hidden md:inline-block text-[10px] font-mono font-bold text-primary">
              {sleepTimerState.mode === 'time'
                ? `${Math.ceil(sleepTimerState.remainingSeconds / 60)}m`
                : 'Track'}
            </span>
          )}
        </button>

        {/* Keyboard Shortcuts */}
        <button
          type="button"
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
          }}
          className="hidden md:flex p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-primary transition-all border border-white/[0.06]"
          title="Keyboard Shortcuts (?)"
          aria-label="Keyboard Shortcuts"
        >
          <Keyboard size={15} />
        </button>

        {/* Language Switcher */}
        <button
          type="button"
          onClick={() => i18n.changeLanguage(i18n.language === 'vi' ? 'en' : 'vi')}
          className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white transition-all text-xs font-mono border border-white/[0.06]"
          title={t('layout.language', 'Language')}
          aria-label="Toggle language"
        >
          <Languages size={14} className="text-primary" />
          <span className="font-bold">{i18n.language === 'vi' ? 'VI' : 'EN'}</span>
        </button>

        {/* User Account / Profile */}
        {isAuthenticated ? (
          <div className="relative" ref={avatarMenuRef}>
            <button
              type="button"
              onClick={() => setIsAvatarMenuOpen((v) => !v)}
              className="flex items-center gap-2 p-1 sm:p-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-primary/30 transition-all cursor-pointer"
              aria-label="User Menu"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0 overflow-hidden border border-primary/30">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User size={15} />
                )}
              </div>
              <span className="hidden xl:inline-block text-xs font-semibold text-slate-200 max-w-[90px] truncate">
                {user?.fullName || user?.email?.split('@')[0] || user?.username || 'User'}
              </span>
            </button>

            {/* Avatar Dropdown Menu (Opens upward) */}
            {isAvatarMenuOpen && (
              <div className="absolute bottom-full right-0 mb-3 w-48 bg-[#0c1626]/95 border border-white/10 rounded-2xl shadow-2xl z-50 py-1.5 overflow-hidden backdrop-blur-xl">
                <div className="px-3.5 py-2 border-b border-white/[0.06]">
                  <p className="text-xs font-semibold text-white truncate">
                    {user?.fullName || user?.username || 'User'}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono truncate">
                    {user?.email || 'Logged in'}
                  </p>
                </div>

                {user?.hasPassword && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAvatarMenuOpen(false);
                      onOpenChangePasswordModal();
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors"
                  >
                    <Key size={14} className="text-primary" /> {t('layout.changePassword', 'Change Password')}
                  </button>
                )}
                {user?.hasPassword !== true && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAvatarMenuOpen(false);
                      onOpenSetPasswordModal();
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors"
                  >
                    <Key size={14} className="text-primary" /> {t('layout.setLocalPassword', 'Set Local Password')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsAvatarMenuOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-slate-300 hover:bg-white/[0.08] hover:text-white transition-colors"
                >
                  <Settings size={14} className="text-primary" /> {t('nav.settings', 'Settings')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAvatarMenuOpen(false);
                    void onLogout();
                  }}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium text-left text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors disabled:opacity-50"
                >
                  {isLoggingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                  {t('layout.signOut', 'Sign Out')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <NavLink
            to="/login"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-primary text-slate-950 hover:bg-primary/90 shadow-[0_0_12px_rgba(0,245,255,0.3)] transition-all"
          >
            <LogIn size={14} />
            <span className="hidden sm:inline-block">{t('layout.signIn', 'Sign In')}</span>
          </NavLink>
        )}
      </div>
    </footer>
  );
}
