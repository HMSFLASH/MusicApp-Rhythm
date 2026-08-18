import React, { useState } from 'react';
import { X, Info, Tag, Image as ImageIcon, Plus, Trash2, Check, Copy, Music } from 'lucide-react';
import type { Track } from '../hooks/audioTypes';
import { useToast } from '../context/ToastContext';

interface TrackInfoModalProps {
  readonly track: Track;
  readonly trackMetadata?: Partial<Track> | null;
  readonly onClose: () => void;
  readonly onUpdateMetadata?: (updatedTags: Record<string, string>) => void;
}

export function TrackInfoModal({ track, trackMetadata, onClose, onUpdateMetadata }: TrackInfoModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'details' | 'metadata' | 'cover'>('details');

  if (!track) return null;

  const fileSize = track.fileSize ?? trackMetadata?.fileSize;
  const bitrate = track.bitrate ?? trackMetadata?.bitrate;
  const channels = track.numberOfChannels ?? trackMetadata?.numberOfChannels;
  const sampleRate = track.sampleRate ?? trackMetadata?.sampleRate;
  const bitsPerSample = track.bitsPerSample ?? trackMetadata?.bitsPerSample;
  const durationSeconds = track.durationSeconds ?? trackMetadata?.durationSeconds;
  const isLossless = (track.fileFormat?.toLowerCase() === 'flac' || track.fileFormat?.toLowerCase() === 'wav');

  // Metadata Key-Value state
  const [tags, setTags] = useState<{ key: string; value: string; isNew?: boolean }[]>([
    { key: 'TITLE', value: track.title || trackMetadata?.title || '' },
    { key: 'ARTIST', value: track.artist || trackMetadata?.artist || '' },
    { key: 'ALBUM', value: track.album || trackMetadata?.album || '' },
    { key: 'GENRE', value: track.genre || trackMetadata?.genre || 'Music' },
    { key: 'DURATION', value: durationSeconds ? `${Math.floor(durationSeconds / 60)}:${Math.floor(durationSeconds % 60).toString().padStart(2, '0')}` : '0:00' },
    { key: 'FILE_NAME', value: track.fileName || '' },
    { key: 'SOURCE_TYPE', value: track.sourceType || 'LOCAL' },
    { key: 'BITRATE', value: bitrate ? `${Math.round(bitrate / 1000)} kbps` : '320 kbps' },
    { key: 'SAMPLE_RATE', value: sampleRate ? `${sampleRate} Hz` : '44100 Hz' },
    { key: 'CHANNELS', value: channels === 2 ? '2 (Stereo)' : `${channels || 2}` },
    { key: 'CONTAINER', value: track.fileFormat?.toUpperCase() || track.codec?.toUpperCase() || 'AUDIO' },
  ]);

  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(track.imageUrl || null);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB (${bytes.toLocaleString()} bytes)`;
  };

  const handleCopyPath = () => {
    if (track.fileName) {
      navigator.clipboard.writeText(track.fileName);
      toast.success('Đã sao chép tên file!');
    }
  };

  const handleAddTag = () => {
    if (!newKey.trim()) {
      toast.info('Vui lòng nhập tên Key!');
      return;
    }
    setTags(prev => [...prev, { key: newKey.trim().toUpperCase(), value: newValue.trim(), isNew: true }]);
    setNewKey('');
    setNewValue('');
    toast.success(`Đã thêm cặp key: ${newKey.toUpperCase()}`);
  };

  const handleRemoveTag = (index: number) => {
    setTags(prev => prev.filter((_, i) => i !== index));
    toast.info('Đã xóa cặp Key-Value');
  };

  const handleUpdateTagValue = (index: number, val: string) => {
    setTags(prev => prev.map((t, i) => i === index ? { ...t, value: val } : t));
  };

  const handleSaveTags = () => {
    const record: Record<string, string> = {};
    tags.forEach(t => {
      if (t.key) record[t.key] = t.value;
    });
    if (onUpdateMetadata) {
      onUpdateMetadata(record);
    }
    toast.success('Đã cập nhật toàn bộ Metadata thành công!');
  };

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setCoverUrl(result);
        toast.success('Đã tải lên ảnh bìa mới!');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const technicalItems = [
    { label: 'Tên Tệp / Đường Dẫn', value: track.fileName || track.title || track.id, full: true, canCopy: true },
    { label: 'Định Dạng Âm Thanh', value: track.fileFormat ? track.fileFormat.toUpperCase() : 'N/A' },
    { label: 'Codec Giải Mã', value: track.codec || trackMetadata?.codec || 'PCM / Direct' },
    { label: 'Chế Độ Mã Hóa', value: isLossless ? 'Lossless PCM / Hi-Res' : 'Lossy VBR/CBR' },
    { label: 'Tốc Độ Bit (Bitrate)', value: bitrate ? `${Math.round(bitrate / 1000)} kbps` : 'N/A' },
    { label: 'Tần Số Lấy Mẫu (Sample Rate)', value: sampleRate ? `${sampleRate >= 1000 ? `${(sampleRate / 1000).toFixed(3)} kHz` : `${sampleRate} Hz`}` : 'N/A' },
    { label: 'Độ Sâu Bit (Bit Depth)', value: bitsPerSample ? `${bitsPerSample}-bit` : (isLossless ? '24-bit (Hi-Res)' : '16-bit') },
    { label: 'Kênh Âm Thanh', value: channels ? (channels === 1 ? '1 (Mono)' : channels === 2 ? '2 (Stereo)' : `${channels} Channels`) : '2 (Stereo)' },
    { label: 'Dung Lượng Tệp', value: formatFileSize(fileSize) },
    { label: 'Thời Lượng Bài Hát', value: durationSeconds ? `${Math.floor(durationSeconds / 60)}:${Math.floor(durationSeconds % 60).toString().padStart(2, '0')} (${durationSeconds}s)` : 'N/A' },
    { label: 'Bộ Xử Lý Phần Cứng', value: 'Direct DAC Audio Offload / WebAudio DSP' },
  ];

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div 
        className="bg-[#0c1626]/98 border border-white/[0.12] rounded-3xl w-full max-w-xl overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.85)] animate-in zoom-in-95 duration-200 backdrop-blur-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Music size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-display text-white tracking-tight leading-none">
                Chi Tiết & Quản Lý Bài Hát
              </h2>
              <p className="text-xs text-slate-400 mt-1 line-clamp-1">{track.title} • {track.artist}</p>
            </div>
          </div>
          <button 
            aria-label="Đóng"
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-white/[0.08] p-2 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-white/[0.08] bg-black/20 px-6 pt-2">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'details'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Info size={15} />
            Thông Số Kỹ Thuật
          </button>

          <button
            onClick={() => setActiveTab('metadata')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'metadata'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Tag size={15} />
            Sửa Metadata (Key-Value)
          </button>

          <button
            onClick={() => setActiveTab('cover')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'cover'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon size={15} />
            Ảnh Bìa
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto no-scrollbar flex-1">
          {/* TAB 1: DETAILS */}
          {activeTab === 'details' && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {technicalItems.map((item, idx) => (
                  <div 
                    key={idx} 
                    className={`bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 flex flex-col justify-between ${
                      item.full ? 'sm:col-span-2' : ''
                    }`}
                  >
                    <span className="text-[11px] font-medium text-slate-400 tracking-wide">{item.label}</span>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-xs font-semibold text-slate-100 break-all">{item.value}</span>
                      {item.canCopy && (
                        <button
                          onClick={handleCopyPath}
                          title="Sao chép tên file"
                          className="p-1 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-white/[0.08] transition-colors"
                        >
                          <Copy size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: METADATA KEY-VALUE */}
          {activeTab === 'metadata' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">Danh Sách Cặp Thẻ Key - Value ({tags.length})</span>
                <button
                  onClick={handleSaveTags}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-semibold transition-all shadow-[0_0_15px_rgba(0,245,255,0.2)]"
                >
                  <Check size={14} />
                  Lưu Thay Đổi
                </button>
              </div>

              <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto no-scrollbar pr-1">
                {tags.map((t, index) => (
                  <div key={index} className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] p-2 rounded-xl">
                    <div className="w-28 flex-shrink-0">
                      <span className="text-[10px] font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-md border border-cyan-500/20 block truncate">
                        {t.key}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={t.value}
                      onChange={(e) => handleUpdateTagValue(index, e.target.value)}
                      className="flex-1 bg-black/40 border border-white/[0.08] text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500/50"
                      placeholder="Giá trị tag..."
                    />
                    <button
                      onClick={() => handleRemoveTag(index)}
                      className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
                      title="Xóa tag"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add New Key-Value */}
              <div className="bg-black/30 border border-white/[0.08] p-3 rounded-2xl flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                  <Plus size={13} className="text-cyan-400" /> Thêm Cặp Key-Value Mới
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="Tên Key (VD: COMPOSER)..."
                    className="w-1/3 bg-black/50 border border-white/[0.1] text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500/50 uppercase"
                  />
                  <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="Giá trị..."
                    className="flex-1 bg-black/50 border border-white/[0.1] text-white text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-3 py-1.5 bg-cyan-500 text-black font-bold text-xs rounded-lg hover:bg-cyan-400 transition-colors"
                  >
                    Thêm
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COVER ART */}
          {activeTab === 'cover' && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="w-44 h-44 rounded-2xl overflow-hidden bg-black/40 border border-white/[0.12] shadow-2xl relative group flex items-center justify-center">
                {coverUrl ? (
                  <img src={coverUrl} alt="Cover Art" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <ImageIcon size={40} />
                    <span className="text-[11px]">Chưa có ảnh bìa</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <label className="cursor-pointer px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-semibold transition-all shadow-[0_0_15px_rgba(0,245,255,0.2)]">
                  Thay Ảnh Mới
                  <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                </label>
                {coverUrl && (
                  <button
                    onClick={() => {
                      setCoverUrl(null);
                      toast.info('Đã xóa ảnh bìa!');
                    }}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Xóa Ảnh Bìa
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
