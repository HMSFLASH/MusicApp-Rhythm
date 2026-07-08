import { useRef } from 'react';
import { useGlobalAudio } from '../context/AudioContext';
import { useTranslation } from 'react-i18next';
import { AUDIO_EXTENSIONS } from '../hooks/audioMime';
import { LocalPickerButton } from './local-file-picker/LocalPickerButton';
import { useLocalFileImport } from './local-file-picker/useLocalFileImport';

export function LocalFilePicker() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { playerState } = useGlobalAudio();
  const { playTrack, setQueue } = playerState;
  const handleFiles = useLocalFileImport({ playTrack, setQueue });

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

      <LocalPickerButton
        onClick={() => { fileInputRef.current!.value = ''; fileInputRef.current!.click(); }}
        label={t('layout.playLocalFiles', 'Play Local Files')}
      />

      <LocalPickerButton
        onClick={openLocalFolderPicker}
        label={t('layout.playLocalFolder', 'Play Local Folder')}
        hint={t('layout.playLocalFolderHint', 'Large folders may be heavy on weak CPUs/RAM.')}
        iconClassName="text-primary/70 mt-0.5 shrink-0"
      />
    </>
  );
}
