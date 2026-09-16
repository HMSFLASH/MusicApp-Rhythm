import { HorizontalSlider } from '../HorizontalSlider';
import { RangeSlider } from '../RangeSlider';
import { useGlobalAudio } from '../../context/AudioContext';
import { useTranslation } from 'react-i18next';
import { AudioEffectPanel, EffectControlsGate, EffectPowerButton } from './AudioEffectPanel';
import { STEREO_WIDTH_MAX_PERCENT } from '../../hooks/audioMath';

export function SpatialEffects() {
  const { playerState } = useGlobalAudio();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6 md:gap-8 w-full">

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
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                {t('studio.spatial.crossoverRange', 'Crossover Range')}
              </span>
              <button
                onClick={() => playerState.updateStereoCrossoverMode(playerState.stereoCrossoverMode === 'inside' ? 'outside' : 'inside')}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-md border transition-all ${
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
                ? t('studio.spatial.stereoInsideDesc', 'Stereo Imager will ONLY affect frequencies INSIDE this range. Frequencies outside will remain unchanged.')
                : t('studio.spatial.stereoOutsideDesc', 'Stereo Imager will ONLY affect frequencies OUTSIDE this range (e.g. keeping bass and highs wide but mids narrow).')
              }
            </p>
          </div>
        </EffectControlsGate>
      </AudioEffectPanel>

    </div>
  );
}
