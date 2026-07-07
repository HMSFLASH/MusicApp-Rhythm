import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { EqRack } from '../components/audio/EqRack';
import { ToneControls } from '../components/audio/ToneControls';
import { DynamicsRack } from '../components/audio/DynamicsRack';
import { SpatialEffects } from '../components/audio/SpatialEffects';
import { MasterOutput } from '../components/audio/MasterOutput';

export function StudioPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'eq' | 'dynamics' | 'spatial'>('eq');

  return (
    <div className="flex flex-col h-full max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-6 border-b border-white/10 pb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl font-bold font-sans text-white tracking-tight">{t('studio.pageTitle', 'Audio Studio')}</h1>
          <p className="text-secondary/60 text-sm font-mono mt-2 mb-4">
            {t('studio.pageDesc', 'Professional-grade audio processing chain.')}
          </p>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex gap-3 items-start max-w-2xl">
            <AlertCircle className="text-amber-500 shrink-0 mt-0.5" size={18} />
            <div>
              <h3 className="text-amber-500 font-semibold mb-0.5 text-sm">{t('studio.warningTitle', 'Performance Warning')}</h3>
              <p className="text-amber-500/80 text-xs">
                {t('studio.warningDesc', 'Enabling multiple features on weak devices/CPUs may cause the audio processing to fall behind, resulting in stuttering and glitching.')}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-[#111] p-1 rounded-xl border border-white/10 overflow-hidden">
          <button
            onClick={() => setActiveTab('eq')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'eq' ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            {t('studio.tabEq', 'EQ & Tone')}
          </button>
          <button
            onClick={() => setActiveTab('dynamics')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'dynamics' ? 'bg-[#ff0055]/20 text-[#ff0055]' : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            {t('studio.tabDynamics', 'Dynamics')}
          </button>
          <button
            onClick={() => setActiveTab('spatial')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              activeTab === 'spatial' ? 'bg-[#9d00ff]/20 text-[#9d00ff]' : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            {t('studio.tabSpatial', 'Spatial')}
          </button>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-8">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col gap-8">
          {activeTab === 'eq' && (
            <>
              <EqRack />
              <ToneControls />
            </>
          )}

          {activeTab === 'dynamics' && (
            <DynamicsRack />
          )}

          {activeTab === 'spatial' && (
            <SpatialEffects />
          )}
        </div>

        {/* Right Sidebar (Always Visible Master Output) */}
        <div className="w-full xl:w-[350px] flex-shrink-0">
          <MasterOutput />
        </div>
      </div>
    </div>
  );
}
