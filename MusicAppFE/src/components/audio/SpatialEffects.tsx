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
    <div className={`flex items-center justify-between p-4 rounded-xl border ${isActive ? 'bg-black/40 border-[#ff00ff]/30' : 'bg-white/5 border-white/10 opacity-60 grayscale'}`}>
      <div className="flex flex-col">
        <span className="text-white/90 font-semibold">{t('studio.spatial.routingTitle', 'Spatial Output Balance')}</span>
        <span className="text-white/50 text-xs mt-0.5">{t('studio.spatial.routingDesc', 'Total calculated spatial field')}</span>
      </div>
      <div className="flex items-center gap-3 font-mono text-sm bg-white/5 px-4 py-2 rounded-lg border border-white/5">
        <span className="text-white/60">Dry: <span className="text-[#00f5ff] font-semibold">{totalDry.toFixed(2)}</span></span>
        <span className="text-white/20">|</span>
        <span className="text-white/60">Wet: <span className="text-[#ff00ff] font-bold">{totalWet.toFixed(2)}</span></span>
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
    <div className="flex flex-col gap-8 w-full">
      
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
            activeClassName="bg-[#ff00ff]/20 text-[#ff00ff] shadow-[0_0_15px_rgba(255,0,255,0.4)]"
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
            color="#ff00ff"
            unit="%"
          />
          <HorizontalSlider
            value={playerState.reverbTime}
            min={0.1}
            max={10}
            step={0.1}
            onChange={playerState.updateReverbTime}
            label={t('studio.spatial.roomSize', 'Room Size')}
            color="#ff00ff"
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
            activeClassName="bg-[#9d00ff]/20 text-[#9d00ff] shadow-[0_0_15px_rgba(157,0,255,0.4)]"
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
            color="#9d00ff"
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
