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
    { label: t('studio.masterOutput.fft256', '256 (Siêu nhẹ / Đồ thị thô / Dành cho máy rất yếu)'), value: 256 },
    { label: t('studio.masterOutput.fft512', '512 (Nhẹ CPU / Đồ thị kém chi tiết)'), value: 512 },
    { label: t('studio.masterOutput.fft1024', '1024 (Trung bình / Phù hợp máy yếu)'), value: 1024 },
    { label: t('studio.masterOutput.fft2048', '2048 (Tối ưu / Khuyên dùng cho đa số thiết bị)'), value: 2048 },
    { label: t('studio.masterOutput.fft4096', '4096 (Cao / Đồ thị sắc nét / Tốn thêm CPU)'), value: 4096 },
    { label: t('studio.masterOutput.fft8192', '8192 (Rất cao / Đồ thị rất mượt / Nặng CPU)'), value: 8192 },
    { label: t('studio.masterOutput.fft16384', '16384 (Tối đa / Đồ thị cực nét / Rất nặng CPU)'), value: 16384 },
  ];

  const latencyOptions: { label: string; value: AudioContextLatencyCategory }[] = [
    { label: t('studio.masterOutput.latencyInteractive', 'Interactive (Độ trễ thấp nhất / Dễ bị giật tiếng trên máy yếu)'), value: 'interactive' },
    { label: t('studio.masterOutput.latencyBalanced', 'Balanced (Cân bằng giữa độ trễ và hiệu năng)'), value: 'balanced' },
    { label: t('studio.masterOutput.latencyPlayback', 'Playback (Độ trễ cao / An toàn nhất / Không lo giật tiếng)'), value: 'playback' },
  ];

  return (
    <AudioEffectPanel
      title={t('studio.masterOutput.title', 'Master Output')}
      description={t('studio.masterOutput.desc', 'Final stage output controls, latency buffer and panning.')}
      leading={(
        <EffectPowerButton
          active={playerState.fxEnabled.master}
          onClick={() => playerState.toggleFx('master')}
          activeClassName="bg-white/20 text-white shadow-[0_0_15px_rgba(255,255,255,0.4)] border border-white/30"
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
          color="#00f5ff"
          unit="%"
        />
      </EffectControlsGate>

      <AudioSelectRow<number>
        title={t('studio.masterOutput.analyserFftTitle', 'Độ phân giải Master Analyser (FFT Size)')}
        description={t('studio.masterOutput.analyserFftDesc', 'Quyết định độ nét của biểu đồ tần số. Tăng lên để biểu đồ mịn và chi tiết hơn, hoặc giảm xuống (256 - 1024) nếu máy yếu để tiết kiệm CPU và tránh giật lag.')}
        value={playerState.masterFftSize || 2048}
        options={fftSizeOptions}
        onChange={(val) => playerState.updateMasterFftSize(val)}
      />

      <AudioSelectRow<AudioContextLatencyCategory>
        title={t('studio.masterOutput.latencyTitle', 'Audio Buffer Size (Latency Mode)')}
        description={t('studio.masterOutput.latencyDesc', 'Tương tự Block Size trong DAW. Quyết định kích thước bộ đệm âm thanh. Nên chọn Playback để máy có nhiều thời gian xử lý EQ, tránh bị nổ tiếng/ngắt quãng. (Lưu ý: Thay đổi chỉ áp dụng khi tải lại trang (F5)).')}
        value={playerState.audioLatencyHint || 'playback'}
        options={latencyOptions}
        onChange={(val) => playerState.updateAudioLatencyHint(val)}
      />

      <AudioToggleRow
        title={t('studio.dynamics.limiterTitle', 'Anti-Clipping Master Limiter')}
        description={t('studio.dynamics.limiterDesc', 'Catches final output peaks after soft clipping, reducing crackling when EQ, preamp, or effects raise the level. Recommended to leave on if CPU is powerful enough.')}
        checked={playerState.fxEnabled.limiter}
        onToggle={() => playerState.toggleFx('limiter')}
      />

      <AudioToggleRow
        title={t('studio.masterOutput.hqOversample', 'High Quality Oversampling')}
        description={t('studio.masterOutput.hqOversampleDesc', 'Uses a 4x FIR oversampled soft clipper to reduce clipping aliasing. May be heavy on weak phones.')}
        checked={playerState.useOversample}
        onToggle={playerState.toggleUseOversample}
        disabled={!playerState.fxEnabled.limiter}
      />

      <AudioToggleRow
        title={t('studio.masterOutput.loudnessNorm', 'Loudness Normalization')}
        description={t('studio.masterOutput.loudnessDesc', 'Measures each track and applies fixed LUFS gain with peak-safe headroom. Best quality when pre-calculation is enabled.')}
        checked={playerState.loudnessNormalization}
        onToggle={playerState.toggleLoudnessNormalization}
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
