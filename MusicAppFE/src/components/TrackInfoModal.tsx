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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div 
        className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <Info size={24} className="text-[#00E5FF]" />
            <h2 className="text-xl font-bold text-white tracking-tight">Track Information</h2>
          </div>
          <button 
            aria-label="Close info"
            onClick={onClose}
            className="text-white/40 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.label} className="flex flex-col sm:flex-row sm:items-center py-2 border-b border-white/5 last:border-0">
                <span className="text-white/40 text-sm w-1/3 mb-1 sm:mb-0">{item.label}</span>
                <span className="text-white text-sm font-medium w-2/3 break-words">
                  {item.value || <span className="text-white/20 italic">Unknown</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
