import { HorizontalSlider } from '../HorizontalSlider';
import { useGlobalAudio } from '../../context/AudioContext';
import { useTranslation } from 'react-i18next';
import { AudioEffectPanel, EffectControlsGate, EffectPowerButton } from './AudioEffectPanel';
import { STEREO_WIDTH_MAX_PERCENT } from '../../hooks/audioMath';

interface DryWetBadgeProps {
  dryLabel?: string;
  wetLabel?: string;
  dryValue: string | number;
  wetValue: string | number;
  dryColor?: string;
  wetColor?: string;
  active?: boolean;
  defaultDryValue?: string | number;
  defaultWetValue?: string | number;
}

function DryWetBadge({
  dryLabel = 'Dry',
  wetLabel = 'Wet',
  dryValue,
  wetValue,
  dryColor = '#00f5ff',
  wetColor = '#ff00ff',
  active = true,
  defaultDryValue = '1.0',
  defaultWetValue = '0.0'
}: DryWetBadgeProps) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono font-medium shrink-0 self-start sm:self-auto transition-opacity duration-300 ${!active ? 'opacity-50 grayscale' : ''}`}>
      <span className="text-white/60">{dryLabel}:</span>
      <span className="font-semibold" style={{ color: dryColor }}>{active ? dryValue : defaultDryValue}</span>
      <span className="text-white/20">|</span>
      <span className="text-white/60">{wetLabel}:</span>
      <span className="font-bold" style={{ color: wetColor }}>{active ? wetValue : defaultWetValue}</span>
    </div>
  );
}

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
            <DryWetBadge
              dryValue={reverbDryFactor}
              wetValue={reverbWetFactor}
              active={playerState.fxEnabled.reverb}
            />
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
            <DryWetBadge
              dryLabel={t('studio.spatial.dryLabel', 'Dry (Mid)')}
              wetLabel={t('studio.spatial.wetLabel', 'Wet (Side)')}
              dryValue="1.0"
              wetValue={stereoWetFactor}
              wetColor="#9d00ff"
              active={playerState.fxEnabled.stereo}
              defaultWetValue="1.0"
            />
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
