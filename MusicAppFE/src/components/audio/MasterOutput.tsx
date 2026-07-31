import { HorizontalSlider } from '../HorizontalSlider';
import { useGlobalAudio } from '../../context/AudioContext';
import { useTranslation } from 'react-i18next';
import { AudioToggleRow } from './AudioToggleRow';
import { AudioSelectRow } from './AudioSelectRow';
import { QueuePrecalculatePanel } from './QueuePrecalculatePanel';
import { AudioEffectPanel, EffectControlsGate, EffectPowerButton } from './AudioEffectPanel';

export function MasterOutput() {
  const { playerState } = useGlobalAudio();
  const { t } = useTranslation();

  const fftSizeOptions: { label: string; value: number }[] = [
    { label: t('studio.masterOutput.fft256', '256 (Siêu thấp / Cực nhẹ)'), value: 256 },
    { label: t('studio.masterOutput.fft512', '512 (Thấp / Nhẹ CPU)'), value: 512 },
    { label: t('studio.masterOutput.fft1024', '1024 (Trung bình)'), value: 1024 },
    { label: t('studio.masterOutput.fft2048', '2048 (Tối ưu khuyên dùng)'), value: 2048 },
    { label: t('studio.masterOutput.fft4096', '4096 (Chất lượng cao)'), value: 4096 },
    { label: t('studio.masterOutput.fft8192', '8192 (Rất cao / Nặng CPU)'), value: 8192 },
    { label: t('studio.masterOutput.fft16384', '16384 (Tối đa / Cực nặng)'), value: 16384 },
  ];

  const latencyOptions: { label: string; value: AudioContextLatencyCategory }[] = [
    { label: t('studio.masterOutput.latencyInteractive', 'Interactive (Rất thấp / Gây giật)'), value: 'interactive' },
    { label: t('studio.masterOutput.latencyBalanced', 'Balanced (Trung bình)'), value: 'balanced' },
    { label: t('studio.masterOutput.latencyPlayback', 'Playback (Cao / An toàn nhất)'), value: 'playback' },
  ];

  return (
    <AudioEffectPanel
      title={t('studio.masterOutput.title', 'Master Output')}
      description={t('studio.masterOutput.desc', 'Final stage output controls and panning.')}
      leading={(
        <EffectPowerButton
          active={playerState.fxEnabled.master}
          onClick={() => playerState.toggleFx('master')}
          activeClassName="bg-[#ffffff]/20 text-[#ffffff] shadow-[0_0_15px_rgba(255,255,255,0.4)]"
        />
      )}
    >

      <EffectControlsGate active={playerState.fxEnabled.master} className="flex flex-col gap-8">
        <HorizontalSlider
          value={playerState.panValue}
          min={-100}
          max={100}
          onChange={playerState.updatePanValue}
          label={t('studio.masterOutput.lrBalance', 'L/R Balance')}
          color="#ffffff"
          unit="%"
        />
      </EffectControlsGate>

      <AudioSelectRow<number>
        title={t('studio.masterOutput.analyserFftTitle', 'Độ phân giải Master Analyser (FFT Size)')}
        description={t('studio.masterOutput.analyserFftDesc', 'Tăng lên đến 16384 cho đồ thị tần số mịn nét hơn, hoặc giảm xuống (256 - 1024) để tiết kiệm CPU khi phát nhạc.')}
        value={playerState.masterFftSize || 2048}
        options={fftSizeOptions}
        onChange={(val) => playerState.updateMasterFftSize(val)}
      />

      <AudioSelectRow<AudioContextLatencyCategory>
        title={t('studio.masterOutput.latencyTitle', 'Audio Buffer Size (Latency Mode)')}
        description={t('studio.masterOutput.latencyDesc', 'Tương tự Block Size trong DAW. Chọn Playback để giảm tải CPU tối đa, tránh âm thanh bị ngắt quãng. (Cần tải lại trang hoặc đổi bài hát để áp dụng).')}
        value={playerState.audioLatencyHint || 'playback'}
        options={latencyOptions}
        onChange={(val) => playerState.updateAudioLatencyHint(val)}
      />

      <AudioSelectRow
        title={t('studio.masterOutput.latencyTitle', 'Audio Buffer Size (Latency Mode)')}
        description={t('studio.masterOutput.latencyDesc', 'Tương tự Block Size trong DAW. Chọn Playback để giảm tải CPU tối đa, tránh âm thanh bị ngắt quãng. (Cần tải lại trang hoặc đổi bài hát để áp dụng).')}
        value={playerState.audioLatencyHint || 'playback'}
        options={latencyOptions}
        onChange={playerState.updateAudioLatencyHint}
      />

      <AudioToggleRow
        title={t('studio.masterOutput.loudnessNorm', 'Loudness Normalization')}
        description={t('studio.masterOutput.loudnessDesc', 'Measures each track and applies fixed LUFS gain with peak-safe headroom. Best quality when pre-calculation is enabled.')}
        checked={playerState.loudnessNormalization}
        onToggle={playerState.toggleLoudnessNormalization}
      />

      <AudioToggleRow
        title={t('studio.masterOutput.hqOversample', 'High Quality Oversampling')}
        description={t('studio.masterOutput.hqOversampleDesc', 'Reduces aliasing in the limiter soft clip stage. Warning: May cause lag on mobile devices.')}
        checked={playerState.useOversample}
        onToggle={() => playerState.setUseOversample(!playerState.useOversample)}
      />

      <AudioToggleRow
        tone="amber"
        title={t('studio.masterOutput.precalcIdle', 'Pre-calculate for Weak CPUs')}
        description={t('studio.masterOutput.precalcIdleDesc', 'For weak CPUs with enough RAM: renders each track before playback so heavy effects do not have to run in real time. This normal mode handles one track at a time, not the whole queue. EQ/Effects changes apply on the next track.')}
        checked={playerState.precalculateOnIdle}
        onToggle={() => playerState.setPrecalculateOnIdle(!playerState.precalculateOnIdle)}
      />

      <AudioToggleRow
        tone="amber"
        title={t('studio.masterOutput.fullQueueCache', 'Full Queue RAM Cache')}
        description={t('studio.masterOutput.fullQueueCacheDesc', 'Keep precalculated audio buffers for the entire queue in RAM and unlock full-queue pre-calculation. Allows instant playback of any rendered track, but consumes significantly more memory.')}
        checked={playerState.fullQueueCacheEnabled}
        onToggle={() => playerState.setFullQueueCacheEnabled(!playerState.fullQueueCacheEnabled)}
        titleClassName="text-amber-300/90"
        descriptionClassName="text-amber-300/65"
      />

      {playerState.precalculateOnIdle && playerState.fullQueueCacheEnabled && (
        <QueuePrecalculatePanel playerState={playerState} />
      )}
    </AudioEffectPanel>
  );
}
