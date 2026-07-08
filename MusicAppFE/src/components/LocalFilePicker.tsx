import { useRef } from 'react';
import { FolderOpen } from 'lucide-react';
import { useGlobalAudio } from '../context/AudioContext';
import type { Track } from '../hooks/useAudioPlayer';
import { useTranslation } from 'react-i18next';

const AUDIO_EXTENSIONS = [
  '.mp3', '.m4a', '.flac', '.wav', '.ogg', '.opus', '.aac', '.wma',
];

function buildStubTrack(file: File): Track {
  const id = `local_${file.name}_${file.size}`;
  return {
    id,
    fileName: file.name,
    sourceType: 'LOCAL',
    localFile: file,
    title: file.name.replace(/\.[^/.]+$/, ''),
  };
}

export function LocalFilePicker() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { playerState } = useGlobalAudio();
  const { playTrack, setQueue } = playerState;

  const openLocalFolderPicker = () => {
    const shouldContinue = window.confirm(
      t(
        'layout.playLocalFolderWarning',
        'Opening a large local folder can use a lot of CPU and RAM while scanning files and reading metadata. On weak devices, choose a smaller folder or disable heavy Audio Studio effects if playback crackles. Continue?'
      )
    );

    if (!shouldContinue) return;
    folderInputRef.current!.value = '';
    folderInputRef.current!.click();
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const audioFiles = Array.from(files).filter(f =>
      AUDIO_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext))
    );
    if (audioFiles.length === 0) return;

    const tracks = audioFiles.map(buildStubTrack);
    // Play immediately — no blocking
    playTrack(tracks[0], tracks, true);

    // Enrich remaining queue tracks (skip tracks[0] — playTrack handles the currently playing track)
    const MIME_MAP: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', flac: 'audio/flac', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', aac: 'audio/aac', wma: 'audio/x-ms-wma' };
    tracks.slice(1).forEach(async (stub) => {
      try {
        const mm = await import('music-metadata-browser');
        const parseBufferFn = mm.parseBuffer || mm.default?.parseBuffer;
        if (!parseBufferFn) return;

        const arrayBuffer = await stub.localFile!.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        const ext = stub.fileName?.split('.').pop()?.toLowerCase();
        const mimeType = MIME_MAP[ext || ''] || stub.localFile!.type || 'audio/mpeg';

        let timeoutId: ReturnType<typeof setTimeout>;
        const parsePromise = parseBufferFn(buffer, mimeType, { duration: false });
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('timeout')), 10000);
        });
        const metadata = await Promise.race([parsePromise, timeoutPromise]).finally(() => clearTimeout(timeoutId!));

        const update: Partial<Track> = {};
        if (metadata.common.title) update.title = metadata.common.title;
        if (metadata.common.artist) update.artist = metadata.common.artist;
        if (metadata.common.album) update.album = metadata.common.album;
        if (metadata.common.genre?.length) update.genre = metadata.common.genre[0];
        if (metadata.format.duration) update.durationSeconds = metadata.format.duration;

        if (metadata.common.picture?.length) {
          const pic = metadata.common.picture[0];
          const fmt = pic.format || 'jpeg';
          const imgMime = fmt.startsWith('image/') ? fmt : `image/${fmt}`;
          update.imageUrl = URL.createObjectURL(new Blob([new Uint8Array(pic.data)], { type: imgMime }));
        }

        if (Object.keys(update).length === 0) return;

        // Update queue entry
        setQueue(prev => prev.map(t => t.id === stub.id ? { ...t, ...update } : t));
      } catch (e) {
        console.warn('Metadata skipped for', stub.fileName, e);
      }
    });
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={AUDIO_EXTENSIONS.join(',')}
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <input
        ref={folderInputRef}
        type="file"
        accept={AUDIO_EXTENSIONS.join(',')}
        multiple
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        webkitdirectory="true"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      <button
        onClick={() => { fileInputRef.current!.value = ''; fileInputRef.current!.click(); }}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors text-left w-full"
      >
        <FolderOpen size={20} />
        <span>{t('layout.playLocalFiles', 'Play Local Files')}</span>
      </button>

      <button
        onClick={openLocalFolderPicker}
        className="flex items-start gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors text-left w-full"
      >
        <FolderOpen size={20} className="text-primary/70 mt-0.5 shrink-0" />
        <span className="flex flex-col gap-0.5">
          <span>{t('layout.playLocalFolder', 'Play Local Folder')}</span>
          <span className="text-[11px] leading-snug text-amber-400/70">
            {t('layout.playLocalFolderHint', 'Large folders may be heavy on weak CPUs/RAM.')}
          </span>
        </span>
      </button>
    </>
  );
}
