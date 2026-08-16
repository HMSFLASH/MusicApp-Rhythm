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
  AlertCircle,
  CheckCircle2,
  CloudUpload,
  CloudDownload,
  ListMusic,
  Key,
  Menu,
  Languages,
  Keyboard,
  X as CloseIcon
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { axiosClient } from '../api/axiosClient';
import { BottomPlayerBar } from './BottomPlayerBar';
import { useAuth } from '../context/AuthContext';
import { LocalFilePicker } from './LocalFilePicker';
import { UploadQueuePanel } from './UploadQueuePanel';
import { SetLocalPasswordModal } from './SetLocalPasswordModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import { db } from '../lib/db';
import { clearCachedAudio } from '../utils/mediaCache';
import { clearCovers } from '../utils/idb';
import { useGlobalAudio } from '../context/AudioContext';
import { BACKEND_URL } from '../api/axiosClient';
import { LOCAL_STORAGE_KEY, PLAYBACK_STORAGE_KEY } from '../hooks/audioStorage';
import { useOffline } from '../context/OfflineContext';

// parseJwt removed as user data is now fetched from /me

export function Layout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, setIsAuthenticated, user } = useAuth();
  const { playerState } = useGlobalAudio();
  const { isOfflineMode } = useOffline();
  const [syncing, setSyncing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [showBackupConfirm, setShowBackupConfirm] = useState(false);
  const [notification, setNotification] = useState<{ type: 'error' | 'success', message: string } | null>(null);

  // Close mobile menu on navigation
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const handleAppNotification = (e: CustomEvent) => {
      setNotification(e.detail);
    };
    globalThis.addEventListener('app-notification', handleAppNotification as EventListener);
    return () => {
      globalThis.removeEventListener('app-notification', handleAppNotification as EventListener);
    };
  }, []);

  const handleBackup = async () => {
    setShowBackupConfirm(false);
    if (!isAuthenticated) return;
    setSyncing(true);
    setNotification(null);
    try {
      const configStr = localStorage.getItem('SONIC_DEPTH_AUDIO_CONFIG');
      const config = configStr ? JSON.parse(configStr) : {};
      const idbData = await db.getAllData();

      await axiosClient.post('/api/backup/drive', { config, idbData });

      setNotification({ type: 'success', message: t('layout.backupSuccess', 'Backup to Google Drive successful!') });

    } catch (e: any) {
      console.error(e);
      setNotification({ type: 'error', message: e.message || t('layout.backupFail', 'Failed to backup to Google Drive. Ensure you have linked your account.') });
    } finally {
      setSyncing(false);
    }
  };

  const handleRestore = async () => {
    setShowRestoreConfirm(false);
    if (!isAuthenticated) return;
    setSyncing(true);
    setNotification(null);
    try {

      const response = await axiosClient.get('/api/backup/drive') as any;
      let config = response;

      if (response && response.config) {
        config = response.config;
        if (response.idbData) {
          await db.importData(response.idbData);
        }
      }

      if (config && Object.keys(config).length > 0) {
        localStorage.setItem('SONIC_DEPTH_AUDIO_CONFIG', JSON.stringify(config));
      }

      setNotification({ type: 'success', message: t('layout.restoreSuccess', 'Restore successful! The app will now reload to apply changes.') });
      setTimeout(() => globalThis.location.reload(), 1500);

    } catch (e: any) {
      console.error(e);
      setNotification({ type: 'error', message: e.message || t('layout.restoreFail', 'Failed to restore from Google Drive. No backup found or account not linked.') });
    } finally {
      setSyncing(false);
    }
  };

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
    { name: t('nav.audioStudio', 'Audio Studio'), path: '/studio', icon: <SlidersHorizontal size={20} /> }
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
                  <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">PRO</span>
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
                        return `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                          active
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
                      `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-primary/15 text-primary shadow-[inset_0_0_12px_rgba(0,245,255,0.1)] border border-primary/25 font-semibold'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
                      }`
                    }
                  >
                    <span className="transition-transform group-hover:scale-110 duration-200">{item.icon}</span>
                    <span>{item.name}</span>
                  </NavLink>
                ))}
              </div>
            </div>

            {/* Local Files */}
            <div>
              <h2 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2.5 px-3">{t('layout.localFiles', 'Local Files')}</h2>
              <div className="flex flex-col gap-1">
                <LocalFilePicker />
              </div>
            </div>

            {isAuthenticated && (
              <div>
                <h2 className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2.5 px-3">{t('layout.cloudSync', 'Cloud Sync')}</h2>
                <div className="flex flex-col gap-1.5">
                  {user?.isGoogleLinked ? (
                    <>
                      <button
                        onClick={() => setShowBackupConfirm(true)}
                        disabled={syncing || isOfflineMode}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] transition-all text-left disabled:opacity-50 border border-transparent hover:border-white/[0.05]"
                      >
                        {syncing ? <Loader2 size={18} className="animate-spin text-primary" /> : <CloudUpload size={18} className="text-primary/80" />}
                        <span className="truncate">{t('layout.backupToDrive', 'Backup Configuration')}</span>
                      </button>
                      <button
                        onClick={() => setShowRestoreConfirm(true)}
                        disabled={syncing || isOfflineMode}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] transition-all text-left disabled:opacity-50 border border-transparent hover:border-white/[0.05]"
                      >
                        {syncing ? <Loader2 size={18} className="animate-spin text-cyan-400" /> : <CloudDownload size={18} className="text-cyan-400/80" />}
                        <span className="truncate">{t('layout.restoreFromDrive', 'Restore from Drive')}</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => globalThis.location.href = `${BACKEND_URL}/oauth2/authorization/google`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] transition-all text-left border border-white/[0.05]"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      <span className="truncate">{t('layout.linkGoogleDrive', 'Link Google Drive')}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
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
                  className="hidden md:inline-flex p-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-primary transition-all border border-white/[0.06]"
                  title="Phím tắt nhanh (?)"
                  aria-label="Keyboard Shortcuts"
                >
                  <Keyboard size={13} />
                </button>
                <button
                  onClick={() => i18n.changeLanguage(i18n.language === 'vi' ? 'en' : 'vi')}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white transition-all text-xs font-mono border border-white/[0.06]"
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
                  `w-full flex items-center justify-center gap-2 font-semibold text-xs py-2.5 rounded-xl transition-all ${
                    isActive ? 'bg-primary text-slate-950 shadow-[0_0_15px_rgba(0,245,255,0.4)]' : 'bg-white/[0.06] hover:bg-primary/20 text-slate-200 hover:text-primary border border-white/[0.08]'
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

          <main className="flex-1 overflow-y-auto w-full relative">
            {notification && (
              <div className={`fixed top-16 md:top-4 left-1/2 -translate-x-1/2 z-[100] flex w-[calc(100vw_-_2rem)] max-w-lg items-start gap-2 px-4 py-3 rounded-lg shadow-lg border ${notification.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'
                }`}>
                {notification.type === 'error' ? <AlertCircle size={20} className="shrink-0" /> : <CheckCircle2 size={20} className="shrink-0" />}
                <span className="min-w-0 text-sm font-medium break-words">{notification.message}</span>
              </div>
            )}
            {playerState.isLoadingTrack && (
              <div className={`fixed ${notification ? 'top-32 md:top-20' : 'top-16 md:top-4'} left-1/2 -translate-x-1/2 z-[100] flex max-w-[calc(100vw_-_2rem)] items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-4 py-3 text-primary shadow-lg backdrop-blur-md`}>
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

      {/* Backup Confirmation Modal */}
      {showBackupConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowBackupConfirm(false)}>
          <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <CloudUpload className="text-primary" size={24} />
              {t('layout.backupConfigTitle', 'Backup Configuration')}
            </h2>
            <p className="text-white/70 mb-6 text-sm">
              {t('layout.backupConfigDesc', 'This will overwrite your existing backup on Google Drive with your current local settings (EQ, playlists, presets). Do you want to continue?')}
            </p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                onClick={() => setShowBackupConfirm(false)}
                className="px-4 py-2 rounded-xl text-white hover:bg-white/10 transition-colors font-medium text-sm"
              >
                {t('layout.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleBackup}
                className="px-4 py-2 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 transition-colors font-medium text-sm border border-primary/30"
              >
                {t('layout.yesBackup', 'Yes, Backup')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {showRestoreConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowRestoreConfirm(false)}>
          <div className="bg-[#121212] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <AlertCircle className="text-yellow-500" size={24} />
              {t('layout.restoreConfigTitle', 'Restore Configuration')}
            </h2>
            <p className="text-white/70 mb-6 text-sm">
              {t('layout.restoreConfigDesc', 'This will overwrite your current local EQ settings, presets, and playlists with the backup from Google Drive. Do you want to continue?')}
            </p>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
              <button
                onClick={() => setShowRestoreConfirm(false)}
                className="px-4 py-2 rounded-xl text-white hover:bg-white/10 transition-colors font-medium text-sm"
              >
                {t('layout.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleRestore}
                className="px-4 py-2 rounded-xl bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 transition-colors font-medium text-sm border border-yellow-500/30"
              >
                {t('layout.yesRestore', 'Yes, Restore')}
              </button>
            </div>
          </div>
        </div>
      )}
      <SetLocalPasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        defaultEmail={isAuthenticated ? (user?.email || user?.loginId) : ''}
      />
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />
    </div>
  );
}
