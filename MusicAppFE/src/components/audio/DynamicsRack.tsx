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
      <div className="bg-[#0c1626]/80 p-4 sm:p-6 md:p-8 rounded-3xl border border-white/[0.08] shadow-[0_15px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl flex flex-col gap-6 md:gap-10">
        <div className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold font-display text-white tracking-tight">{t('studio.dynamics.title', 'Compressor / Night Mode')}</h2>
            <p className="text-slate-400 text-xs font-mono mt-1">{t('studio.dynamics.desc', 'Controls dynamic range separately from loudness normalization.')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button aria-label="Default Compressor Settings"
              onClick={playerState.applyDefaultCompressor}
              title={t('studio.dynamics.defaultTitle', 'Apply recommended compressor settings')}
              className="flex h-9 items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 text-xs font-bold text-rose-400 transition-all hover:bg-rose-500/20 active:scale-95 shadow-sm"
            >
              <Wand2 size={14} />
              {t('studio.dynamics.defaultButton', 'Default')}
            </button>
            <button aria-label="Reset Compressor"
              onClick={playerState.resetCompressor}
              title={t('studio.dynamics.resetTitle', 'Reset compressor to neutral settings')}
              className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 text-xs font-semibold text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white active:scale-95"
            >
              <RotateCcw size={14} />
              {t('studio.dynamics.resetButton', 'Reset')}
            </button>
            <EffectPowerButton
              size="lg"
              active={playerState.fxEnabled.comp}
              onClick={() => playerState.toggleFx('comp')}
              activeClassName="bg-rose-500/20 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.4)] border border-rose-500/40"
            />
          </div>
        </div>

        <EffectControlsGate active={playerState.fxEnabled.comp} className="flex flex-col gap-6 md:gap-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
            <HorizontalSlider
              value={playerState.compThreshold}
              min={-100}
              max={0}
              step={0.1}
              onChange={playerState.updateCompThreshold}
              label={t('studio.dynamics.threshold', 'Threshold')}
              color="#ff0055"
              unit="dB"
            />
            <HorizontalSlider
              value={playerState.compRatio}
              min={0.1}
              max={20}
              step={0.1}
              onChange={playerState.updateCompRatio}
              label={t('studio.dynamics.ratio', 'Ratio')}
              color="#ff0055"
              unit=":1"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12">
            <HorizontalSlider
              value={playerState.compKnee}
              min={0}
              max={40}
              step={0.1}
              onChange={playerState.updateCompKnee}
              label={t('studio.dynamics.knee', 'Knee')}
              color="#ff9900"
              unit="dB"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 pt-6 border-t border-white/10">
            <HorizontalSlider
              value={playerState.compAttack}
              min={0}
              max={1000}
              step={0.1}
              onChange={playerState.updateCompAttack}
              label={t('studio.dynamics.attack', 'Attack')}
              color="#00f5ff"
              unit="ms"
            />
            <HorizontalSlider
              value={playerState.compRelease}
              min={0}
              max={1000}
              step={0.1}
              onChange={playerState.updateCompRelease}
              label={t('studio.dynamics.release', 'Release')}
              color="#00f5ff"
              unit="ms"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 pt-6 border-t border-white/10">
            <HorizontalSlider
              value={playerState.compRmsSize}
              min={1}
              max={250}
              step={0.1}
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

    </div>
  );
}
