import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Settings,
  HardDrive,
  Cloud,
  CloudUpload,
  CloudDownload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Languages,
  Keyboard,
  Sliders,
  Info,
  Tags,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { OfflineStorageManager } from '../components/settings/OfflineStorageManager';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { useGlobalAudio } from '../context/AudioContext';
import { BACKEND_URL, axiosClient } from '../api/axiosClient';
import { db } from '../lib/db';

type SettingsTab = 'storage' | 'cloud' | 'general';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const { isOfflineMode } = useOffline();
  const { playerState } = useGlobalAudio();
  const {
    useLegacyMetadata,
    setGlobalLegacyMetadata,
    currentTrack,
    extractMetadata,
    clearTrackCachedMetadata,
    reloadCurrentTrackFromDrive,
  } = playerState;
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = (searchParams.get('tab') as SettingsTab) || 'storage';
  const [activeTab, setActiveTab] = useState<SettingsTab>(
    tabParam === 'cloud' ? 'cloud' : tabParam === 'general' ? 'general' : 'storage'
  );

  const [syncing, setSyncing] = useState(false);
  const [refreshingMeta, setRefreshingMeta] = useState(false);

  const handleRefreshCurrentTrackMeta = async () => {
    if (!currentTrack) {
      toast.error(t('settings.noTrackPlaying', 'Chưa có bài hát nào đang phát.'));
      return;
    }
    setRefreshingMeta(true);
    try {
      if (clearTrackCachedMetadata) {
        await clearTrackCachedMetadata(currentTrack);
      }
      if (currentTrack.sourceType !== 'LOCAL' && reloadCurrentTrackFromDrive) {
        await reloadCurrentTrackFromDrive();
      } else if (extractMetadata) {
        await extractMetadata(currentTrack, { ignoreCache: true });
      }
      toast.success(t('settings.refreshMetaSuccess', 'Đã làm mới thông tin và ảnh bìa bài hát!'));
    } catch (e: any) {
      console.error('Refresh metadata error:', e);
      toast.error(e?.message || 'Không thể làm mới metadata.');
    } finally {
      setRefreshingMeta(false);
    }
  };

  useEffect(() => {
    const currentTab = searchParams.get('tab') as SettingsTab;
    if (currentTab && (currentTab === 'storage' || currentTab === 'cloud' || currentTab === 'general')) {
      setActiveTab(currentTab);
    }
  }, [searchParams]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleBackupToDrive = async () => {
    if (!isAuthenticated) return;
    const confirmed = await confirm({
      title: t('layout.backupConfigTitle', 'Sao lưu cấu hình lên Drive'),
      description: t(
        'layout.backupConfigDesc',
        'Hành động này sẽ ghi đè bản sao lưu trên Google Drive bằng cài đặt hiện tại của bạn. Bạn có muốn tiếp tục?'
      ),
      confirmText: t('layout.yesBackup', 'Có, Sao lưu'),
    });

    if (!confirmed) return;

    setSyncing(true);
    try {
      const configStr = localStorage.getItem('SONIC_DEPTH_AUDIO_CONFIG');
      const config = configStr ? JSON.parse(configStr) : {};
      const idbData = await db.getAllData();

      await axiosClient.post('/api/backup/drive', { config, idbData });
      toast.success(t('layout.backupSuccess', 'Sao lưu lên Google Drive thành công!'));
    } catch (e: any) {
      console.error('Backup error:', e);
      toast.error(
        e.message || t('layout.backupFail', 'Sao lưu lên Google Drive thất bại.')
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleRestoreFromDrive = async () => {
    if (!isAuthenticated) return;
    const confirmed = await confirm({
      title: t('layout.restoreConfigTitle', 'Khôi phục cấu hình từ Drive'),
      description: t(
        'layout.restoreConfigDesc',
        'Hành động này sẽ ghi đè cài đặt hiện tại bằng bản sao lưu từ Google Drive. Bạn có muốn tiếp tục?'
      ),
      confirmText: t('layout.yesRestore', 'Có, Khôi phục'),
      confirmColor: 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 border-yellow-500/30',
    });

    if (!confirmed) return;

    setSyncing(true);
    try {
      const response = (await axiosClient.get('/api/backup/drive')) as any;
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

      toast.success(
        t('layout.restoreSuccess', 'Khôi phục thành công! Ứng dụng sẽ tải lại.')
      );
      setTimeout(() => globalThis.location.reload(), 1500);
    } catch (e: any) {
      console.error('Restore error:', e);
      toast.error(
        e.message || t('layout.restoreFail', 'Khôi phục từ Google Drive thất bại.')
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-7xl 2xl:max-w-none mx-auto pb-28 md:pb-32 no-scrollbar">
      {/* Header */}
      <div className="mb-6 border-b border-white/[0.06] pb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold font-display text-white tracking-tight flex items-center gap-3">
            <Settings className="text-primary" size={28} />
            {t('settings.pageTitle', 'Cài Đặt & Quản Lý')}
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm font-mono mt-1">
            {t('settings.pageDesc', 'Tùy chỉnh lưu trữ offline, đồng bộ hóa đám mây và cấu hình hệ thống.')}
          </p>
        </div>

        {/* Settings Navigation Tabs */}
        <div className="flex w-full sm:w-auto gap-1.5 overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0c1626]/80 p-1.5 backdrop-blur-xl shadow-lg no-scrollbar max-w-full touch-pan-x">
          <button
            onClick={() => handleTabChange('storage')}
            className={`flex items-center justify-center gap-2 shrink-0 grow sm:grow-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'storage'
                ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(0,245,255,0.25)]'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <HardDrive size={15} className="shrink-0" />
            <span>{t('settings.tabStorage', 'Bộ Nhớ Offline')}</span>
          </button>

          <button
            onClick={() => handleTabChange('cloud')}
            className={`flex items-center justify-center gap-2 shrink-0 grow sm:grow-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'cloud'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <Cloud size={15} className="shrink-0" />
            <span>{t('settings.tabCloud', 'Đồng Bộ Drive')}</span>
          </button>

          <button
            onClick={() => handleTabChange('general')}
            className={`flex items-center justify-center gap-2 shrink-0 grow sm:grow-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'general'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <Sliders size={15} className="shrink-0" />
            <span>{t('settings.tabGeneral', 'Cài Đặt Chung')}</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1">
        {/* TAB 1: Storage Manager */}
        {activeTab === 'storage' && <OfflineStorageManager />}

        {/* TAB 2: Cloud Sync & Backup */}
        {activeTab === 'cloud' && (
          <div className="flex flex-col gap-6 max-w-4xl">
            <div className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-5 sm:p-6 backdrop-blur-xl">
              <div className="flex items-center gap-3.5 pb-4 border-b border-white/[0.06] mb-5">
                <div className="w-11 h-11 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                  <Cloud size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {t('settings.cloudSyncTitle', 'Đồng Bộ Hóa Google Drive')}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {t('settings.cloudSyncDesc', 'Sao lưu danh sách phát, EQ preset và cài đặt cấu hình an toàn trên Drive')}
                  </p>
                </div>
              </div>

              {isAuthenticated ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                        {user?.fullName?.[0] || user?.email?.[0] || 'U'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-white truncate">
                          {user?.fullName || user?.email}
                        </div>
                        <div className="text-xs text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                          {user?.isGoogleLinked ? (
                            <>
                              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                              <span className="text-emerald-400 font-medium truncate">
                                {t('settings.googleLinked', 'Đã liên kết Google Drive')}
                              </span>
                            </>
                          ) : (
                            <>
                              <AlertCircle size={13} className="text-amber-400 shrink-0" />
                              <span className="text-amber-400 truncate">
                                {t('settings.googleNotLinked', 'Chưa liên kết Google Drive')}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {!user?.isGoogleLinked && (
                      <button
                        onClick={() => (globalThis.location.href = `${BACKEND_URL}/oauth2/authorization/google`)}
                        className="w-full sm:w-auto text-center px-4 py-2 rounded-xl bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-xs font-bold transition-all shrink-0 cursor-pointer"
                      >
                        {t('layout.linkGoogleDrive', 'Liên kết Drive')}
                      </button>
                    )}
                  </div>

                  {user?.isGoogleLinked && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-2">
                      <button
                        onClick={handleBackupToDrive}
                        disabled={syncing || isOfflineMode}
                        className="flex flex-col items-start p-4 rounded-2xl bg-primary/10 hover:bg-primary/15 border border-primary/25 transition-all group disabled:opacity-50 text-left cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary mb-3 group-hover:scale-110 transition-transform shrink-0">
                          {syncing ? <Loader2 size={18} className="animate-spin" /> : <CloudUpload size={18} />}
                        </div>
                        <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                          {t('layout.backupToDrive', 'Sao lưu cấu hình lên Drive')}
                        </span>
                        <span className="text-xs text-slate-400 font-mono mt-1">
                          {t('settings.backupHint', 'Đồng bộ EQ, playlist và cài đặt hiện tại lên đám mây')}
                        </span>
                      </button>

                      <button
                        onClick={handleRestoreFromDrive}
                        disabled={syncing || isOfflineMode}
                        className="flex flex-col items-start p-4 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/25 transition-all group disabled:opacity-50 text-left cursor-pointer"
                      >
                        <div className="w-9 h-9 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-110 transition-transform shrink-0">
                          {syncing ? <Loader2 size={18} className="animate-spin" /> : <CloudDownload size={18} />}
                        </div>
                        <span className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">
                          {t('layout.restoreFromDrive', 'Khôi phục từ Drive')}
                        </span>
                        <span className="text-xs text-slate-400 font-mono mt-1">
                          {t('settings.restoreHint', 'Ghi đè cấu hình local bằng bản lưu trữ trên Drive')}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <p className="text-sm text-slate-300 mb-4">
                    {t('settings.loginRequiredForCloud', 'Vui lòng đăng nhập để sử dụng tính năng sao lưu và đồng bộ qua Google Drive.')}
                  </p>
                  <button
                    onClick={() => navigate('/login')}
                    className="px-5 py-2.5 rounded-xl bg-primary text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(0,245,255,0.3)] hover:scale-105 transition-all cursor-pointer"
                  >
                    {t('layout.signIn', 'Đăng Nhập Ngay')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: General & System Preferences */}
        {activeTab === 'general' && (
          <div className="flex flex-col gap-6 max-w-4xl">
            {/* Language & UI */}
            <div className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-5 sm:p-6 backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shrink-0">
                    <Languages size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {t('layout.language', 'Ngôn ngữ hiển thị')}
                    </h4>
                    <p className="text-xs text-slate-400 font-mono">
                      {i18n.language === 'vi' ? 'Tiếng Việt (Mặc định)' : 'English'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/10 shrink-0 self-start sm:self-auto">
                  <button
                    onClick={() => i18n.changeLanguage('vi')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      i18n.language === 'vi'
                        ? 'bg-primary text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Tiếng Việt
                  </button>
                  <button
                    onClick={() => i18n.changeLanguage('en')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      i18n.language === 'en'
                        ? 'bg-primary text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>
            </div>

            {/* Metadata Parser Engine Selection */}
            <div className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-5 sm:p-6 backdrop-blur-xl flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-400 shrink-0">
                    <Tags size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex flex-wrap items-center gap-2">
                      <span>{t('settings.metadataParserTitle', 'Trình Trích Xuất Metadata & Ảnh Bìa')}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold shrink-0">
                        Global Engine
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {t('settings.metadataParserDesc', 'Lựa chọn engine phân tích ID3 tag và trích xuất thông tin, ảnh bìa toàn cục cho mọi bài hát.')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Engine Selection Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Modern Parser Option */}
                <button
                  type="button"
                  onClick={() => setGlobalLegacyMetadata(false)}
                  className={`flex flex-col text-left p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                    !useLegacyMetadata
                      ? 'bg-primary/10 border-primary/40 shadow-[0_0_20px_rgba(0,245,255,0.15)] ring-1 ring-primary/40'
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                        !useLegacyMetadata ? 'border-primary bg-primary' : 'border-slate-500'
                      }`}>
                        {!useLegacyMetadata && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                      </div>
                      <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                        {t('settings.modernParserTitle', 'Engine Hiện đại (Modern)')}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.06] text-slate-300 border border-white/10 font-semibold shrink-0">
                      {t('settings.modernParserBadge', 'Mặc định')}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-cyan-400/80 mb-1.5">
                    {t('settings.modernParserSubtitle', 'music-metadata • Chuẩn Web Mới')}
                  </span>
                  <p className="text-xs text-slate-400 font-sans leading-relaxed">
                    {t('settings.modernParserDesc', 'Tối ưu hóa tốc độ tải và phân tích dữ liệu âm thanh trực tiếp từ luồng stream.')}
                  </p>
                </button>

                {/* Legacy Parser Option */}
                <button
                  type="button"
                  onClick={() => setGlobalLegacyMetadata(true)}
                  className={`flex flex-col text-left p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                    useLegacyMetadata
                      ? 'bg-primary/10 border-primary/40 shadow-[0_0_20px_rgba(0,245,255,0.15)] ring-1 ring-primary/40'
                      : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                        useLegacyMetadata ? 'border-primary bg-primary' : 'border-slate-500'
                      }`}>
                        {useLegacyMetadata && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                      </div>
                      <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                        {t('settings.legacyParserTitle', 'Engine Legacy (Khuyên Dùng)')}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/20 text-primary border border-primary/30 font-bold flex items-center gap-1 shrink-0">
                      <Sparkles size={10} />
                      {t('settings.legacyParserBadge', 'Chính xác hơn')}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-cyan-400/80 mb-1.5">
                    {t('settings.legacyParserSubtitle', 'music-metadata-browser • Tương thích cao')}
                  </span>
                  <p className="text-xs text-slate-400 font-sans leading-relaxed">
                    {t('settings.legacyParserDesc', 'Đọc metadata và trích xuất ảnh bìa chính xác hơn đối với các tệp có cấu trúc ID3 phức tạp hoặc định dạng cũ.')}
                  </p>
                </button>
              </div>

              {/* Explanatory Note Callout */}
              <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 backdrop-blur-sm">
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0 mt-0.5">
                  <Info size={16} />
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  <span className="font-bold text-cyan-300">
                    {t('settings.legacyNoteTitle', 'Lưu ý & Khuyến nghị quan trọng:')}
                  </span>
                  <p className="text-slate-300 leading-relaxed font-sans">
                    {t('settings.legacyNoteContent', 'Trình phân tích Legacy (music-metadata-browser) có khả năng đọc thông tin thẻ bài hát và trích xuất ảnh bìa (Album Art / ID3 APIC) chính xác và đầy đủ hơn so với trình phân tích mới trong nhiều trường hợp (đặc biệt là tệp cục bộ hoặc tệp MP3 có gắn thẻ ID3 đặc thù). Hãy bật tùy chọn này nếu bài hát của bạn bị thiếu thông tin hoặc không hiển thị ảnh bìa.')}
                  </p>
                </div>
              </div>

              {/* Quick action: Re-parse current track */}
              {currentTrack && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-white/[0.04]">
                  <div className="text-xs text-slate-400 font-mono min-w-0 flex-1">
                    <span className="text-slate-200 font-medium">{t('nav.nowPlaying', 'Đang phát')}:</span>{' '}
                    <span className="text-primary font-semibold break-all sm:break-normal">{currentTrack.title || currentTrack.fileName}</span>
                  </div>
                  <button
                    type="button"
                    disabled={refreshingMeta}
                    onClick={handleRefreshCurrentTrackMeta}
                    className="w-full sm:w-auto justify-center px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <RefreshCw size={13} className={refreshingMeta ? 'animate-spin text-primary shrink-0' : 'text-slate-400 shrink-0'} />
                    <span>{t('settings.refreshCurrentMeta', 'Làm mới metadata bài đang phát')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Keyboard Shortcuts Reference */}
            <div className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-5 sm:p-6 backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06] mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-400 shrink-0">
                    <Keyboard size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {t('settings.shortcutsTitle', 'Phím Tắt Nhanh (Keyboard Shortcuts)')}
                    </h4>
                    <p className="text-xs text-slate-400 font-mono">
                      {t('settings.shortcutsDesc', 'Điều khiển trình phát nhạc cực nhanh bằng bàn phím')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))}
                  className="w-full sm:w-auto text-center px-3.5 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all shrink-0 cursor-pointer"
                >
                  {t('settings.openShortcutsModal', 'Mở bảng phím tắt (?)')}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {[
                  { key: 'Space', desc: 'Phát / Tạm dừng' },
                  { key: 'J / L', desc: 'Tua lùi / Tua tới 5s' },
                  { key: '← / →', desc: 'Tua 5 giây' },
                  { key: '↑ / ↓', desc: 'Tăng / Giảm âm lượng' },
                  { key: 'M', desc: 'Bật / Tắt tiếng (Mute)' },
                  { key: 'T', desc: 'Hẹn giờ tắt nhạc (Sleep Timer)' },
                  { key: 'S', desc: 'Bật / Tắt xáo trộn (Shuffle)' },
                  { key: 'R', desc: 'Đổi chế độ lặp (Repeat)' },
                  { key: 'F', desc: 'Thêm / Bỏ yêu thích' },
                ].map((s) => (
                  <div key={s.key} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-xs text-slate-300">{s.desc}</span>
                    <kbd className="px-2 py-0.5 rounded-md bg-white/[0.08] border border-white/15 text-[11px] font-mono text-primary font-bold shrink-0 ml-2">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>

            {/* System Engine & Architecture Info */}
            <div className="rounded-3xl bg-white/[0.02] border border-white/[0.08] p-5 sm:p-6 backdrop-blur-xl">
              <div className="flex items-center gap-3.5 pb-4 border-b border-white/[0.06] mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-slate-300 shrink-0">
                  <Info size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex flex-wrap items-center gap-2">
                    <span>Rhythm Hi-Res Audio Studio</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-bold shrink-0">
                      v2.0
                    </span>
                  </h4>
                  <p className="text-xs text-slate-400 font-mono">
                    High-Fidelity Web Audio DSP Engine & Local Cache
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs font-mono">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex flex-col gap-1">
                  <span className="text-slate-400 uppercase text-[10px] font-bold">Audio Engine</span>
                  <span className="text-slate-200">Web Audio API • 32-bit Float Pipeline</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex flex-col gap-1">
                  <span className="text-slate-400 uppercase text-[10px] font-bold">DSP & WASM Decoders</span>
                  <span className="text-slate-200">Parametric EQ • Convolution Reverb • WASM FLAC/AAC</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

