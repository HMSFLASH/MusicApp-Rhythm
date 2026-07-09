import { RotateCcw, Wand2 } from 'lucide-react';
import { HorizontalSlider } from '../HorizontalSlider';
import { useGlobalAudio } from '../../context/AudioContext';
import { useTranslation } from 'react-i18next';
import { EffectControlsGate, EffectPowerButton } from './AudioEffectPanel';

export function DynamicsRack() {
  const { playerState } = useGlobalAudio();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8 w-full">
      
      {/* Dynamics Compressor */}
      <div className="bg-[#0a0a0a] p-8 rounded-2xl border border-white/5 shadow-2xl flex flex-col gap-10">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold font-sans text-white/80 tracking-tight">{t('studio.dynamics.title', 'Compressor / Night Mode')}</h2>
            <p className="text-secondary/60 text-xs font-mono mt-1">{t('studio.dynamics.desc', 'Controls dynamic range separately from loudness normalization.')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button aria-label="Action"
              onClick={playerState.applyDefaultCompressor}
              title={t('studio.dynamics.defaultTitle', 'Apply recommended compressor settings')}
              className="flex h-10 items-center gap-2 rounded-md border border-[#ff0055]/30 bg-[#ff0055]/10 px-3 text-sm font-medium text-[#ff4f88] transition-colors hover:bg-[#ff0055]/20"
            >
              <Wand2 size={16} />
              {t('studio.dynamics.defaultButton', 'Default')}
            </button>
            <button aria-label="Action"
              onClick={playerState.resetCompressor}
              title={t('studio.dynamics.resetTitle', 'Reset compressor to neutral settings')}
              className="flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm font-medium text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <RotateCcw size={16} />
              {t('studio.dynamics.resetButton', 'Reset')}
            </button>
            <EffectPowerButton
              size="lg"
              active={playerState.fxEnabled.comp}
              onClick={() => playerState.toggleFx('comp')}
              activeClassName="bg-[#ff0055]/20 text-[#ff0055] shadow-[0_0_15px_rgba(255,0,85,0.4)]"
            />
          </div>
        </div>

        <EffectControlsGate active={playerState.fxEnabled.comp} className="flex flex-col gap-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <HorizontalSlider
              value={playerState.compThreshold}
              min={-100}
              max={0}
              onChange={playerState.updateCompThreshold}
              label={t('studio.dynamics.threshold', 'Threshold')}
              color="#ff0055"
              unit="dB"
            />
            <HorizontalSlider
              value={playerState.compRatio}
              min={1}
              max={20}
              onChange={playerState.updateCompRatio}
              label={t('studio.dynamics.ratio', 'Ratio')}
              color="#ff0055"
              unit=":1"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <HorizontalSlider
              value={playerState.compKnee}
              min={0}
              max={40}
              onChange={playerState.updateCompKnee}
              label={t('studio.dynamics.knee', 'Knee')}
              color="#ff9900"
              unit="dB"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-6 border-t border-white/10">
            <HorizontalSlider
              value={playerState.compAttack}
              min={0}
              max={1000}
              onChange={playerState.updateCompAttack}
              label={t('studio.dynamics.attack', 'Attack')}
              color="#00f5ff"
              unit="ms"
            />
            <HorizontalSlider
              value={playerState.compRelease}
              min={0}
              max={1000}
              onChange={playerState.updateCompRelease}
              label={t('studio.dynamics.release', 'Release')}
              color="#00f5ff"
              unit="ms"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-6 border-t border-white/10">
            <HorizontalSlider
              value={playerState.compRmsSize}
              min={1}
              max={250}
              onChange={playerState.updateCompRmsSize}
              label={t('studio.dynamics.rmsSize', 'RMS Size')}
              color="#a855f7"
              unit="ms"
            />
            <HorizontalSlider
              value={playerState.compMakeupGain}
              min={-20}
              max={20}
              step={0.1}
              onChange={playerState.updateCompMakeupGain}
              label={t('studio.dynamics.makeupGain', 'Make-up Gain')}
              color="#00ff00"
              unit="dB"
            />
          </div>
        </EffectControlsGate>
      </div>

      {/* Master Limiter */}
      <div className={`bg-[#0a0a0a] p-8 rounded-2xl border border-white/5 shadow-2xl flex items-center justify-between transition-opacity duration-300 ${playerState.fxEnabled.limiter ? 'opacity-100' : 'opacity-50'}`}>
        <div>
          <h2 className="text-xl font-bold font-sans text-white/80 tracking-tight">{t('studio.dynamics.limiterTitle', 'Anti-Clipping Master Limiter')}</h2>
          <p className="text-secondary/60 text-xs font-mono mt-2">{t('studio.dynamics.limiterDesc', 'Catches final output peaks after soft clipping, reducing crackling when EQ, preamp, or effects raise the level. Recommended to leave on.')}</p>
        </div>
        <EffectPowerButton
          size="lg"
          active={playerState.fxEnabled.limiter}
          onClick={() => playerState.toggleFx('limiter')}
          activeClassName="bg-[#00e5ff]/20 text-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.4)]"
        />
      </div>

    </div>
  );
}
