import { HorizontalSlider } from '../HorizontalSlider';
import { useGlobalAudio } from '../../context/AudioContext';
import { useTranslation } from 'react-i18next';
import { AudioEffectPanel, EffectControlsGate, EffectPowerButton } from './AudioEffectPanel';
import { STEREO_WIDTH_MAX_PERCENT } from '../../hooks/audioMath';

export function SpatialEffects() {
  const { playerState } = useGlobalAudio();
  const { t } = useTranslation();

  const stereoWetFactor = (playerState.stereoWidth / 100).toFixed(1);
  const reverbWetFactor = (playerState.reverbMix / 100).toFixed(1);
  const reverbDryFactor = (1 - playerState.reverbMix / 100).toFixed(1);

  return (
    <div className="flex flex-col gap-8 w-full">
      
      <AudioEffectPanel
        title={t('studio.spatial.reverbTitle', 'Reverb FX')}
        description={
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1">
            <span>{t('studio.spatial.reverbDesc', 'Add space and depth using Convolution Reverb.')}</span>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono font-medium shrink-0 self-start sm:self-auto">
              <span className="text-white/60">Dry:</span>
              <span className="text-[#00f5ff] font-semibold">{reverbDryFactor}</span>
              <span className="text-white/20">|</span>
              <span className="text-white/60">Wet:</span>
              <span className="text-[#ff00ff] font-bold">{reverbWetFactor}</span>
            </div>
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
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono font-medium shrink-0 self-start sm:self-auto">
              <span className="text-white/60">{t('studio.spatial.dryLabel', 'Dry (Mid)')}:</span>
              <span className="text-[#00f5ff] font-semibold">1.0</span>
              <span className="text-white/20">|</span>
              <span className="text-white/60">{t('studio.spatial.wetLabel', 'Wet (Side)')}:</span>
              <span className="text-[#9d00ff] font-bold">{stereoWetFactor}</span>
            </div>
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
        <EffectControlsGate active={playerState.fxEnabled.stereo}>
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
        </EffectControlsGate>
      </AudioEffectPanel>

    </div>
  );
}
