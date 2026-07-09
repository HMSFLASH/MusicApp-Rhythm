import { useState } from 'react';
import { Plus, ChevronDown, X, Edit2, Trash2 } from 'lucide-react';
import { VerticalFader } from '../VerticalFader';
import { EQ_PRESETS, STYLISTIC_PRESETS } from '../../hooks/useAudioPlayer';
import { useGlobalAudio } from '../../context/AudioContext';
import { useTranslation } from 'react-i18next';
import { EffectPowerButton } from './AudioEffectPanel';

const formatFreq = (f: number) => {
  if (f >= 1000) return (f / 1000) + 'k';
  return f.toString();
};

export function EqRack() {
  const { playerState } = useGlobalAudio();
  const { t } = useTranslation();
  const [showPresetMenu, setShowPresetMenu] = useState(false);

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

  const isEditablePreset = playerState.eqPresetName === 'CUSTOM' || playerState.eqPresetName === 'PARAMETRIC' || !!playerState.customEqPresets.find(p => p.name === playerState.eqPresetName)?.isCustomOrigin;

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
          <div className="relative">
            <button aria-label="Action"
              onClick={() => setShowPresetMenu(!showPresetMenu)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium text-sm transition-colors border border-white/10 whitespace-nowrap shrink-0"
            >
              <span>{playerState.eqPresetName.replace('_', ' ')}</span>
              <ChevronDown size={16} />
            </button>

            {showPresetMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPresetMenu(false)} />
                <div className="absolute top-full left-0 mt-2 w-64 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden py-1 max-h-96 overflow-y-auto">
                  {Object.keys(EQ_PRESETS).map((key) => (
                    <button aria-label="Action"
                      key={key}
                      onClick={() => {
                        playerState.applyPreset(key as keyof typeof EQ_PRESETS);
                        setShowPresetMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-white/10 text-white text-sm transition-colors"
                    >
                      {key.replace('_', ' ')}
                    </button>
                  ))}

                  <div className="h-px bg-white/10 my-1"></div>
                  <div className="px-4 py-1 text-[10px] text-white/80 uppercase font-bold tracking-widest">Sound Signatures</div>
                  {Object.keys(STYLISTIC_PRESETS).map((key) => (
                    <button aria-label="Action"
                      key={key}
                      onClick={() => {
                        playerState.applyStylisticPreset(key as keyof typeof STYLISTIC_PRESETS);
                        setShowPresetMenu(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-[#ff00ff]/20 text-[#ff00ff] font-bold text-sm transition-colors flex items-center justify-between"
                    >
                      <span>{STYLISTIC_PRESETS[key as keyof typeof STYLISTIC_PRESETS].name}</span>
                    </button>
                  ))}

                  {playerState.customEqPresets.length > 0 && (
                    <>
                      <div className="h-px bg-white/10 my-1"></div>
                      <div className="px-4 py-1 text-[10px] text-white/80 uppercase font-bold tracking-widest">{t('studio.eq.savedPresets', 'Saved Presets')}</div>
                      {playerState.customEqPresets.map((preset) => (
                        <div key={preset.name} className="flex items-center w-full px-4 py-1 hover:bg-white/10 group transition-colors">
                          <button aria-label="Action"
                            onClick={() => {
                              playerState.applyCustomSavedPreset(preset.name);
                              setShowPresetMenu(false);
                            }}
                            className="flex-1 text-left text-white/80 text-sm flex items-center justify-between mr-2"
                          >
                            <span className="truncate max-w-[100px]">{preset.name}</span>
                            <span className="text-[10px] text-white/80">({preset.bands.length} {t('studio.eq.bands', 'bands')})</span>
                          </button>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      ))}
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

        <div className="flex items-center justify-end w-full md:w-auto gap-2">
          <button aria-label="Action"
            onClick={() => {
              setModalInput("");
              setModalState({ type: 'save' });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#00f5ff]/10 text-[#00f5ff] hover:bg-[#00f5ff]/20 transition-colors text-sm font-medium border border-[#00f5ff]/30 whitespace-nowrap"
          >
            {t('studio.eq.save', 'Lưu')}
          </button>
          {isEditablePreset && (
            <button aria-label="Action"
              onClick={() => playerState.addCustomEqBand(1000)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#00E5FF]/10 text-[#00E5FF] hover:bg-[#00E5FF]/20 transition-colors text-sm font-medium border border-[#00E5FF]/30 whitespace-nowrap"
            >
              <Plus size={16} />
              {t('studio.eq.addBand', 'Add Band')}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 w-full overflow-x-auto no-scrollbar">
        <div className="flex items-end gap-x-4 px-2 min-w-max pb-4 justify-start md:justify-center">

          <div className={`flex items-end gap-x-4 transition-opacity duration-300 ${playerState.fxEnabled.eq ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>

          {playerState.eqBands.map((band) => (
            <div key={band.id} className="flex flex-col items-center gap-3 group">
              {isEditablePreset && (
                <button aria-label="Action"
                  onClick={() => playerState.removeCustomEqBand(band.id)}
                  className="w-6 h-6 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/30"
                >
                  <X size={12} />
                </button>
              )}

              <VerticalFader
                value={band.gain}
                min={-15}
                max={15}
                onChange={(v) => playerState.updateEqGain(band.id, v)}
                label={isEditablePreset ? '' : formatFreq(band.frequency)}
                trackColor={playerState.fxEnabled.eq ? (band.channel === 'L' ? '#3b82f6' : band.channel === 'R' ? '#ef4444' : '#00E5FF') : '#444444'}
              />

              {isEditablePreset ? (
                <div className="flex flex-col items-center gap-1 mt-1">
                  <span className="text-[10px] text-white/80 uppercase tracking-widest font-sans">Freq</span>
                  <input
                    type="number"
                    value={band.frequency}
                    onChange={(e) => playerState.updateEqBandFreq(band.id, Number(e.target.value))}
                    className="w-14 bg-transparent border-b border-white/20 text-center text-xs text-white/70 font-mono outline-none focus:border-[#00E5FF] pb-1"
                  />
                </div>
              ) : null}

              {playerState.eqPresetName === 'PARAMETRIC' ? (
                <div className="flex flex-col items-center gap-1 mt-2 border-t border-white/5 pt-2">
                  <div className="group/filter relative">
                    <button aria-label="Action" className="bg-transparent text-[9px] text-white/80 uppercase font-bold outline-none border border-white/10 rounded px-1 py-0.5 cursor-pointer hover:bg-white/10 hover:text-white transition-colors w-[32px] text-center shadow-sm">
                      {band.type === 'lowpass' ? 'LP' : band.type === 'highpass' ? 'HP' : band.type === 'bandpass' ? 'BP' : band.type === 'lowshelf' ? 'LS' : band.type === 'highshelf' ? 'HS' : 'PK'}
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/filter:flex flex-col bg-[#1a1a1a] border border-white/10 rounded shadow-2xl z-[100] overflow-hidden min-w-[40px]">
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
                          onClick={(e) => { e.stopPropagation(); playerState.updateEqBandType(band.id, t.value); }}
                          className={`px-3 py-1.5 text-[9px] font-bold cursor-pointer transition-colors text-center ${band.type === t.value || (!band.type && t.value === 'peaking') ? 'bg-primary/20 text-primary' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
                        >
                          {t.label}
                        </div>
                      ))}
                    </div>
                  </div>

                  <span className="text-[10px] text-white/80 uppercase tracking-widest font-sans mt-1">Q-Fact</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="18"
                    value={band.q}
                    onChange={(e) => playerState.updateEqBandQ(band.id, Number(e.target.value))}
                    className="w-14 bg-transparent border-b border-white/20 text-center text-xs text-[#00f5ff] font-mono outline-none focus:border-[#00E5FF] pb-1"
                  />

                  <div className="flex items-center gap-1 mt-2 p-0.5 bg-white/5 rounded-md border border-white/10">
                    <button aria-label="Action"
                      onClick={() => playerState.updateEqBandChannel(band.id, 'L+R')}
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors ${band.channel === 'L+R' ? 'bg-[#00E5FF] text-black' : 'text-white/80 hover:text-white'}`}
                    >
                      M
                    </button>
                    <button aria-label="Action"
                      onClick={() => playerState.updateEqBandChannel(band.id, 'L')}
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors ${band.channel === 'L' ? 'bg-blue-500 text-white' : 'text-white/80 hover:text-white'}`}
                    >
                      L
                    </button>
                    <button aria-label="Action"
                      onClick={() => playerState.updateEqBandChannel(band.id, 'R')}
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors ${band.channel === 'R' ? 'bg-red-500 text-white' : 'text-white/80 hover:text-white'}`}
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

      {/* Custom Modal for Presets */}
      {modalState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
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
        </div>
      )}
    </div>
  );
}
