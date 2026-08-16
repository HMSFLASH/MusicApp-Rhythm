import { HorizontalSlider } from '../HorizontalSlider';
import { useGlobalAudio } from '../../context/AudioContext';
import { useTranslation } from 'react-i18next';
import { AudioEffectPanel, EffectControlsGate, EffectPowerButton } from './AudioEffectPanel';
import { AudioSelectRow } from './AudioSelectRow';
import { STEREO_WIDTH_MAX_PERCENT } from '../../hooks/audioMath';
import { reverbWetGain } from '../../hooks/audioGraph';

function SpatialSignalRouting({
  reverbMix,
  stereoWidth,
  reverbEnabled,
  stereoEnabled
}: {
  reverbMix: number;
  stereoWidth: number;
  reverbEnabled: boolean;
  stereoEnabled: boolean;
}) {
  const { t } = useTranslation();

  const reverbWet = reverbEnabled ? reverbWetGain(reverbMix) : 0;
  const stereoWet = stereoEnabled ? (stereoWidth / 100) : 1.0;
  
  // Total combined spatial field values
  const totalDry = 1.0;
  const totalWet = reverbWet + stereoWet;

  const isActive = reverbEnabled || stereoEnabled;

  return (
    <div className={`flex items-center justify-between p-4 sm:p-5 rounded-2xl border transition-all ${isActive ? 'bg-[#0c1626]/80 border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.15)]' : 'bg-white/[0.02] border-white/[0.06] opacity-60 grayscale'}`}>
      <div className="flex flex-col">
        <span className="text-slate-100 font-semibold text-sm">{t('studio.spatial.routingTitle', 'Spatial Output Balance')}</span>
        <span className="text-slate-400 text-xs font-mono mt-0.5">{t('studio.spatial.routingDesc', 'Total calculated spatial field')}</span>
      </div>
      <div className="flex items-center gap-3 font-mono text-xs sm:text-sm bg-white/[0.04] px-4 py-2 rounded-xl border border-white/[0.08]">
        <span className="text-slate-400">Dry: <span className="text-primary font-bold">{totalDry.toFixed(2)}</span></span>
        <span className="text-white/20">|</span>
        <span className="text-slate-400">Wet: <span className="text-purple-400 font-bold">{totalWet.toFixed(2)}</span></span>
      </div>
    </div>
  );
}

export function SpatialEffects() {
  const { playerState } = useGlobalAudio();
  const { t } = useTranslation();

  const stereoFftOptions = [
    { label: t('studio.spatial.fft256', '256 (Siêu thấp / Cực nhẹ)'), value: 256 },
    { label: t('studio.spatial.fft512', '512 (Thấp / Nhẹ)'), value: 512 },
    { label: t('studio.spatial.fft1024', '1024 (Tối ưu khuyên dùng)'), value: 1024 },
    { label: t('studio.spatial.fft2048', '2048 (Trung bình)'), value: 2048 },
    { label: t('studio.spatial.fft4096', '4096 (Cao)'), value: 4096 },
    { label: t('studio.spatial.fft8192', '8192 (Rất cao / Nặng CPU)'), value: 8192 },
    { label: t('studio.spatial.fft16384', '16384 (Tối đa / Cực nặng)'), value: 16384 },
  ];

  return (
    <div className="flex flex-col gap-6 md:gap-8 w-full">
      
      <SpatialSignalRouting
        reverbMix={playerState.reverbMix}
        stereoWidth={playerState.stereoWidth}
        reverbEnabled={playerState.fxEnabled.reverb}
        stereoEnabled={playerState.fxEnabled.stereo}
      />

      <AudioEffectPanel
        title={t('studio.spatial.reverbTitle', 'Reverb FX')}
        description={
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
            <span>{t('studio.spatial.reverbDesc', 'Add space and depth using Convolution Reverb.')}</span>
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
        title={t('studio.spatial.stereoTitle', 'Stereo Imager')}
        description={
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
            <span>{t('studio.spatial.stereoDesc', 'Widen your stereo image using Mid/Side processing. 100% is normal, up to 200% is extra wide.')}</span>
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
          <AudioSelectRow
            title={t('studio.spatial.stereoFftTitle', 'Độ phân giải phân tích Stereo (FFT Size)')}
            description={t('studio.spatial.stereoFftDesc', 'Tần số lấy mẫu phân tích tương quan kênh L/R. Mặc định 1024 cho độ mượt cao, có thể chỉnh lên 16384 hoặc giảm xuống 256.')}
            value={playerState.stereoFftSize || 1024}
            options={stereoFftOptions}
            onChange={playerState.updateStereoFftSize}
          />
        </EffectControlsGate>
      </AudioEffectPanel>

    </div>
  );
}
