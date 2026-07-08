import { NavLink, Outlet, useLocation } from 'react-router-dom';
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
import { db } from '../lib/db';
import { useGlobalAudio } from '../context/AudioContext';

// parseJwt removed as user data is now fetched from /me

export function Layout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { isAuthenticated, setIsAuthenticated, user } = useAuth();
  const { playerState } = useGlobalAudio();
  const [syncing, setSyncing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      setTimeout(() => window.location.reload(), 1500);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      console.error(e);
      setNotification({ type: 'error', message: e.message || t('layout.restoreFail', 'Failed to restore from Google Drive. No backup found or account not linked.') });
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = async () => {
    if (isAuthenticated) {
      setIsLoggingOut(true);
      
      // Auto-backup before logout if Google Drive is linked
      if (user?.isGoogleLinked) {
        try {
          const configStr = localStorage.getItem('SONIC_DEPTH_AUDIO_CONFIG');
          const config = configStr ? JSON.parse(configStr) : {};
          const idbData = await db.getAllData();
          await axiosClient.post('/api/backup/drive', { config, idbData });
        } catch (e) {
          console.error('Auto-backup failed on logout', e);
        }
      }

      // Add token to blacklist
      try {
        await axiosClient.post('/api/auth/logout');
      } catch (e) {
        console.error('Failed to blacklist token', e);
      }
      setIsLoggingOut(false);
    }
    setIsAuthenticated(false);
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

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-background">
      {/* Main App Area */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/60 z-[50] md:hidden" 
            onClick={() => setIsMobileMenuOpen(false)} 
          />
        )}
        
        {/* Sidebar */}
        <aside className={`w-64 bg-surface border-r border-white/5 flex flex-col flex-shrink-0 transition-transform duration-300 fixed inset-y-0 left-0 z-[60] md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 flex items-center justify-between">
            <h1 className="text-2xl font-bold font-sans text-white tracking-tight flex items-center gap-2">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                <rect x="3" y="9" width="4" height="12" rx="2" fill="currentColor" className="animate-pulse" style={{animationDelay: '0ms'}}/>
                <rect x="10" y="3" width="4" height="18" rx="2" fill="currentColor" className="animate-pulse" style={{animationDelay: '150ms'}}/>
                <rect x="17" y="7" width="4" height="14" rx="2" fill="currentColor" className="animate-pulse" style={{animationDelay: '300ms'}}/>
              </svg>
              Rhythm
            </h1>
            <button className="md:hidden text-white/50 hover:text-white" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu">
              <CloseIcon size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4">
            <div className="mb-8">
              <h2 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-4 px-2">{t('layout.discover', 'Discover')}</h2>
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
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${(isActive && item.path !== '/library') || isLibraryChild
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`
                      }
                    >
                      {item.icon}
                      <span>{item.name}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>

            <div>
              <h2 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-4 px-2">{t('layout.studioTools', 'Studio Tools')}</h2>
              <div className="flex flex-col gap-1">
                {soundTools.map(item => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`
                    }
                  >
                    {item.icon}
                    <span>{item.name}</span>
                  </NavLink>
                ))}
              </div>
            </div>

            {/* Local Files */}
            <div className="mt-8">
              <h2 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-4 px-2">{t('layout.localFiles', 'Local Files')}</h2>
              <div className="flex flex-col gap-1">
                <LocalFilePicker />
              </div>
            </div>

            {isAuthenticated && (
              <div className="mt-8">
                <h2 className="text-xs font-mono text-white/40 uppercase tracking-widest mb-4 px-2">{t('layout.cloudSync', 'Cloud Sync')}</h2>
                <div className="flex flex-col gap-1">
                  {user?.isGoogleLinked ? (
                    <>
                      <button 
                        onClick={() => setShowBackupConfirm(true)} 
                        disabled={syncing}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors text-left disabled:opacity-50"
                      >
                        {syncing ? <Loader2 size={20} className="animate-spin" /> : <CloudUpload size={20} />}
                        <span>{t('layout.backupToDrive', 'Backup Configuration')}</span>
                      </button>
                      <button 
                        onClick={() => setShowRestoreConfirm(true)} 
                        disabled={syncing}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors text-left disabled:opacity-50"
                      >
                        {syncing ? <Loader2 size={20} className="animate-spin" /> : <CloudDownload size={20} />}
                        <span>{t('layout.restoreFromDrive', 'Restore from Drive')}</span>
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => window.location.href = `http://${window.location.hostname}:8080/oauth2/authorization/google`} 
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors text-left"
                    >
                      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      <span>{t('layout.linkGoogleDrive', 'Link with Google Drive')}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Bottom Sidebar - User Profile/Login */}
          <div className="p-4 border-t border-white/5">
            <div className="flex items-center justify-between mb-3 px-2">
              <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">{t('layout.language', 'Ngôn ngữ')}</span>
              <button 
                onClick={() => i18n.changeLanguage(i18n.language === 'vi' ? 'en' : 'vi')}
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                aria-label="Toggle language"
              >
                <Languages size={14} />
                <span className="text-xs font-bold">{i18n.language === 'vi' ? 'VI' : 'EN'}</span>
              </button>
            </div>
            {isAuthenticated ? (
              <div className="flex items-center justify-between p-2 rounded-lg bg-white/5">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 overflow-hidden">
                    {user?.avatarUrl ? (
                      <img src={user?.avatarUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User size={16} />
                    )}
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="text-sm font-medium text-white truncate">
                      {user?.fullName || user?.email?.split('@')[0] || user?.username || 'User'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {(!isAuthenticated || user?.hasPassword !== true) && (
                    <button
                      onClick={() => setIsPasswordModalOpen(true)}
                      className="p-2 text-white/40 hover:text-[#00E5FF] hover:bg-[#00E5FF]/10 rounded-md transition-colors"
                      title={t('layout.setLocalPassword', 'Set Local Password')}
                      aria-label="Set local password"
                    >
                      <Key size={16} />
                    </button>
                  )}
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-md transition-colors disabled:opacity-50"
                    title={t('layout.signOut', 'Sign Out')}
                    aria-label="Sign out"
                  >
                    {isLoggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                  </button>
                </div>
              </div>
            ) : (
              <NavLink 
                to="/login"
                className={({ isActive }) =>
                  `w-full flex items-center justify-center gap-2 font-medium py-2.5 rounded-lg transition-colors ${
                    isActive ? 'bg-primary/20 text-primary' : 'bg-white/10 hover:bg-white/20 text-white'
                  }`
                }
              >
                <LogIn size={18} />
                <span>{t('layout.signIn', 'Sign In')}</span>
              </NavLink>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 relative flex flex-col min-w-0 overflow-hidden bg-background">
          {/* Mobile Header (Fixed) */}
          <div className="md:hidden p-4 border-b border-white/5 flex items-center gap-3 bg-surface z-[40] shrink-0">
             <button onClick={() => setIsMobileMenuOpen(true)} className="text-white hover:text-primary transition-colors" aria-label="Open menu">
               <Menu size={24} />
             </button>
             <h1 className="text-xl font-bold font-sans text-white tracking-tight flex items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                <rect x="3" y="9" width="4" height="12" rx="2" fill="currentColor" className="animate-pulse" style={{animationDelay: '0ms'}}/>
                <rect x="10" y="3" width="4" height="18" rx="2" fill="currentColor" className="animate-pulse" style={{animationDelay: '150ms'}}/>
                <rect x="17" y="7" width="4" height="14" rx="2" fill="currentColor" className="animate-pulse" style={{animationDelay: '300ms'}}/>
              </svg>
              Rhythm
            </h1>
          </div>
          
          <main className="flex-1 overflow-y-auto w-full relative">
            {notification && (
              <div className={`fixed top-16 md:top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border ${
                notification.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'
              }`}>
                {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                <span className="font-medium text-sm">{notification.message}</span>
              </div>
            )}
            {playerState.isLoadingTrack && (
              <div className={`fixed ${notification ? 'top-32 md:top-20' : 'top-16 md:top-4'} left-1/2 -translate-x-1/2 z-[100] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-4 py-3 text-primary shadow-lg backdrop-blur-md`}>
                <Loader2 size={20} className="animate-spin shrink-0" />
                <span className="truncate text-sm font-medium">
                  {playerState.loadingTrackPhase === 'processing'
                    ? t('layout.processingTrack', 'Đang tính toán âm thanh...')
                    : t('layout.downloadingTrack', 'Đang tải nhạc về...')}
                </span>
              </div>
            )}
            <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-full w-full pb-32">
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
            <div className="flex justify-end gap-3">
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
            <div className="flex justify-end gap-3">
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
    </div>
  );
}
