import { useEffect, useState } from 'react';
import { Activity, RotateCcw, SlidersHorizontal, Wand2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { HorizontalSlider } from '../HorizontalSlider';
import { useGlobalAudio } from '../../context/AudioContext';
import { AudioEffectPanel, EffectControlsGate, EffectPowerButton } from './AudioEffectPanel';
import { AudioSelectRow } from './AudioSelectRow';
import { AudioToggleRow } from './AudioToggleRow';
import { BALANCER_OFFSET_MAX, BALANCER_OFFSET_MIN, clamp } from '../../hooks/audioMath';
import {
  getBalancerEffectiveParams,
  type BalancerMode,
  type BalancerTelemetry,
} from '../../hooks/audioTypes';

export function DynamicsRack() {
  const { playerState } = useGlobalAudio();
  const { t } = useTranslation();
  const [telemetry, setTelemetry] = useState<BalancerTelemetry | null>(null);

  const isBalancerEnabled = Boolean(playerState.fxEnabled.comp);
  const subscribeBalancerTelemetry = playerState.subscribeBalancerTelemetry;

  useEffect(() => {
    if (!isBalancerEnabled || typeof subscribeBalancerTelemetry !== 'function') {
      return;
    }

    return subscribeBalancerTelemetry((data: BalancerTelemetry) => {
      setTelemetry(data);
    });
  }, [isBalancerEnabled, subscribeBalancerTelemetry]);

  const activeTelemetry = isBalancerEnabled ? telemetry : null;

  const effective = getBalancerEffectiveParams({
    mode: playerState.balancerMode,
    offset: playerState.balancerOffset,
    targetDb: playerState.balancerTargetDb,
    deadzoneDb: playerState.balancerDeadzoneDb,
    upwardStrength: playerState.balancerUpwardStrength,
    downwardStrength: playerState.balancerDownwardStrength,
    maxUpwardDb: playerState.balancerMaxUpwardDb,
    maxDownwardDb: playerState.balancerMaxDownwardDb,
    speed: playerState.balancerSpeed,
    noiseFloorDb: playerState.balancerNoiseFloorDb,
    lookaheadMs: playerState.balancerLookaheadMs,
    ceilingDb: playerState.balancerCeilingDb,
    useKWeight: playerState.balancerUseKWeight,
  });

  const isSmartMode = playerState.balancerMode === 'smart';
  const smartTargetMin = clamp(-18 + playerState.balancerOffset, -40, -4);
  const smartTargetMax = clamp(-16 + playerState.balancerOffset, -40, -4);

  const modeLabelMap: Record<BalancerMode, string> = {
    normal: t('studio.dynamics.modeShortNormal', 'Normal'),
    music: t('studio.dynamics.modeShortMusic', 'Music'),
    smart: t('studio.dynamics.modeShortSmart', 'Smart Auto'),
    custom: t('studio.dynamics.modeShortCustom', 'Custom'),
  };

  const rmsDisplay = activeTelemetry && activeTelemetry.rmsDb > -119.5
    ? `${activeTelemetry.rmsDb.toFixed(1)} dB`
    : '-- dB';
  const gainDisplay = activeTelemetry
    ? `${activeTelemetry.currentGainDb >= 0 ? '+' : ''}${activeTelemetry.currentGainDb.toFixed(1)} dB`
    : '-- dB';
  const limiterGrDisplay = activeTelemetry && activeTelemetry.limGrDb > -119.5
    ? `${activeTelemetry.limGrDb.toFixed(1)} dB`
    : '0.0 dB';

  return (
    <div className="flex flex-col gap-8 w-full">
      <AudioEffectPanel
        title={t('studio.dynamics.title', 'Web Audio Balancer v2.1')}
        description={t('studio.dynamics.desc', '3-Stage Dynamics: K-Weighted RMS Leveler -> Peak Guard -> Lookahead Soft Limiter')}
        trailing={(
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label={t('studio.dynamics.resetTitle', 'Reset balancer to defaults')}
              onClick={playerState.resetBalancer}
              title={t('studio.dynamics.resetTitle', 'Reset balancer to defaults')}
              className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3.5 text-xs font-semibold text-slate-300 transition-all hover:bg-white/[0.08] hover:text-white active:scale-95 cursor-pointer"
            >
              <RotateCcw size={14} />
              {t('studio.dynamics.resetButton', 'Reset')}
            </button>
            <EffectPowerButton
              size="lg"
              active={isBalancerEnabled}
              onClick={() => playerState.toggleFx('comp')}
              activeClassName="bg-rose-500/20 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.4)] border border-rose-500/40"
            />
          </div>
        )}
      >
        <EffectControlsGate active={isBalancerEnabled} className="flex flex-col gap-6 md:gap-8">
          <AudioSelectRow<BalancerMode>
            title={t('studio.dynamics.modeTitle', 'Balancer Mode')}
            description={t('studio.dynamics.modeDesc', 'Select automatic loudness balancing mode or switch to Custom to fine-tune all parameters.')}
            value={playerState.balancerMode}
            options={[
              { label: t('studio.dynamics.modeNormal', 'Normal (Video / Voice)'), value: 'normal' },
              { label: t('studio.dynamics.modeMusic', 'Music (Preserve Dynamics)'), value: 'music' },
              { label: t('studio.dynamics.modeSmart', 'Smart Auto (Adaptive)'), value: 'smart' },
              { label: t('studio.dynamics.modeCustom', 'Custom (Manual Sliders)'), value: 'custom' },
            ]}
            onChange={(val) => playerState.updateBalancerMode(val)}
            zIndex={20}
          />

          <HorizontalSlider
            value={playerState.balancerOffset}
            min={BALANCER_OFFSET_MIN}
            max={BALANCER_OFFSET_MAX}
            step={0.5}
            onChange={playerState.updateBalancerOffset}
            label={t('studio.dynamics.offset', 'Loudness Offset')}
            color="#f43f5e"
            unit="dB"
          />

          {/* Active Parameters & Live Telemetry */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                <Activity size={14} className="text-rose-400 shrink-0" />
                <span>{t('studio.dynamics.telemetryTitle', 'Active Profile & Live Telemetry')}</span>
              </div>
              <div className="px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono text-slate-300">
                {t('studio.dynamics.modeLabel', 'Mode')}: {modeLabelMap[playerState.balancerMode]}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-[#09111e] border border-white/[0.05] flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400 uppercase">{t('studio.dynamics.statTarget', 'Target')}</span>
                <span className="text-slate-100 font-semibold">
                  {isSmartMode
                    ? `${smartTargetMin.toFixed(1)} .. ${smartTargetMax.toFixed(1)} dB`
                    : `${effective.targetDb.toFixed(1)} dB`}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#09111e] border border-white/[0.05] flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400 uppercase">{t('studio.dynamics.statDeadzoneGate', 'Dead Zone / Gate')}</span>
                <span className="text-slate-100 font-semibold">
                  {isSmartMode
                    ? `2.0..3.8 dB / ${activeTelemetry ? `${activeTelemetry.smartGateDb.toFixed(0)} dB` : '-56..-38 dB'}`
                    : `${effective.deadzoneDb.toFixed(1)} dB / ${effective.noiseFloorDb.toFixed(0)} dB`}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#09111e] border border-white/[0.05] flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400 uppercase">{t('studio.dynamics.statUpDown', 'Up / Down')}</span>
                <span className="text-slate-100 font-semibold">
                  {isSmartMode
                    ? '25-50% / 40-65%'
                    : `${effective.upwardStrength.toFixed(0)}% (+${effective.maxUpwardDb.toFixed(1)}) / ${effective.downwardStrength.toFixed(0)}% (${effective.maxDownwardDb.toFixed(1)})`}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#09111e] border border-white/[0.05] flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400 uppercase">{t('studio.dynamics.statTimingCeiling', 'Timing / Ceiling')}</span>
                <span className="text-slate-100 font-semibold">
                  {isSmartMode
                    ? `${effective.lookaheadMs.toFixed(1)}ms / ${effective.ceilingDb.toFixed(1)} dB`
                    : `${effective.rmsMs.toFixed(0)}ms / ${effective.ceilingDb.toFixed(1)} dB`}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-white/[0.06] text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-[#09111e] border border-white/[0.05] flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400 uppercase">{t('studio.dynamics.liveRms', 'Input RMS')}</span>
                <span className="text-cyan-300 font-bold">{rmsDisplay}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#09111e] border border-white/[0.05] flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400 uppercase">{t('studio.dynamics.liveGain', 'Leveler Gain')}</span>
                <span className="text-emerald-300 font-bold">{gainDisplay}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#09111e] border border-white/[0.05] flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400 uppercase">{t('studio.dynamics.liveGr', 'Limiter GR')}</span>
                <span className="text-amber-300 font-bold">{limiterGrDisplay}</span>
              </div>
            </div>
          </div>

          {/* Template Loader */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
              <Wand2 size={14} className="text-rose-400 shrink-0" />
              <span>{t('studio.dynamics.templatesTitle', 'Load Template into Custom')}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => playerState.applyBalancerTemplate('normal')}
                className="px-3.5 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-xs font-semibold text-slate-200 hover:bg-white/[0.08] hover:border-rose-500/40 transition-all cursor-pointer active:scale-95"
              >
                {t('studio.dynamics.templateNormal', 'Normal (Video / Voice)')}
              </button>
              <button
                type="button"
                onClick={() => playerState.applyBalancerTemplate('music')}
                className="px-3.5 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-xs font-semibold text-slate-200 hover:bg-white/[0.08] hover:border-rose-500/40 transition-all cursor-pointer active:scale-95"
              >
                {t('studio.dynamics.templateMusic', 'Music (Dynamic)')}
              </button>
              <button
                type="button"
                onClick={() => playerState.applyBalancerTemplate('night')}
                className="px-3.5 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] text-xs font-semibold text-slate-200 hover:bg-white/[0.08] hover:border-rose-500/40 transition-all cursor-pointer active:scale-95"
              >
                {t('studio.dynamics.templateNight', 'Night Mode')}
              </button>
            </div>
          </div>

          {/* Custom Parameter Controls */}
          {playerState.balancerMode === 'custom' ? (
            <div className="flex flex-col gap-6 md:gap-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
                <HorizontalSlider
                  value={playerState.balancerTargetDb}
                  min={-32}
                  max={-8}
                  step={0.5}
                  onChange={playerState.updateBalancerTargetDb}
                  label={t('studio.dynamics.targetDb', 'Target Level')}
                  color="#ff0055"
                  unit="dB"
                />
                <HorizontalSlider
                  value={playerState.balancerDeadzoneDb}
                  min={0}
                  max={8}
                  step={0.1}
                  onChange={playerState.updateBalancerDeadzoneDb}
                  label={t('studio.dynamics.deadzoneDb', 'Dead Zone')}
                  color="#ff9900"
                  unit="dB"
                />
                <HorizontalSlider
                  value={playerState.balancerNoiseFloorDb}
                  min={-80}
                  max={-25}
                  step={1}
                  onChange={playerState.updateBalancerNoiseFloorDb}
                  label={t('studio.dynamics.noiseFloorDb', 'Noise Gate')}
                  color="#a855f7"
                  unit="dB"
                />
                <HorizontalSlider
                  value={playerState.balancerCeilingDb}
                  min={-6}
                  max={-0.1}
                  step={0.1}
                  onChange={playerState.updateBalancerCeilingDb}
                  label={t('studio.dynamics.ceilingDb', 'Safety Ceiling')}
                  color="#f43f5e"
                  unit="dB"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 pt-6 border-t border-white/[0.06]">
                <HorizontalSlider
                  value={playerState.balancerUpwardStrength}
                  min={0}
                  max={100}
                  step={1}
                  onChange={playerState.updateBalancerUpwardStrength}
                  label={t('studio.dynamics.upwardStrength', 'Upward Strength')}
                  color="#10b981"
                  unit="%"
                />
                <HorizontalSlider
                  value={playerState.balancerDownwardStrength}
                  min={0}
                  max={100}
                  step={1}
                  onChange={playerState.updateBalancerDownwardStrength}
                  label={t('studio.dynamics.downwardStrength', 'Downward Strength')}
                  color="#38bdf8"
                  unit="%"
                />
                <HorizontalSlider
                  value={playerState.balancerMaxUpwardDb}
                  min={0}
                  max={20}
                  step={0.5}
                  onChange={playerState.updateBalancerMaxUpwardDb}
                  label={t('studio.dynamics.maxUpwardDb', 'Max Upward Gain')}
                  color="#10b981"
                  unit="dB"
                />
                <HorizontalSlider
                  value={playerState.balancerMaxDownwardDb}
                  min={-30}
                  max={0}
                  step={0.5}
                  onChange={playerState.updateBalancerMaxDownwardDb}
                  label={t('studio.dynamics.maxDownwardDb', 'Max Downward Reduction')}
                  color="#38bdf8"
                  unit="dB"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 pt-6 border-t border-white/[0.06]">
                <HorizontalSlider
                  value={playerState.balancerSpeed}
                  min={0}
                  max={100}
                  step={1}
                  onChange={playerState.updateBalancerSpeed}
                  label={t('studio.dynamics.speed', 'Response Speed (0=Fast, 100=Smooth)')}
                  color="#00f5ff"
                  unit="%"
                />
                <HorizontalSlider
                  value={playerState.balancerLookaheadMs}
                  min={1}
                  max={10}
                  step={0.5}
                  onChange={playerState.updateBalancerLookaheadMs}
                  label={t('studio.dynamics.lookaheadMs', 'Lookahead Limiter')}
                  color="#00f5ff"
                  unit="ms"
                />
              </div>

              <AudioToggleRow
                title={t('studio.dynamics.kWeightTitle', 'K-Weighting Perceptual Filter')}
                description={t('studio.dynamics.kWeightDesc', 'Applies ITU-R BS.1770 K-Weighting (+4 dB high-shelf & 75 Hz high-pass) to measure perceived loudness instead of raw RMS.')}
                checked={Boolean(playerState.balancerUseKWeight)}
                onToggle={playerState.toggleBalancerKWeight}
              />
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] p-3.5 text-xs font-mono text-slate-400">
              <SlidersHorizontal size={15} className="shrink-0 mt-0.5 text-slate-300" />
              <span>
                {t('studio.dynamics.customHint', 'Switch mode to Custom or pick a template above to fine-tune all 11 parameters.')}
              </span>
            </div>
          )}
        </EffectControlsGate>
      </AudioEffectPanel>
    </div>
  );
}
