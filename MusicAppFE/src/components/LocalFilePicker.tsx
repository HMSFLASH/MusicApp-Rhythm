import { useRef, type ReactNode } from 'react';
import { FolderOpen } from 'lucide-react';
import { useGlobalAudio } from '../context/AudioContext';
import { useTranslation } from 'react-i18next';
import { AUDIO_EXTENSIONS } from '../hooks/audioMime';
import { useLocalFileImport } from './local-file-picker/useLocalFileImport';
import { useConfirm } from '../context/ConfirmContext';

type LocalPickerButtonProps = {
  label: ReactNode;
  hint?: ReactNode;
  onClick: () => void;
  iconClassName?: string;
};

function LocalPickerButton({
  label,
  hint,
  onClick,
  iconClassName,
}: LocalPickerButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 px-3 py-2.5 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors text-left w-full"
    >
      <FolderOpen size={20} className={iconClassName} />
      {hint ? (
        <span className="flex flex-col gap-0.5">
          <span>{label}</span>
          <span className="text-[11px] leading-snug text-amber-400/70">
            {hint}
          </span>
        </span>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}

export function LocalFilePicker() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const { playerState } = useGlobalAudio();
  const { playTrack, setCurrentTrack, setQueue } = playerState;
  const handleFiles = useLocalFileImport({ playTrack, setCurrentTrack, setQueue });

  const openLocalFolderPicker = async () => {
    const shouldContinue = await confirm({
      title: t('layout.playLocalFolderWarningTitle', 'Cảnh báo thư mục cục bộ'),
      description: t(
        'layout.playLocalFolderWarning',
        'Opening a large local folder can use a lot of CPU and RAM while scanning files and reading metadata. On weak devices, choose a smaller folder or disable heavy Audio Studio effects if playback crackles. Continue?'
      )
    });

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
