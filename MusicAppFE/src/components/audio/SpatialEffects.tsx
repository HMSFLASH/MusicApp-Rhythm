import { HorizontalSlider } from '../HorizontalSlider';
import { useGlobalAudio } from '../../context/AudioContext';
import { useTranslation } from 'react-i18next';
import { AudioEffectPanel, EffectControlsGate, EffectPowerButton } from './AudioEffectPanel';
import { STEREO_WIDTH_MAX_PERCENT } from '../../hooks/audioMath';
import { reverbWetGain } from '../../hooks/audioGraph';

function SpatialSignalRouting() {
  const { playerState } = useGlobalAudio();
  const { t } = useTranslation();

  const reverbWet = playerState.fxEnabled.reverb ? reverbWetGain(playerState.reverbMix) : 0;
  const reverbDry = 1.0;
  const stereoWet = playerState.fxEnabled.stereo ? (playerState.stereoWidth / 100) : 1.0;

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl bg-white/5 border border-white/10 w-full">
      <div className="flex flex-col">
        <span className="text-white/90 font-semibold">{t('studio.spatial.routingTitle', 'Spatial Signal Routing Monitor')}</span>
        <span className="text-white/50 text-xs mt-0.5">{t('studio.spatial.routingDesc', 'Real-time calculation of actual output gain factors')}</span>
      </div>
      <div className="flex flex-wrap gap-4 mt-2">
        {/* Reverb Monitor */}
        <div className={`flex flex-col flex-1 min-w-[200px] bg-black/40 rounded-lg p-3 border transition-all duration-300 ${playerState.fxEnabled.reverb ? 'border-[#ff00ff]/40 shadow-[0_0_15px_rgba(255,0,255,0.1)]' : 'border-white/10 opacity-50 grayscale'}`}>
          <span className="text-white/70 text-xs font-medium mb-2">{t('studio.spatial.reverbGain', 'Reverb Gain')}</span>
          <div className="flex items-center justify-between font-mono text-sm">
            <span className="text-white/60">Dry: <span className="text-[#00f5ff] font-semibold">{reverbDry.toFixed(2)}</span></span>
            <span className="text-white/20">|</span>
            <span className="text-white/60">Wet: <span className="text-[#ff00ff] font-bold">{reverbWet.toFixed(2)}</span></span>
          </div>
        </div>
        
        {/* Stereo Monitor */}
        <div className={`flex flex-col flex-1 min-w-[200px] bg-black/40 rounded-lg p-3 border transition-all duration-300 ${playerState.fxEnabled.stereo ? 'border-[#9d00ff]/40 shadow-[0_0_15px_rgba(157,0,255,0.1)]' : 'border-white/10 opacity-50 grayscale'}`}>
          <span className="text-white/70 text-xs font-medium mb-2">{t('studio.spatial.stereoGain', 'Stereo Gain Matrix')}</span>
          <div className="flex items-center justify-between font-mono text-sm">
            <span className="text-white/60">Mid: <span className="text-[#00f5ff] font-semibold">1.00</span></span>
            <span className="text-white/20">|</span>
            <span className="text-white/60">Side: <span className="text-[#9d00ff] font-bold">{stereoWet.toFixed(2)}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SpatialEffects() {
  const { playerState } = useGlobalAudio();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8 w-full">
      
      <SpatialSignalRouting />

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
