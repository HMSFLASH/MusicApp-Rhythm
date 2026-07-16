import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { axiosClient } from '../api/axiosClient';

export type UploadTask = {
  id: string;
  file: File;
  mode: 'server' | 'direct';
  status: 'pending' | 'uploading' | 'success' | 'error' | 'skipped';
};

interface UploadContextType {
  uploadTasks: UploadTask[];
  isQueueOpen: boolean;
  setIsQueueOpen: (v: boolean) => void;
  queueFiles: (pendingFiles: File[], skippedFiles: File[]) => void;
  queueDirectFiles: (pendingFiles: File[], skippedFiles: File[]) => void;
  retryTask: (id: string) => void;
  clearCompletedTasks: () => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

type DriveUploadSession = {
  accessToken: string;
  folderName: string;
};

type DriveFileResponse = {
  id: string;
  name?: string;
};

const getAudioMimeType = (file: File) => {
  if (file.type) return file.type;
  const ext = file.name?.split('.').pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    flac: 'audio/flac',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    opus: 'audio/ogg',
    aac: 'audio/aac',
    wma: 'audio/x-ms-wma'
  };
  return mimeMap[ext || ''] || 'audio/mpeg';
};

const stripExtension = (fileName: string) => fileName.replace(/\.[^/.]+$/, '');
const DIRECT_UPLOAD_CONCURRENCY = 4;
const MAX_BACKEND_COVER_BYTES = 2 * 1024 * 1024;

const bytesToBase64 = (bytes: Uint8Array) => {
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

async function extractUploadMetadata(file: File) {
  try {
    const musicMetadata = await import('music-metadata');
    const parseBufferFn = musicMetadata.parseBuffer;
    if (!parseBufferFn) throw new Error('parseBuffer not found');

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);
    const metadata = await Promise.race([
      parseBufferFn(buffer, getAudioMimeType(file), { duration: false }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Metadata parse timeout (15s)')), 15000))
    ]);

    const extracted: Record<string, string> = {};
    if (metadata.common.title) extracted.title = metadata.common.title;
    if (metadata.common.artist) extracted.artist = metadata.common.artist;
    if (metadata.common.album) extracted.album = metadata.common.album;
    if (metadata.common.genre && metadata.common.genre.length > 0) extracted.genre = metadata.common.genre[0];

    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const pic = metadata.common.picture[0];
      if (pic.data.byteLength <= MAX_BACKEND_COVER_BYTES) {
        const format = pic.format?.startsWith('image/') ? pic.format : `image/${pic.format || 'jpeg'}`;
        extracted.imageUrl = `data:${format};base64,${bytesToBase64(new Uint8Array(pic.data))}`;
      }
    }

    if (metadata.common.lyrics && metadata.common.lyrics.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extracted.lyrics = metadata.common.lyrics.map((l: any) => typeof l === 'string' ? l : (l.text || JSON.stringify(l))).join('\n\n');
    }

    return extracted;
  } catch (error) {
    console.warn('[Upload] Metadata extraction skipped', error);
    return {};
  }
}

const escapeDriveQueryValue = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function fetchDriveJson<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(url, {
    ...init,
    headers
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Google Drive request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function getOrCreateDriveFolder(accessToken: string, folderName: string) {
  const query = `mimeType='application/vnd.google-apps.folder' and name='${escapeDriveQueryValue(folderName)}' and trashed=false`;
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=drive&fields=files(id,name)&pageSize=1`;
  const listResult = await fetchDriveJson<{ files?: DriveFileResponse[] }>(listUrl, accessToken);
  const existingFolder = listResult.files?.[0];
  if (existingFolder?.id) return existingFolder.id;

  const createdFolder = await fetchDriveJson<DriveFileResponse>(
    'https://www.googleapis.com/drive/v3/files?fields=id',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      })
    }
  );

  return createdFolder.id;
}

async function uploadFileDirectlyToDrive(file: File, session: DriveUploadSession) {
  const folderId = await getOrCreateDriveFolder(session.accessToken, session.folderName || 'MusicApp');
  const boundary = `musicapp_drive_upload_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const metadata = {
    name: file.name,
    parents: [folderId],
    mimeType: getAudioMimeType(file)
  };
  const body = new Blob([
    `--${boundary}\r\n`,
    'Content-Type: application/json; charset=UTF-8\r\n\r\n',
    JSON.stringify(metadata),
    `\r\n--${boundary}\r\n`,
    `Content-Type: ${getAudioMimeType(file)}\r\n\r\n`,
    file,
    `\r\n--${boundary}--`
  ]);

  return fetchDriveJson<DriveFileResponse>(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name',
    session.accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body
    }
  );
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const uploadQueueRef = useRef<UploadTask[]>([]);
  const isServerProcessingRef = useRef(false);
  const directActiveCountRef = useRef(0);
  const autoClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  const clearAutoClearTimer = () => {
    if (autoClearTimerRef.current) {
      clearTimeout(autoClearTimerRef.current);
      autoClearTimerRef.current = null;
    }
  };

  const hasActiveTasks = () =>
    uploadQueueRef.current.some(t => t.status === 'pending' || t.status === 'uploading');

  const clearFinishedTasks = () => {
    uploadQueueRef.current = uploadQueueRef.current.filter(t => t.status === 'error');
    setUploadTasks([...uploadQueueRef.current]);
    if (uploadQueueRef.current.length === 0) {
      setIsQueueOpen(false);
    }
  };

  const scheduleAutoClearFinishedTasks = () => {
    clearAutoClearTimer();
    if (hasActiveTasks()) return;

    const hasFinishedTasks = uploadQueueRef.current.some(t => t.status === 'success' || t.status === 'skipped');
    if (!hasFinishedTasks) return;

    autoClearTimerRef.current = setTimeout(() => {
      clearFinishedTasks();
      autoClearTimerRef.current = null;
    }, 2500);
  };

  useEffect(() => () => clearAutoClearTimer(), []);

  const uploadDirectTask = async (file: File) => {
    const session = await axiosClient.get('/api/music/drive-upload-session') as DriveUploadSession;
    const extractedMetadata = await extractUploadMetadata(file);
    const driveFile = await uploadFileDirectlyToDrive(file, session);

    await axiosClient.post('/api/music/direct-upload/register', {
      driveFileId: driveFile.id,
      fileName: driveFile.name || file.name,
      title: extractedMetadata.title || stripExtension(driveFile.name || file.name),
      artist: extractedMetadata.artist,
      album: extractedMetadata.album,
      genre: extractedMetadata.genre,
      imageUrl: extractedMetadata.imageUrl,
      lyrics: extractedMetadata.lyrics
    });
  };

  const uploadServerTask = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    // Parse metadata with a timeout to prevent hanging.
    try {
      const musicMetadata = await import('music-metadata');
      const parseBufferFn = musicMetadata.parseBuffer;
      if (!parseBufferFn) throw new Error('parseBuffer not found');

      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      const metadata = await Promise.race([
        parseBufferFn(buffer, getAudioMimeType(file), { duration: false }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Metadata parse timeout (15s)')), 15000))
      ]);

      if (metadata.common.title) formData.append('title', metadata.common.title);
      if (metadata.common.artist) formData.append('artist', metadata.common.artist);
      if (metadata.common.album) formData.append('album', metadata.common.album);
      if (metadata.common.genre && metadata.common.genre.length > 0) formData.append('genre', metadata.common.genre[0]);
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const pic = metadata.common.picture[0];
        if (pic.data.byteLength <= MAX_BACKEND_COVER_BYTES) {
          const format = pic.format?.startsWith('image/') ? pic.format : `image/${pic.format || 'jpeg'}`;
          formData.append('imageUrl', `data:${format};base64,${bytesToBase64(new Uint8Array(pic.data))}`);
        }
      }

      let extractedLyrics = '';
      if (metadata.common.lyrics && metadata.common.lyrics.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        extractedLyrics = metadata.common.lyrics.map((l: any) => typeof l === 'string' ? l : (l.text || JSON.stringify(l))).join('\n\n');
      }
      if (!extractedLyrics && metadata.native) {
        for (const tagType in metadata.native) {
          const tags = metadata.native[tagType];
          if (Array.isArray(tags)) {
            const lyricTag = tags.find((t: any) => t.id?.toLowerCase().includes('lyric') || t.id === 'USLT' || t.id === 'SYLT');
            if (lyricTag && lyricTag.value) {
              const lyricValue = lyricTag.value as string | { text?: string };
              extractedLyrics = typeof lyricValue === 'string' ? lyricValue : (lyricValue.text || JSON.stringify(lyricValue));
              break;
            }
          }
        }
      }
      if (extractedLyrics) {
        formData.append('lyrics', extractedLyrics);
      }
    } catch (err) {
      console.warn(`[Upload] Metadata parse skipped for ${file.name}:`, err);
    }

    await axiosClient.post('/api/music/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 5 * 60 * 1000, // 5 minutes timeout for large files
    });
  };

  const finishTask = (taskId: string, status: UploadTask['status']) => {
    const currentIndex = uploadQueueRef.current.findIndex(t => t.id === taskId);
    if (currentIndex !== -1) {
      uploadQueueRef.current[currentIndex].status = status;
    }
    setUploadTasks([...uploadQueueRef.current]);
    if (status === 'success') {
      window.dispatchEvent(new CustomEvent('music-uploaded'));
    }
    scheduleAutoClearFinishedTasks();
  };

  const processServerQueue = async () => {
    if (isServerProcessingRef.current) return;
    isServerProcessingRef.current = true;

    try {
      while (uploadQueueRef.current.some(t => t.mode === 'server' && t.status === 'pending')) {
        const taskIndex = uploadQueueRef.current.findIndex(t => t.mode === 'server' && t.status === 'pending');
        if (taskIndex === -1) break;

        const task = uploadQueueRef.current[taskIndex];
        uploadQueueRef.current[taskIndex].status = 'uploading';
        setUploadTasks([...uploadQueueRef.current]);

        try {
          await uploadServerTask(task.file);
          finishTask(task.id, 'success');
        } catch (e: any) {
          console.error(`Error uploading ${task.file.name}:`, e);
          if (e?.message === 'File already exists in library' || e?.response?.data?.message === 'File already exists in library' || e?.response?.status === 409) {
            finishTask(task.id, 'skipped');
          } else {
            finishTask(task.id, 'error');
          }
        }
      }
    } finally {
      isServerProcessingRef.current = false;
      scheduleAutoClearFinishedTasks();
    }
  };

  const processDirectQueue = () => {
    while (directActiveCountRef.current < DIRECT_UPLOAD_CONCURRENCY) {
      const taskIndex = uploadQueueRef.current.findIndex(t => t.mode === 'direct' && t.status === 'pending');
      if (taskIndex === -1) break;

      const task = uploadQueueRef.current[taskIndex];
      uploadQueueRef.current[taskIndex].status = 'uploading';
      directActiveCountRef.current += 1;
      setUploadTasks([...uploadQueueRef.current]);

      void uploadDirectTask(task.file)
        .then(() => finishTask(task.id, 'success'))
        .catch((e: any) => {
          console.error(`Error uploading ${task.file.name}:`, e);
          if (e?.message === 'File already exists in library' || e?.response?.data?.message === 'File already exists in library' || e?.response?.status === 409) {
            finishTask(task.id, 'skipped');
          } else {
            finishTask(task.id, 'error');
          }
        })
        .finally(() => {
          directActiveCountRef.current = Math.max(0, directActiveCountRef.current - 1);
          processDirectQueue();
          scheduleAutoClearFinishedTasks();
        });
    }
  };

  const processUploadQueues = () => {
    void processServerQueue();
    processDirectQueue();
  };

  const queueFiles = (pendingFiles: File[], skippedFiles: File[]) => {
    clearAutoClearTimer();
    const pendingTasks = pendingFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      mode: 'server' as const,
      status: 'pending' as const
    }));
    const skippedTasks = skippedFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      mode: 'server' as const,
      status: 'skipped' as const
    }));

    uploadQueueRef.current = [...uploadQueueRef.current, ...pendingTasks, ...skippedTasks];
    setUploadTasks([...uploadQueueRef.current]);
    setIsQueueOpen(true);
    scheduleAutoClearFinishedTasks();
    processUploadQueues();
  };

  const queueDirectFiles = (pendingFiles: File[], skippedFiles: File[]) => {
    clearAutoClearTimer();
    const pendingTasks = pendingFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      mode: 'direct' as const,
      status: 'pending' as const
    }));
    const skippedTasks = skippedFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      mode: 'direct' as const,
      status: 'skipped' as const
    }));

    uploadQueueRef.current = [...uploadQueueRef.current, ...pendingTasks, ...skippedTasks];
    setUploadTasks([...uploadQueueRef.current]);
    setIsQueueOpen(true);
    scheduleAutoClearFinishedTasks();
    processUploadQueues();
  };

  const retryTask = (id: string) => {
    clearAutoClearTimer();
    const taskIndex = uploadQueueRef.current.findIndex(t => t.id === id);
    if (taskIndex !== -1) {
      uploadQueueRef.current[taskIndex].status = 'pending';
      setUploadTasks([...uploadQueueRef.current]);
      processUploadQueues();
    }
  };

  const clearCompletedTasks = () => {
    clearAutoClearTimer();
    uploadQueueRef.current = uploadQueueRef.current.filter(t => t.status === 'pending' || t.status === 'uploading' || t.status === 'error');
    setUploadTasks([...uploadQueueRef.current]);
    if (uploadQueueRef.current.length === 0) setIsQueueOpen(false);
  };

  return (
    <UploadContext.Provider value={{ uploadTasks, isQueueOpen, setIsQueueOpen, queueFiles, queueDirectFiles, retryTask, clearCompletedTasks }}>
      {children}
    </UploadContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useUploadQueue = () => {
  const context = useContext(UploadContext);
  if (!context) throw new Error('useUploadQueue must be used within UploadProvider');
  return context;
};
