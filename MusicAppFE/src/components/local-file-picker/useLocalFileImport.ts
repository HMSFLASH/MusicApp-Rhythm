import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Track } from '../../hooks/audioTypes';
import {
  buildLocalTrackStub,
  filterAudioFiles,
  readLocalTrackMetadata,
} from '../../utils/localAudioFiles';

type UseLocalFileImportOptions = {
  playTrack: (track: Track, queue: Track[], autoPlay?: boolean) => void;
  setQueue: Dispatch<SetStateAction<Track[]>>;
};

export function useLocalFileImport({
  playTrack,
  setQueue,
}: UseLocalFileImportOptions) {
  return useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const audioFiles = filterAudioFiles(files);
    if (audioFiles.length === 0) return;

    const tracks = audioFiles.map(buildLocalTrackStub);
    playTrack(tracks[0], tracks, true);

    tracks.slice(1).forEach(async (stub) => {
      try {
        const update = await readLocalTrackMetadata(stub);
        if (Object.keys(update).length === 0) return;

        setQueue((previousQueue) => (
          previousQueue.map((track) => (
            track.id === stub.id ? { ...track, ...update } : track
          ))
        ));
      } catch (e) {
        console.warn('Metadata skipped for', stub.fileName, e);
      }
    });
  }, [playTrack, setQueue]);
}
