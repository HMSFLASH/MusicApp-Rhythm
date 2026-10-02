import { HorizontalSlider } from '../HorizontalSlider';
import { RangeSlider } from '../RangeSlider';
import { useGlobalAudio } from '../../context/AudioContext';
import { useTranslation } from 'react-i18next';
import { AudioEffectPanel, EffectControlsGate, EffectPowerButton } from './AudioEffectPanel';
import { AudioSelectRow } from './AudioSelectRow';
import { AudioToggleRow } from './AudioToggleRow';
import {
  STEREO_WIDTH_MAX_PERCENT,
  SURROUND_WET_MAX_PERCENT,
  SURROUND_DELAY_DEFAULT_MS,
  SURROUND_DELAY_MIN_MS,
  SURROUND_DELAY_MAX_MS,
} from '../../hooks/audioMath';
import type { SpeakerMode } from '../../hooks/audioGraph';

export function SpatialEffects() {
  const { playerState } = useGlobalAudio();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6 md:gap-8 w-full">

      <AudioEffectPanel
        title={t('studio.spatial.reverbTitle', 'Reverb FX')}
        description={
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
            <span>{t('studio.spatial.reverbDesc', 'Add space and depth using Convolution Reverb (10-direction 3D Early Reflections & 360° Diffuse Tail).')}</span>
          </div>
        }
        leading={(
          <EffectPowerButton
            active={playerState.fxEnabled.reverb}
            onClick={() => playerState.toggleFx('reverb')}
            activeClassName="bg-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)] border border-purple-500/40"
          />
        )}
      >
        <EffectControlsGate active={playerState.fxEnabled.reverb} className="flex flex-col gap-8">
          <HorizontalSlider
            value={playerState.reverbMix}
            min={0}
            max={100}
            onChange={playerState.updateReverbMix}
            label={t('studio.spatial.reverbMix', 'Reverb Mix')}
            color="#c084fc"
            unit="%"
          />
          <HorizontalSlider
            value={playerState.reverbTime}
            min={0.1}
            max={10}
            step={0.1}
            onChange={playerState.updateReverbTime}
            label={t('studio.spatial.roomSize', 'Room Size')}
            color="#c084fc"
            unit="s"
          />
        </EffectControlsGate>
      </AudioEffectPanel>

      <AudioEffectPanel
        title={t('studio.spatial.stereoTitle', 'Stereo & 3D Spatializer')}
        description={
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
            <span>{t('studio.spatial.stereoDesc', 'Widen your soundstage using Mid/Side processing, 3D differential diffusion, and phase-safe acoustic networks.')}</span>
          </div>
        }
        trailing={(
          <EffectPowerButton
            size="lg"
            active={playerState.fxEnabled.stereo}
            onClick={() => playerState.toggleFx('stereo')}
            activeClassName="bg-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)] border border-indigo-500/40"
          />
        )}
      >
        <EffectControlsGate active={playerState.fxEnabled.stereo} className="flex flex-col gap-6">
          {/* Stereo Width */}
          <HorizontalSlider
            value={playerState.stereoWidth}
            min={0}
            max={STEREO_WIDTH_MAX_PERCENT}
            step={1}
            onChange={playerState.updateStereoWidth}
            label={t('studio.spatial.stereoWidth', 'Stereo Width')}
            color="#818cf8"
            unit="%"
          />

          {/* Speaker Mode Selection */}
          <div className="flex flex-col gap-2">
            <AudioSelectRow<SpeakerMode>
              title={t('studio.spatial.speakerModeTitle', 'Chế Độ Loa (Speaker Mode)')}
              description={t('studio.spatial.speakerModeDesc', 'Tối ưu hóa âm hình cho hệ thống loa nghe nhạc của bạn.')}
              value={playerState.speakerMode || 'stereo'}
              options={[
                { label: t('studio.spatial.speakerStereo', 'Stereo (2 Loa)'), value: 'stereo' },
                { label: t('studio.spatial.speakerPhaseSafeMono', 'Phase-Safe Mono (1 Loa Thông Minh - Chống Triệt Pha)'), value: 'phase-safe-mono' },
                { label: t('studio.spatial.speakerMonoSum', 'Mono Sum (1 Loa Tiêu Chuẩn - L+R)'), value: 'mono-sum' },
              ]}
              onChange={(val) => playerState.updateSpeakerMode(val)}
            />
            {playerState.speakerMode === 'phase-safe-mono' && (
              <p className="text-[11px] text-amber-300/90 leading-relaxed bg-amber-500/10 border border-amber-500/25 p-3 rounded-xl font-mono">
                💡 {t('studio.spatial.speakerModeHelp', 'Chế độ 1 Loa Thông Minh dùng mạng dịch pha 90° (Hilbert Allpass), giúp giữ nguyên vẹn âm thanh nổi và chi tiết nhạc cụ trên 1 loa mà không bị triệt tiêu âm thanh.')}
              </p>
            )}
          </div>

          {/* 3D Surround Spatializer controls */}
          <div className="flex flex-col gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-mono font-bold text-sky-300 uppercase tracking-wider">
                {t('studio.spatial.surroundTitle', 'Âm Vòm 3D (Surround Spatializer)')}
              </span>
              <p className="text-[11px] text-slate-400 leading-tight">
                {t('studio.spatial.surroundDesc', 'Mạng trễ khuếch tán All-pass & 4 luồng phản xạ phi điều hòa với suy hao không khí (Air Damping). Tự động triệt tiêu 100% khi gập mono.')}
              </p>
            </div>

            <HorizontalSlider
              value={playerState.surroundWet ?? 14}
              min={0}
              max={SURROUND_WET_MAX_PERCENT}
              step={1}
              onChange={playerState.updateSurroundWet}
              label={t('studio.spatial.surroundWet', 'Độ Sâu Âm Vòm (Wet)')}
              color="#38bdf8"
              unit="%"
            />

            <HorizontalSlider
              value={playerState.surroundDelay ?? SURROUND_DELAY_DEFAULT_MS}
              min={SURROUND_DELAY_MIN_MS}
              max={SURROUND_DELAY_MAX_MS}
              step={1}
              onChange={playerState.updateSurroundDelay}
              label={t('studio.spatial.surroundDelay', 'Độ Trễ Cơ Sở (Delay)')}
              color="#38bdf8"
              unit="ms"
            />
          </div>

          {/* Chorus Ensemble Toggle */}
          <AudioToggleRow
            title={t('studio.spatial.chorusTitle', 'Chorus (Micro-Delay Ensemble)')}
            description={t('studio.spatial.chorusDesc', 'Làm dày và tạo độ lộng lẫy long lanh cho âm thanh bằng trễ vi mô điều chế trực giao. An toàn tuyệt đối cho Mono.')}
            checked={Boolean(playerState.chorusEnabled)}
            onToggle={playerState.toggleChorus}
          />

          {/* Crossover Range Controls */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                {t('studio.spatial.crossoverRange', 'Crossover Range')}
              </span>
              <button
                onClick={() => playerState.updateStereoCrossoverMode(playerState.stereoCrossoverMode === 'inside' ? 'outside' : 'inside')}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-md border transition-all cursor-pointer ${
                  playerState.stereoCrossoverMode === 'inside' 
                  ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40 shadow-[0_0_10px_rgba(99,102,241,0.2)]' 
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                }`}
              >
                {playerState.stereoCrossoverMode === 'inside' ? t('studio.spatial.crossoverInside', 'INSIDE') : t('studio.spatial.crossoverOutside', 'OUTSIDE')}
              </button>
            </div>
            <RangeSlider
              value={[playerState.stereoCrossoverLow, playerState.stereoCrossoverHigh]}
              min={20}
              max={20000}
              onChange={(val) => {
                playerState.updateStereoCrossoverLow(val[0]);
                playerState.updateStereoCrossoverHigh(val[1]);
              }}
              label=""
              color={playerState.stereoCrossoverMode === 'inside' ? '#818cf8' : '#fb7185'}
              unit="Hz"
              mode={playerState.stereoCrossoverMode}
              isLogarithmic={true}
            />
            <p className="text-[11px] text-slate-400 leading-tight">
              {playerState.stereoCrossoverMode === 'inside' 
                ? t('studio.spatial.stereoInsideDesc', 'Stereo Imager will ONLY affect frequencies INSIDE this range (using Transient-Perfect filtering with 0dB crossover dip).')
                : t('studio.spatial.stereoOutsideDesc', 'Stereo Imager will ONLY affect frequencies OUTSIDE this range (e.g. keeping bass and highs wide but mids narrow).')
              }
            </p>
          </div>
        </EffectControlsGate>
      </AudioEffectPanel>

    </div>
  );
}

