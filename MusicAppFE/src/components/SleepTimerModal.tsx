import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Clock, Disc, X, Plus, Minus, Check, Volume2, Sparkles } from 'lucide-react';
import { useSleepTimer } from '../context/SleepTimerContext';
import { useGlobalAudio } from '../context/AudioContext';

const PRESET_MINUTES = [15, 30, 45, 60, 90];

const formatCountdown = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatEndTime = (targetTimestamp: number) => {
  const date = new Date(targetTimestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

export function SleepTimerModal() {
  const { t } = useTranslation();
  const {
    state,
    isModalOpen,
    closeModal,
    setTimerMinutes,
    setTimerEndOfTrack,
    addMinutes,
    cancelTimer,
    setFadeOut,
  } = useSleepTimer();

  const { playerState } = useGlobalAudio();
  const { currentTrack } = playerState;

  const [selectedMinutes, setSelectedMinutes] = useState<number>(30);
  const [selectedMode, setSelectedMode] = useState<'minutes' | 'end_of_track'>('minutes');

  const calculatedEndTime = useMemo(() => {
    if (selectedMode !== 'minutes') return null;
    const target = Date.now() + selectedMinutes * 60 * 1000;
    return formatEndTime(target);
  }, [selectedMinutes, selectedMode]);

  if (!isModalOpen) return null;

  const handleStart = () => {
    if (selectedMode === 'end_of_track') {
      setTimerEndOfTrack();
    } else {
      setTimerMinutes(selectedMinutes);
    }
    closeModal();
  };

  const progressPercent = state.mode === 'time' && state.totalDurationSeconds > 0
    ? Math.max(0, Math.min(100, ((state.totalDurationSeconds - state.remainingSeconds) / state.totalDurationSeconds) * 100))
    : 0;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={closeModal}
    >
      <div
        className="bg-[#0c1626]/95 border border-white/10 rounded-3xl w-full max-w-md shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col backdrop-blur-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient subtle glow */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06] relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-indigo-500/10 border border-primary/30 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(0,245,255,0.25)]">
              <Moon size={20} className={state.isActive ? 'animate-pulse text-primary' : ''} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white font-display tracking-tight flex items-center gap-2">
                {t('sleepTimer.title', 'Hẹn giờ tắt nhạc')}
                {state.isActive && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-semibold animate-pulse">
                    {t('sleepTimer.activeBadge', 'Đang chạy')}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400 font-sans">
                {state.isActive
                  ? t('sleepTimer.runningSubtitle', 'Nhạc sẽ tự động dừng theo thời gian bên dưới')
                  : t('sleepTimer.subtitle', 'Tự động dừng phát nhạc khi đến giờ')}
              </p>
            </div>
          </div>
          <button
            onClick={closeModal}
            className="text-slate-400 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/[0.05]"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-5 overflow-y-auto max-h-[75vh] no-scrollbar relative z-10">
          {state.isActive ? (
            /* ACTIVE TIMER VIEW */
            <div className="flex flex-col items-center gap-5 py-2">
              {state.mode === 'time' ? (
                <>
                  <div className="relative flex flex-col items-center justify-center w-48 h-48 rounded-full border border-primary/25 bg-gradient-to-b from-primary/10 via-[#0c1626] to-[#08111e] shadow-[0_0_35px_rgba(0,245,255,0.2)]">
                    {/* Pulsing ring */}
                    <div className="absolute inset-2 rounded-full border border-white/5 pointer-events-none" />
                    
                    <span className="text-3xl sm:text-4xl font-extrabold font-mono text-primary drop-shadow-[0_0_12px_rgba(0,245,255,0.6)] tracking-wider">
                      {formatCountdown(state.remainingSeconds)}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400 mt-1 flex items-center gap-1">
                      <Clock size={12} className="text-primary/70" />
                      {state.targetTimestamp ? `${t('sleepTimer.stopsAt', 'Dừng lúc')} ${formatEndTime(state.targetTimestamp)}` : ''}
                    </span>

                    {/* Circular progress highlight indicator */}
                    <div className="absolute bottom-4 inset-x-0 flex justify-center">
                      <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-primary rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(0,245,255,0.6)]"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Extension Buttons */}
                  <div className="flex items-center gap-2 w-full justify-center">
                    <button
                      onClick={() => addMinutes(5)}
                      className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-slate-200 hover:text-white border border-white/[0.08] transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                    >
                      <Plus size={13} className="text-primary" />
                      <span>{t('sleepTimer.add5Min', '+5 phút')}</span>
                    </button>
                    <button
                      onClick={() => addMinutes(15)}
                      className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-slate-200 hover:text-white border border-white/[0.08] transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                    >
                      <Plus size={13} className="text-primary" />
                      <span>{t('sleepTimer.add15Min', '+15 phút')}</span>
                    </button>
                    <button
                      onClick={() => addMinutes(30)}
                      className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-slate-200 hover:text-white border border-white/[0.08] transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                    >
                      <Plus size={13} className="text-primary" />
                      <span>{t('sleepTimer.add30Min', '+30 phút')}</span>
                    </button>
                  </div>
                </>
              ) : (
                /* Mode: End of Track */
                <div className="flex flex-col items-center gap-3 text-center p-6 rounded-2xl bg-white/[0.03] border border-primary/20 w-full shadow-[0_0_20px_rgba(0,245,255,0.1)]">
                  <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(0,245,255,0.3)]">
                    <Disc size={28} className="animate-spin-slow" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">
                      {t('sleepTimer.endOfTrackActiveTitle', 'Dừng khi hết bài hát hiện tại')}
                    </h4>
                    <p className="text-xs text-slate-400 font-mono truncate max-w-xs">
                      {currentTrack?.title || currentTrack?.fileName || t('nowPlaying.thisTrack', 'Bài hát đang phát')}
                    </p>
                  </div>
                </div>
              )}

              {/* Fade Out Toggle */}
              <div className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <Volume2 size={16} className={state.fadeOut ? 'text-primary' : 'text-slate-400'} />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-200">
                      {t('sleepTimer.fadeOutTitle', 'Giảm dần âm lượng')}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {t('sleepTimer.fadeOutDesc', 'Hạ âm lượng trong 30s cuối')}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFadeOut(!state.fadeOut)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                    state.fadeOut ? 'bg-primary shadow-[0_0_10px_rgba(0,245,255,0.4)]' : 'bg-slate-700'
                  }`}
                  aria-label="Toggle Fade Out"
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      state.fadeOut ? 'translate-x-5 shadow-md' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Cancel Button */}
              <button
                onClick={() => {
                  cancelTimer();
                  closeModal();
                }}
                className="w-full py-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 font-bold text-xs border border-red-500/30 transition-all active:scale-[0.98]"
              >
                {t('sleepTimer.cancel', 'Hủy hẹn giờ tắt nhạc')}
              </button>
            </div>
          ) : (
            /* INACTIVE / SETUP VIEW */
            <>
              {/* Preset Chips */}
              <div className="flex flex-col gap-2">
                <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                  {t('sleepTimer.presets', 'Thời gian đặt sẵn')}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_MINUTES.map((m) => {
                    const isSelected = selectedMode === 'minutes' && selectedMinutes === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setSelectedMode('minutes');
                          setSelectedMinutes(m);
                        }}
                        className={`py-2.5 px-3 rounded-xl font-mono text-xs font-semibold transition-all duration-200 border flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-primary/20 text-primary border-primary/40 shadow-[0_0_12px_rgba(0,245,255,0.25)] scale-[1.02]'
                            : 'bg-white/[0.03] text-slate-300 border-white/[0.06] hover:bg-white/[0.07] hover:text-white'
                        }`}
                      >
                        {isSelected && <Check size={12} className="text-primary" />}
                        <span>{m} {t('sleepTimer.minShort', 'phút')}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setSelectedMode('end_of_track')}
                    className={`py-2.5 px-3 rounded-xl font-mono text-xs font-semibold transition-all duration-200 border col-span-3 flex items-center justify-center gap-2 ${
                      selectedMode === 'end_of_track'
                        ? 'bg-primary/20 text-primary border-primary/40 shadow-[0_0_12px_rgba(0,245,255,0.25)] scale-[1.01]'
                        : 'bg-white/[0.03] text-slate-300 border-white/[0.06] hover:bg-white/[0.07] hover:text-white'
                    }`}
                  >
                    <Disc size={14} className={selectedMode === 'end_of_track' ? 'text-primary animate-spin-slow' : 'text-slate-400'} />
                    <span>{t('sleepTimer.endOfTrack', 'Hết bài hát hiện tại')}</span>
                  </button>
                </div>
              </div>

              {/* Custom Duration Slider (only in minutes mode) */}
              {selectedMode === 'minutes' && (
                <div className="flex flex-col gap-2.5 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock size={13} className="text-primary" />
                      {t('sleepTimer.customDuration', 'Tùy chỉnh thời gian')}
                    </span>
                    <span className="text-xs font-mono font-bold text-primary">
                      {selectedMinutes} {t('sleepTimer.minutes', 'phút')}
                      {calculatedEndTime && (
                        <span className="text-slate-400 font-normal ml-1.5">
                          ({t('sleepTimer.stopsAt', 'Dừng lúc')} {calculatedEndTime})
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedMinutes(prev => Math.max(1, prev - 5))}
                      className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-white/[0.06]"
                      aria-label="Decrease 5 minutes"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="range"
                      min="1"
                      max="180"
                      step="1"
                      value={selectedMinutes}
                      onChange={(e) => setSelectedMinutes(Number(e.target.value))}
                      className="flex-1 accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedMinutes(prev => Math.min(180, prev + 5))}
                      className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-white/[0.06]"
                      aria-label="Increase 5 minutes"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* Smooth Fade Out Switch */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center gap-3 pr-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                    <Volume2 size={16} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      {t('sleepTimer.fadeOutTitle', 'Giảm dần âm lượng')}
                      <Sparkles size={12} className="text-cyan-400" />
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {t('sleepTimer.fadeOutDesc', 'Hạ âm lượng từ từ trong 30 giây cuối để ngủ êm ái')}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFadeOut(!state.fadeOut)}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center p-0.5 shrink-0 ${
                    state.fadeOut ? 'bg-primary shadow-[0_0_10px_rgba(0,245,255,0.4)]' : 'bg-slate-700'
                  }`}
                  aria-label="Toggle Fade Out"
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      state.fadeOut ? 'translate-x-5 shadow-md' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Start Button */}
              <button
                type="button"
                onClick={handleStart}
                className="w-full py-3.5 rounded-2xl bg-primary text-slate-950 font-bold text-xs font-sans shadow-[0_0_20px_rgba(0,245,255,0.4)] hover:shadow-[0_0_28px_rgba(0,245,255,0.6)] hover:scale-[1.01] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-1"
              >
                <Moon size={16} />
                <span>
                  {selectedMode === 'end_of_track'
                    ? t('sleepTimer.startEndOfTrack', 'Hẹn giờ: Hết bài hát')
                    : `${t('sleepTimer.startTimer', 'Bắt đầu hẹn giờ')} (${selectedMinutes} ${t('sleepTimer.minShort', 'phút')})`
                  }
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
