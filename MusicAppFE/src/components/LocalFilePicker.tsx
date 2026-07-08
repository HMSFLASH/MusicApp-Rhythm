import { useRef } from 'react';
import { FolderOpen } from 'lucide-react';
import { useGlobalAudio } from '../context/AudioContext';
import { useTranslation } from 'react-i18next';
import { AUDIO_EXTENSIONS } from '../hooks/audioMime';
import { buildLocalTrackStub, filterAudioFiles, readLocalTrackMetadata } from '../utils/localAudioFiles';

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

    const audioFiles = filterAudioFiles(files);
    if (audioFiles.length === 0) return;

    const tracks = audioFiles.map(buildLocalTrackStub);
    // Play immediately — no blocking
    playTrack(tracks[0], tracks, true);

    // Enrich remaining queue tracks (skip tracks[0] — playTrack handles the currently playing track)
    tracks.slice(1).forEach(async (stub) => {
      try {
        const update = await readLocalTrackMetadata(stub);
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
