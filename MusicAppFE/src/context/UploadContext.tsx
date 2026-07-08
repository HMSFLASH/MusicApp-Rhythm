import { createContext, useContext, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { axiosClient } from '../api/axiosClient';

export type UploadTask = {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'skipped';
};

interface UploadContextType {
  uploadTasks: UploadTask[];
  isQueueOpen: boolean;
  setIsQueueOpen: (v: boolean) => void;
  queueFiles: (pendingFiles: File[], skippedFiles: File[]) => void;
  retryTask: (id: string) => void;
  clearCompletedTasks: () => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export function UploadProvider({ children }: { children: ReactNode }) {
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const uploadQueueRef = useRef<UploadTask[]>([]);
  const isProcessingRef = useRef(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  const processQueue = async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    try {
      while (uploadQueueRef.current.some(t => t.status === 'pending')) {
        const taskIndex = uploadQueueRef.current.findIndex(t => t.status === 'pending');
        if (taskIndex === -1) break;
        
        const nextTask = uploadQueueRef.current[taskIndex];
        const taskId = nextTask.id;
        const file = nextTask.file;
        
        uploadQueueRef.current[taskIndex].status = 'uploading';
        setUploadTasks([...uploadQueueRef.current]);

        const formData = new FormData();
        formData.append('file', file);
        
        // Parse metadata with a timeout to prevent hanging
        try {
          const musicMetadata = await import('music-metadata-browser');
          const parseBufferFn = musicMetadata.parseBuffer || musicMetadata.default?.parseBuffer;
          if (!parseBufferFn) throw new Error('parseBuffer not found');

          const arrayBuffer = await file.arrayBuffer();
          const buffer = new Uint8Array(arrayBuffer);
          const ext = file.name?.split('.').pop()?.toLowerCase();
          const mimeMap: Record<string, string> = { mp3: 'audio/mpeg', m4a: 'audio/mp4', flac: 'audio/flac', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', aac: 'audio/aac', wma: 'audio/x-ms-wma' };
          const mimeType = mimeMap[ext || ''] || file.type || 'audio/mpeg';

          let timeoutId: ReturnType<typeof setTimeout>;
          const parsePromise = parseBufferFn(buffer, mimeType, { duration: false });
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error('Metadata parse timeout (15s)')), 15000);
          });
          const metadata = await Promise.race([parsePromise, timeoutPromise]).finally(() => clearTimeout(timeoutId!));
          
          console.log(`[Upload] Metadata parsed for ${file.name}:`, metadata.common.title, metadata.common.artist);
          if (metadata.common.title) formData.append('title', metadata.common.title);
          if (metadata.common.artist) formData.append('artist', metadata.common.artist);
          if (metadata.common.album) formData.append('album', metadata.common.album);
          if (metadata.common.genre && metadata.common.genre.length > 0) formData.append('genre', metadata.common.genre[0]);
          if (metadata.common.picture && metadata.common.picture.length > 0) {
            const pic = metadata.common.picture[0];
            // Limit cover art size to 500KB to avoid bloating the request
            if (pic.data.byteLength < 500 * 1024) {
              const bytes = new Uint8Array(pic.data);
              const chunkSize = 8192;
              let binary = '';
              for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
                binary += String.fromCharCode(...chunk);
              }
              const base64String = btoa(binary);
              formData.append('imageUrl', `data:${pic.format};base64,${base64String}`);
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
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const lyricTag = tags.find((t: any) => t.id === 'USLT' || t.id === 'SYLT' || t.id === 'LYRICS' || t.id === 'WM/Lyrics');
                        if (lyricTag && lyricTag.value) {
                            extractedLyrics = typeof lyricTag.value === 'string' ? lyricTag.value : (lyricTag.value.text || JSON.stringify(lyricTag.value));
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

        try {
          await axiosClient.post('/api/music/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 5 * 60 * 1000, // 5 minutes timeout for large files
          });
          const currentIndex = uploadQueueRef.current.findIndex(t => t.id === taskId);
          if (currentIndex !== -1) {
            uploadQueueRef.current[currentIndex].status = 'success';
          }
          window.dispatchEvent(new CustomEvent('music-uploaded'));
        } catch (e) {
          console.error(`Error uploading ${file.name}:`, e);
          const currentIndex = uploadQueueRef.current.findIndex(t => t.id === taskId);
          if (currentIndex !== -1) {
            uploadQueueRef.current[currentIndex].status = 'error';
          }
        }
        setUploadTasks([...uploadQueueRef.current]);
      }
    } finally {
      // ALWAYS reset processing flag, even if an unexpected error occurs
      isProcessingRef.current = false;
    }
  };

  const queueFiles = (pendingFiles: File[], skippedFiles: File[]) => {
    const pendingTasks = pendingFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      status: 'pending' as const
    }));
    const skippedTasks = skippedFiles.map(file => ({
      id: Math.random().toString(36).substring(2, 9),
      file,
      status: 'skipped' as const
    }));
    
    uploadQueueRef.current = [...uploadQueueRef.current, ...pendingTasks, ...skippedTasks];
    setUploadTasks([...uploadQueueRef.current]);
    setIsQueueOpen(true);
    processQueue();
  };

  const retryTask = (id: string) => {
    const taskIndex = uploadQueueRef.current.findIndex(t => t.id === id);
    if (taskIndex !== -1) {
      uploadQueueRef.current[taskIndex].status = 'pending';
      setUploadTasks([...uploadQueueRef.current]);
      processQueue();
    }
  };

  const clearCompletedTasks = () => {
    uploadQueueRef.current = uploadQueueRef.current.filter(t => t.status === 'pending' || t.status === 'uploading' || t.status === 'error');
    setUploadTasks([...uploadQueueRef.current]);
    if (uploadQueueRef.current.length === 0) setIsQueueOpen(false);
  };

  return (
    <UploadContext.Provider value={{ uploadTasks, isQueueOpen, setIsQueueOpen, queueFiles, retryTask, clearCompletedTasks }}>
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
