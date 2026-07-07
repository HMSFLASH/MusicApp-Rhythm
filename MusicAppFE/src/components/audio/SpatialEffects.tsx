import { Power } from 'lucide-react';
import { HorizontalSlider } from '../HorizontalSlider';
import { useGlobalAudio } from '../../context/AudioContext';
import { useTranslation } from 'react-i18next';

export function SpatialEffects() {
  const { playerState } = useGlobalAudio();
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-8 w-full">
      
      {/* Reverb Section */}
      <div className="bg-[#0a0a0a] rounded-2xl border border-white/5 shadow-2xl p-8 flex flex-col gap-8">
        <div className="flex items-center gap-3 border-b border-white/10 pb-4">
          <button 
            onClick={() => playerState.toggleFx('reverb')}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${playerState.fxEnabled.reverb ? 'bg-[#ff00ff]/20 text-[#ff00ff] shadow-[0_0_15px_rgba(255,0,255,0.4)]' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}
          >
            <Power size={14} />
          </button>
          <div>
            <h2 className="text-xl font-bold font-sans text-white/80 tracking-tight">{t('studio.spatial.reverbTitle', 'Reverb FX')}</h2>
            <p className="text-secondary/60 text-xs font-mono mt-1">{t('studio.spatial.reverbDesc', 'Add space and depth using Convolution Reverb.')}</p>
          </div>
        </div>

        <div className={`flex flex-col gap-8 transition-opacity duration-300 ${playerState.fxEnabled.reverb ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
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
        </div>
      </div>

      {/* Stereo Imager */}
      <div className="bg-[#0a0a0a] p-8 rounded-2xl border border-white/5 shadow-2xl flex flex-col gap-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-bold font-sans text-white/80 tracking-tight">{t('studio.spatial.stereoTitle', 'Stereo Imager')}</h2>
            <p className="text-secondary/60 text-xs font-mono mt-1">{t('studio.spatial.stereoDesc', 'Widen your stereo image using Mid/Side processing. 100% is normal, >100% is wider.')}</p>
          </div>
          <button
            onClick={() => playerState.toggleFx('stereo')}
            className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center transition-all ${playerState.fxEnabled.stereo ? 'bg-[#9d00ff]/20 text-[#9d00ff] shadow-[0_0_15px_rgba(157,0,255,0.4)]' : 'bg-white/5 text-white/30 hover:bg-white/10'}`}
          >
            <Power size={18} />
          </button>
        </div>

        <div className={`transition-opacity duration-300 ${playerState.fxEnabled.stereo ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
          <HorizontalSlider
            value={playerState.stereoWidth}
            min={0}
            max={200}
            step={1}
            onChange={playerState.updateStereoWidth}
            label={t('studio.spatial.stereoWidth', 'Stereo Width')}
            color="#9d00ff"
            unit="%"
          />
        </div>
      </div>

    </div>
  );
}
