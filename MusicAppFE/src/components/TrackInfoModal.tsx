import React from 'react';
import { X, Info } from 'lucide-react';
import type { Track } from '../hooks/audioTypes';

interface TrackInfoModalProps {
  readonly track: Track;
  readonly trackMetadata?: Partial<Track>;
  readonly onClose: () => void;
}

export function TrackInfoModal({ track, trackMetadata, onClose }: TrackInfoModalProps) {
  if (!track) return null;

  const fileSize = track.fileSize ?? trackMetadata?.fileSize;
  const bitrate = track.bitrate ?? trackMetadata?.bitrate;
  const channels = track.numberOfChannels ?? trackMetadata?.numberOfChannels;
  const sampleRate = track.sampleRate ?? trackMetadata?.sampleRate;
  const bitsPerSample = track.bitsPerSample ?? trackMetadata?.bitsPerSample;
  
  const durationSeconds = track.durationSeconds ?? trackMetadata?.durationSeconds;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const channelText = channels ? (channels === 2 ? `${channels} (stereo)` : `${channels}`) : null;

  const items = [
    { label: 'Title', value: track.title || trackMetadata?.title },
    { label: 'Artist', value: track.artist || trackMetadata?.artist },
    { label: 'Album', value: track.album || trackMetadata?.album },
    { label: 'Genre', value: track.genre || trackMetadata?.genre },
    { label: 'Duration', value: durationSeconds ? `${Math.floor(durationSeconds / 60)}:${Math.floor(durationSeconds % 60).toString().padStart(2, '0')}` : null },
    { label: 'Play Count', value: `${track.playCount ?? 0}` },
    { label: 'File Name', value: track.fileName },
    { label: 'Source', value: track.sourceType },
    { label: 'Track ID', value: String(track.id) },
    { label: 'File Type', value: track.fileFormat || trackMetadata?.fileFormat },
    { label: 'Codec', value: track.codec || trackMetadata?.codec },
    { label: 'Size', value: fileSize ? `${(fileSize / 1024 / 1024).toFixed(2)} MB` : null },
    { label: 'Bit Rate', value: bitrate ? `${Math.round(bitrate / 1000)} kbps` : null },
    { label: 'Channels', value: channelText },
    { label: 'Audio Sample Rate', value: sampleRate ? `${(sampleRate / 1000).toFixed(3)} kHz` : null },
    { label: 'Bit Depth', value: bitsPerSample ? `${bitsPerSample} bit` : null }
  ];

  return (
    <div 
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div 
        className="bg-[#0c1626]/95 border border-white/[0.1] rounded-3xl w-full max-w-md overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.7)] animate-in zoom-in-95 duration-200 backdrop-blur-2xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <Info size={20} className="text-primary" />
            <h2 className="text-base sm:text-lg font-bold font-display text-white tracking-tight">Track Information</h2>
          </div>
          <button 
            aria-label="Close info"
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-white/[0.08] p-1.5 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar flex-1">
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4 flex flex-col gap-3">
            {items.map((item) => (
              <div key={item.label} className="flex flex-col gap-0.5 border-b border-white/[0.04] pb-2.5 last:border-0 last:pb-0">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono font-semibold">{item.label}</span>
                <span className="text-xs text-slate-200 font-medium break-all">
                  {item.value || <span className="text-slate-500 italic">Unknown</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
