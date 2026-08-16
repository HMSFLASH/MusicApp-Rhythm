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
  const [activeTab, setActiveTab] = useState<'eq' | 'dynamics' | 'spatial' | 'master'>('eq');

  return (
    <div className="flex flex-col h-full max-w-7xl 2xl:max-w-none mx-auto pb-28 md:pb-32 no-scrollbar">
      {/* Header & Warning */}
      <div className="mb-6 border-b border-white/[0.06] pb-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl lg:text-3xl font-bold font-display text-white tracking-tight">
            {t('studio.pageTitle', 'Audio Studio')}
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm font-mono mt-1 mb-4">
            {t('studio.pageDesc', 'Professional-grade audio DSP & processing chain.')}
          </p>

          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3.5 flex gap-3 items-start max-w-2xl backdrop-blur-md">
            <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={17} />
            <div>
              <h2 className="text-amber-400 font-semibold mb-0.5 text-xs sm:text-sm font-sans">{t('studio.warningTitle', 'Performance Notice')}</h2>
              <p className="text-amber-300/80 text-[11px] leading-relaxed">
                {t('studio.warningDesc', 'Heavy effects can overload weak CPUs and cause stuttering. Keep the limiter on and use pre-calculation if needed.')}
              </p>
            </div>
          </div>
        </div>

        {/* Studio Navigation Tabs */}
        <div className="flex w-full gap-1.5 overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0c1626]/80 p-1.5 backdrop-blur-xl lg:w-auto shadow-lg no-scrollbar">
          <button aria-label="EQ & Tone Tab"
            onClick={() => setActiveTab('eq')}
            className={`grow shrink-0 lg:flex-none px-4 lg:px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'eq' 
                ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_15px_rgba(0,245,255,0.25)]' 
                : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            {t('studio.tabEq', 'EQ & Tone')}
          </button>
          <button aria-label="Dynamics Tab"
            onClick={() => setActiveTab('dynamics')}
            className={`grow shrink-0 lg:flex-none px-4 lg:px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'dynamics' 
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.25)]' 
                : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            {t('studio.tabDynamics', 'Dynamics')}
          </button>
          <button aria-label="Spatial Tab"
            onClick={() => setActiveTab('spatial')}
            className={`grow shrink-0 lg:flex-none px-4 lg:px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'spatial' 
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.25)]' 
                : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            {t('studio.tabSpatial', 'Spatial')}
          </button>
          <button aria-label="Master Tab"
            onClick={() => setActiveTab('master')}
            className={`grow shrink-0 lg:flex-none px-4 lg:px-5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'master' 
                ? 'bg-white/20 text-white border border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.2)]' 
                : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            {t('studio.tabMaster', 'Master & Output')}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col gap-6 md:gap-8">
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

          {activeTab === 'master' && (
            <MasterOutput />
          )}
        </div>
      </div>
    </div>
  );
}
