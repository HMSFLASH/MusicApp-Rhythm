import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, ChevronDown, X, Edit2, Trash2, Info, CircleDot, Sliders } from 'lucide-react';
import { VerticalFader } from '../VerticalFader';
import { EQ_PRESETS, STYLISTIC_PRESETS } from '../../hooks/useAudioPlayer';
import type { CustomEqPreset, EqBand } from '../../hooks/audioTypes';
import { useGlobalAudio } from '../../context/AudioContext';
import { useTranslation } from 'react-i18next';
import { EffectPowerButton } from './AudioEffectPanel';
import { NumberInput } from '../NumberInput';
import { createEqResponseChartData, type EqResponsePoint } from '../../hooks/audioEqResponse';

import type { FitResult } from '../../utils/eqFitting';

const formatFreq = (f: number) => {
  if (f >= 1000) return (f / 1000) + 'k';
  return f.toString();
};

const presetHasParametricBandSettings = (preset?: CustomEqPreset) =>
  preset?.bands.some(band => (
    (band.type || 'peaking') !== 'peaking' || band.channel !== 'L+R'
  ));

const isSavedParametricPreset = (preset?: CustomEqPreset) =>
  preset?.presetMode === 'parametric'
  || (preset?.isCustomOrigin && presetHasParametricBandSettings(preset));

const GRAPH_WIDTH = 760;
const GRAPH_HEIGHT = 320;
const GRAPH_PADDING = { top: 22, right: 20, bottom: 38, left: 48 };
const GRAPH_MIN_FREQ = 20;
const GRAPH_MAX_FREQ = 20000;
const GRAPH_MIN_DB = -24;
const GRAPH_MAX_DB = 24;
const GRAPH_FREQ_TICKS = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const GRAPH_DB_TICKS = [-24, -12, 0, 12, 24];

const graphInnerWidth = GRAPH_WIDTH - GRAPH_PADDING.left - GRAPH_PADDING.right;
const graphInnerHeight = GRAPH_HEIGHT - GRAPH_PADDING.top - GRAPH_PADDING.bottom;

const formatGraphFreq = (frequency: number) => {
  if (frequency >= 1000) return `${frequency / 1000}k`;
  return String(frequency);
};

const getGraphX = (frequency: number) => {
  const ratio = Math.log10(frequency / GRAPH_MIN_FREQ) / Math.log10(GRAPH_MAX_FREQ / GRAPH_MIN_FREQ);
  return GRAPH_PADDING.left + ratio * graphInnerWidth;
};

const getGraphY = (db: number) => {
  const clamped = Math.max(GRAPH_MIN_DB, Math.min(GRAPH_MAX_DB, db));
  const ratio = (GRAPH_MAX_DB - clamped) / (GRAPH_MAX_DB - GRAPH_MIN_DB);
  return GRAPH_PADDING.top + ratio * graphInnerHeight;
};

const responsePath = (points: EqResponsePoint[]) =>
  points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${getGraphX(point.frequency).toFixed(2)} ${getGraphY(point.db).toFixed(2)}`)
    .join(' ');

const eqPointColor = (channel: EqBand['channel']) => {
  if (channel === 'L') return '#60a5fa';
  if (channel === 'R') return '#f87171';
  return '#22d3ee';
};

function EqResponseModal({
  bands,
  enabled,
  preampGain = 0,
  bassGain = 0,
  trebleGain = 0,
  eqResponseData,
  effectsEnabled,
  isParametricPreset,
  onClose,
}: {
  bands: EqBand[];
  enabled: boolean;
  preampGain?: number;
  bassGain?: number;
  trebleGain?: number;
  eqResponseData?: FitResult | null;
  effectsEnabled?: { eq?: boolean; tone?: boolean; preamp?: boolean };
  isParametricPreset: boolean;
  onClose: () => void;
}) {
  const chartData = useMemo(() => {
    const eqEnabled = effectsEnabled?.eq ?? enabled;
    const toneEnabled = effectsEnabled?.tone ?? enabled;
    const userPreampEnabled = effectsEnabled?.preamp ?? enabled;
    const autoPreampGain = eqEnabled && eqResponseData ? eqResponseData.autoPreamp : 0;
    const chartPreampGain = (userPreampEnabled ? preampGain : 0) + autoPreampGain;

    const data = createEqResponseChartData(bands, eqEnabled, chartPreampGain, bassGain, trebleGain, {
      eq: eqEnabled,
      tone: toneEnabled,
      preamp: Math.abs(chartPreampGain) > 0.001,
    }, !isParametricPreset);

    return data;
  }, [bands, enabled, preampGain, bassGain, trebleGain, eqResponseData, effectsEnabled]);

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0b0b0b] border border-white/10 rounded-xl shadow-2xl w-full max-w-5xl max-h-[calc(100dvh-2rem)] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-baseline gap-3 min-w-0">
            <h2 className="text-white font-bold text-sm uppercase tracking-widest">EQ Response</h2>
            <span className="text-white/50 text-xs font-mono">{enabled ? '20 Hz - 20 kHz' : 'Bypassed'}</span>
          </div>
          <button
            aria-label="Close EQ response"
            onClick={onClose}
            className="w-8 h-8 rounded-md text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          <div className="w-full">
            <svg
              viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
              className="w-full h-auto"
              role="img"
              aria-label="EQ frequency response from 20 Hz to 20 kHz"
            >
              <rect
                x={GRAPH_PADDING.left}
                y={GRAPH_PADDING.top}
                width={graphInnerWidth}
                height={graphInnerHeight}
                rx="6"
                fill="#050505"
                stroke="rgba(255,255,255,0.08)"
              />

              {GRAPH_FREQ_TICKS.map((frequency) => {
                const x = getGraphX(frequency);
                return (
                  <g key={frequency}>
                    <line
                      x1={x}
                      y1={GRAPH_PADDING.top}
                      x2={x}
                      y2={GRAPH_PADDING.top + graphInnerHeight}
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="1"
                    />
                    <text
                      x={x}
                      y={GRAPH_HEIGHT - 13}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.5)"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {formatGraphFreq(frequency)}
                    </text>
                  </g>
                );
              })}

              {GRAPH_DB_TICKS.map((db) => {
                const y = getGraphY(db);
                return (
                  <g key={db}>
                    <line
                      x1={GRAPH_PADDING.left}
                      y1={y}
                      x2={GRAPH_PADDING.left + graphInnerWidth}
                      y2={y}
                      stroke={db === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.08)'}
                      strokeWidth={db === 0 ? '1.5' : '1'}
                    />
                    <text
                      x={GRAPH_PADDING.left - 9}
                      y={y + 3}
                      textAnchor="end"
                      fill="rgba(255,255,255,0.5)"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {db > 0 ? `+${db}` : db}
                    </text>
                  </g>
                );
              })}

              {chartData.bandCurves.map((curve) => (
                <path
                  key={curve.id}
                  d={responsePath(curve.points)}
                  fill="none"
                  stroke={curve.color}
                  strokeWidth="1.1"
                  strokeOpacity="0.22"
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {chartData.hasStereoDifference ? (
                <>
                  <path
                    d={responsePath(chartData.left)}
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d={responsePath(chartData.right)}
                    fill="none"
                    stroke="#f87171"
                    strokeWidth="3"
                    vectorEffect="non-scaling-stroke"
                  />
                </>
              ) : (
                <path
                  d={responsePath(chartData.total)}
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
              )}

              {enabled && bands.map((band) => (
                <circle
                  key={band.id}
                  cx={getGraphX(Math.max(GRAPH_MIN_FREQ, Math.min(GRAPH_MAX_FREQ, band.frequency)))}
                  cy={getGraphY(band.gain)}
                  r="3.8"
                  fill={eqPointColor(band.channel)}
                  stroke="#050505"
                  strokeWidth="1.4"
                />
              ))}
            </svg>
          </div>

          <div className="flex flex-wrap items-center gap-3 px-1 pt-3 text-[10px] uppercase tracking-widest text-white/55">
            {chartData.hasStereoDifference ? (
              <>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-400" />L</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-400" />R</span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 bg-cyan-300" />Total</span>
            )}
            {enabled && eqResponseData && (
              <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 bg-amber-300" />Target</span>
            )}
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-0.5 bg-white/25" />Bands</span>
            <span className="font-mono normal-case text-white/40">dB</span>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export function EqRack() {
  const { playerState } = useGlobalAudio();
  const { t } = useTranslation();
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [openFilterDropdown, setOpenFilterDropdown] = useState<string | null>(null);
  const [showEqInfo, setShowEqInfo] = useState(false);

  type ModalState =
    | { type: 'save' }
    | { type: 'rename', oldName: string }
    | { type: 'delete', name: string }
    | null;
  const [modalState, setModalState] = useState<ModalState>(null);
  const [modalInput, setModalInput] = useState("");

  const handleModalSubmit = () => {
    if (!modalState) return;
    if (modalState.type === 'save' && modalInput.trim()) {
      playerState.saveCustomPreset(modalInput.trim());
    } else if (modalState.type === 'rename' && modalInput.trim()) {
      playerState.renameCustomPreset(modalState.oldName, modalInput.trim());
    } else if (modalState.type === 'delete') {
      playerState.deleteCustomPreset(modalState.name);
    }
    setModalState(null);
  };

  const currentSavedPreset = playerState.customEqPresets.find(p => p.name === playerState.eqPresetName);
  const currentStylisticPreset = STYLISTIC_PRESETS[playerState.eqPresetName as keyof typeof STYLISTIC_PRESETS];
  const isParametricPreset = playerState.eqPresetName === 'PARAMETRIC'
    || isSavedParametricPreset(currentSavedPreset)
    || Boolean(currentStylisticPreset && 'isParametric' in currentStylisticPreset && (currentStylisticPreset as any).isParametric);
  const isEditablePreset = playerState.eqPresetName === 'CUSTOM'
    || playerState.eqPresetName === 'PARAMETRIC'
    || currentSavedPreset?.isCustomOrigin
    || currentSavedPreset?.presetMode === 'custom'
    || currentSavedPreset?.presetMode === 'parametric';
  const bandColumnWidth = isEditablePreset ? 72 : 48;
  const bandGap = 16;
  const eqRackMinWidth = Math.max(
    0,
    playerState.eqBands.length * bandColumnWidth + Math.max(0, playerState.eqBands.length - 1) * bandGap
  );

  return (
    <div className="bg-[#0a0a0a] rounded-2xl border border-white/5 shadow-2xl flex flex-col overflow-hidden w-full">
      {/* EQ Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center justify-between md:justify-start w-full md:w-auto gap-4">
          <EffectPowerButton
            size="lg"
            active={playerState.fxEnabled.eq}
            onClick={() => playerState.toggleFx('eq')}
            activeClassName="bg-[#00E5FF]/20 text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.4)]"
          />
          <div className="relative flex-1 min-w-0 md:flex-none">
            <button aria-label="Action"
              onClick={() => setShowPresetMenu(!showPresetMenu)}
              className="flex items-center justify-between md:justify-start w-full gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium text-sm transition-colors border border-white/10"
            >
              <div className="flex items-center gap-2">
                {isParametricPreset ? <CircleDot size={16} className="text-[#ff00ff]" /> : <Sliders size={16} className="text-[#00E5FF]" />}
                <span className="truncate max-w-[200px] md:max-w-xs">{playerState.eqPresetName.replace('_', ' ')}</span>
              </div>
              <ChevronDown size={16} className="shrink-0 text-white/50" />
            </button>

            {showPresetMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPresetMenu(false)} />
                <div className="absolute top-full left-0 mt-2 w-64 max-w-[calc(100vw-32px)] bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden py-1 max-h-96 overflow-y-auto">
                  {Object.keys(EQ_PRESETS).map((key) => (
                    <button aria-label="Action"
                      key={key}
                      onClick={() => {
                        playerState.applyPreset(key as keyof typeof EQ_PRESETS);
                        setShowPresetMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/10 text-white text-sm transition-colors"
                    >
                      <Sliders size={14} className="text-white/50 shrink-0" />
                      <span>{key.replace('_', ' ')}</span>
                    </button>
                  ))}

                  <div className="h-px bg-white/10 my-1"></div>
                  <div className="px-4 py-1 text-[10px] text-white/80 uppercase font-bold tracking-widest">Sound Signatures</div>
                  {Object.keys(STYLISTIC_PRESETS).map((key) => {
                    const preset = STYLISTIC_PRESETS[key as keyof typeof STYLISTIC_PRESETS];
                    const isParam = 'isParametric' in preset && (preset as any).isParametric;
                    return (
                      <button aria-label="Action"
                        key={key}
                        onClick={() => {
                          playerState.applyStylisticPreset(key as keyof typeof STYLISTIC_PRESETS);
                          setShowPresetMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 hover:bg-[#ff00ff]/20 text-[#ff00ff] font-bold text-sm transition-colors"
                      >
                        {isParam ? <CircleDot size={14} className="shrink-0" /> : <Sliders size={14} className="shrink-0" />}
                        <span>{preset.name}</span>
                      </button>
                    );
                  })}

                  {playerState.customEqPresets.length > 0 && (
                    <>
                      <div className="h-px bg-white/10 my-1"></div>
                      <div className="px-4 py-1 text-[10px] text-white/80 uppercase font-bold tracking-widest">{t('studio.eq.savedPresets', 'Saved Presets')}</div>
                      {playerState.customEqPresets.map((preset) => {
                        const isParam = isSavedParametricPreset(preset);
                        return (
                          <div key={preset.name} className="flex items-center w-full px-4 py-1 hover:bg-white/10 group transition-colors">
                            <button aria-label="Action"
                              onClick={() => {
                                playerState.applyCustomSavedPreset(preset.name);
                                setShowPresetMenu(false);
                              }}
                              className="flex-1 flex items-center gap-2 text-left text-white/80 text-sm mr-2"
                            >
                              {isParam ? <CircleDot size={14} className="shrink-0" /> : <Sliders size={14} className="shrink-0" />}
                              <span className="truncate max-w-[100px]">{preset.name}</span>
                              <span className="text-[10px] text-white/50 ml-auto">
                                {isParam ? '(Parametric)' : `(${preset.bands.length} ${t('studio.eq.bands', 'bands')})`}
                              </span>
                            </button>

                            <div className="flex items-center gap-1 opacity-100 lg:opacity-30 group-hover:opacity-100 transition-opacity">
                              <button aria-label="Action"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModalInput(preset.name);
                                  setModalState({ type: 'rename', oldName: preset.name });
                                  setShowPresetMenu(false);
                                }}
                                className="p-1 text-white/80 hover:text-white transition-colors"
                                title="Đổi tên"
                              >
                                <Edit2 size={12} />
                              </button>
                              <button aria-label="Action"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setModalState({ type: 'delete', name: preset.name });
                                  setShowPresetMenu(false);
                                }}
                                className="p-1 text-white/80 hover:text-red-400 transition-colors"
                                title="Xóa"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}

                  <div className="h-px bg-white/10 my-1"></div>
                  <button aria-label="Action"
                    onClick={() => {
                      playerState.setCustomPreset();
                      setShowPresetMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-[#00E5FF]/20 text-[#00E5FF] font-medium text-sm transition-colors"
                  >
                    CUSTOM
                  </button>
                  <button aria-label="Action"
                    onClick={() => {
                      playerState.setParametricPreset();
                      setShowPresetMenu(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-[#00E5FF]/20 text-[#00E5FF] font-medium text-sm transition-colors"
                  >
                    PARAMETRIC
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end w-full md:w-auto gap-2 overflow-x-auto pb-1 md:overflow-visible md:pb-0">
          <button
            aria-label="EQ response"
            title="EQ response"
            onClick={() => setShowEqInfo(true)}
            className="w-8 h-8 rounded-md bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
          >
            <Info size={16} />
          </button>
          <button aria-label="Action"
            onClick={() => {
              setModalInput("");
              setModalState({ type: 'save' });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#00f5ff]/10 text-[#00f5ff] hover:bg-[#00f5ff]/20 transition-colors text-sm font-medium border border-[#00f5ff]/30 whitespace-nowrap shrink-0"
          >
            {t('studio.eq.save', 'Lưu')}
          </button>
          {isEditablePreset && (
            <button aria-label="Action"
              onClick={() => playerState.addCustomEqBand(1000)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#00E5FF]/10 text-[#00E5FF] hover:bg-[#00E5FF]/20 transition-colors text-sm font-medium border border-[#00E5FF]/30 whitespace-nowrap shrink-0"
            >
              <Plus size={16} />
              {t('studio.eq.addBand', 'Add Band')}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 w-full overflow-x-auto">
        <div
          className="flex items-end gap-x-4 px-1 sm:px-2 pb-4 justify-start"
          style={{ minWidth: eqRackMinWidth }}
        >

          <div className={`flex items-end gap-x-4 transition-opacity duration-300 relative z-0 ${playerState.fxEnabled.eq ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>

            {playerState.eqBands.map((band) => (
              <div
                key={band.id}
                className="flex flex-col items-center gap-3 group"
                style={{ flex: `0 0 ${bandColumnWidth}px`, width: bandColumnWidth }}
              >
                {isEditablePreset && <button aria-label="Action"
                  onClick={() => playerState.removeCustomEqBand(band.id)}
                  className="w-6 h-6 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center opacity-100 lg:opacity-30 group-hover:opacity-100 transition-opacity hover:bg-red-500/30"
                >
                  <X size={12} />
                </button>
                }

                <VerticalFader
                  value={band.gain}
                  min={-15}
                  max={15}
                  onChange={(v) => playerState.updateEqGain(band.id, v)}
                  label={isEditablePreset ? '' : formatFreq(band.frequency)}
                  trackColor={playerState.fxEnabled.eq ? (band.channel === 'L' ? '#3b82f6' : band.channel === 'R' ? '#ef4444' : '#00E5FF') : '#444444'}
                />

                {isEditablePreset ? (
                  <div className="flex w-full flex-col items-center gap-1 mt-1">
                    <span className="text-[9px] text-white/65 uppercase font-sans">Hz</span>
                    <NumberInput
                      value={band.frequency}
                      min={20}
                      max={20000}
                      step={0.01}
                      onChange={(value) => playerState.updateEqBandFreq(band.id, value)}
                      ariaLabel="Band frequency"
                      className="w-full bg-transparent border-b border-white/20 text-center text-[11px] text-white/70 font-mono outline-none focus:border-[#00E5FF] pb-1"
                    />
                  </div>
                ) : null}

                {isParametricPreset ? (
                  <div className="flex w-full flex-col items-center gap-1 mt-2 border-t border-white/5 pt-2">
                    <div className="relative">
                      <button
                        aria-label="Action"
                        onClick={() => setOpenFilterDropdown(openFilterDropdown === band.id ? null : band.id)}
                        className="bg-transparent text-[9px] text-white/80 uppercase font-bold outline-none border border-white/10 rounded px-1 py-0.5 cursor-pointer hover:bg-white/10 hover:text-white transition-colors w-[32px] text-center shadow-sm"
                      >
                        {band.type === 'lowpass' ? 'LP' : band.type === 'highpass' ? 'HP' : band.type === 'bandpass' ? 'BP' : band.type === 'lowshelf' ? 'LS' : band.type === 'highshelf' ? 'HS' : 'PK'}
                      </button>
                      {openFilterDropdown === band.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenFilterDropdown(null)} />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 flex flex-col bg-[#1a1a1a] border border-white/10 rounded shadow-2xl z-[100] overflow-hidden min-w-[40px]">
                            {([
                              { value: 'peaking', label: 'PK' },
                              { value: 'lowpass', label: 'LP' },
                              { value: 'highpass', label: 'HP' },
                              { value: 'bandpass', label: 'BP' },
                              { value: 'lowshelf', label: 'LS' },
                              { value: 'highshelf', label: 'HS' }
                            ] satisfies Array<{ value: BiquadFilterType; label: string }>).map(t => (
                              <div
                                key={t.value}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playerState.updateEqBandType(band.id, t.value);
                                  setOpenFilterDropdown(null);
                                }}
                                className={`px-3 py-1.5 text-[9px] font-bold cursor-pointer transition-colors text-center ${band.type === t.value || (!band.type && t.value === 'peaking') ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
                              >
                                {t.label}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    <span className="text-[9px] text-white/65 uppercase font-sans mt-1">Q</span>
                    <NumberInput
                      step={0.01}
                      min={0.1}
                      max={18}
                      value={band.q}
                      onChange={(value) => playerState.updateEqBandQ(band.id, value)}
                      ariaLabel="Band Q factor"
                      className="w-full bg-transparent border-b border-white/20 text-center text-[11px] text-[#00f5ff] font-mono outline-none focus:border-[#00E5FF] pb-1"
                    />

                    <div className="flex w-full mt-3 p-[2px] bg-[#0a0a0a] rounded-md border border-white/10 shadow-inner">
                      <button aria-label="Action"
                        onClick={() => playerState.updateEqBandChannel(band.id, 'L+R')}
                        className={`flex-1 text-[9px] font-bold py-[3px] rounded transition-all duration-300 ${band.channel === 'L+R' ? 'bg-[#00E5FF] text-black shadow-[0_0_8px_rgba(0,229,255,0.5)]' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                      >
                        M
                      </button>
                      <button aria-label="Action"
                        onClick={() => playerState.updateEqBandChannel(band.id, 'L')}
                        className={`flex-1 text-[9px] font-bold py-[3px] rounded transition-all duration-300 ${band.channel === 'L' ? 'bg-blue-500 text-white shadow-[0_0_8px_rgba(59,130,246,0.5)]' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                      >
                        L
                      </button>
                      <button aria-label="Action"
                        onClick={() => playerState.updateEqBandChannel(band.id, 'R')}
                        className={`flex-1 text-[9px] font-bold py-[3px] rounded transition-all duration-300 ${band.channel === 'R' ? 'bg-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                      >
                        R
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showEqInfo && (
        <EqResponseModal
          bands={playerState.eqBands}
          enabled={playerState.fxEnabled.eq}
          preampGain={playerState.preampGain}
          bassGain={playerState.bassGain}
          trebleGain={playerState.trebleGain}
          eqResponseData={playerState.fxEnabled.interpolate ? playerState.eqResponseData : null}
          effectsEnabled={playerState.fxEnabled}
          isParametricPreset={isParametricPreset}
          onClose={() => setShowEqInfo(false)}
        />
      )}

      {/* Custom Modal for Presets */}
      {modalState && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#111] border border-white/10 rounded-xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4">
            <h2 className="text-white/80 font-bold text-lg">
              {modalState.type === 'save' && t('studio.eq.savePreset', "Lưu Preset")}
              {modalState.type === 'rename' && "Rename"}
              {modalState.type === 'delete' && "Delete"}
            </h2>

            {(modalState.type === 'save' || modalState.type === 'rename') && (
              <input
                autoFocus
                type="text"
                placeholder={t('studio.eq.newPresetName', "Nhập tên...")}
                value={modalInput}
                onChange={(e) => setModalInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleModalSubmit()}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm outline-none focus:border-[#00E5FF] focus:bg-white/10 transition-colors"
              />
            )}

            {modalState.type === 'delete' && (
              <p className="text-white/70 text-sm">
                {t('studio.eq.deleteConfirm', "Bạn có chắc chắn muốn xóa preset '{name}' không?", { name: modalState.name })}
              </p>
            )}

            <div className="flex justify-end gap-3 mt-2">
              <button aria-label="Action"
                onClick={() => setModalState(null)}
                className="px-4 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors"
              >
                {t('studio.eq.cancel', 'Hủy')}
              </button>
              <button aria-label="Action"
                onClick={handleModalSubmit}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${modalState.type === 'delete'
                  ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
                  : 'bg-[#00E5FF]/20 text-[#00E5FF] hover:bg-[#00E5FF]/30'
                  }`}
              >
                {modalState.type === 'delete' ? 'Delete' : t('studio.eq.save', 'Lưu')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
