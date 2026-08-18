import { useState, useEffect, useRef } from 'react';
import { extractPaletteFromImage, DEFAULT_PALETTE, type PaletteResult } from '../utils/colorExtractor';

export function useArtworkPalette(imageUrl: string | null | undefined) {
  const [palette, setPalette] = useState<PaletteResult>(DEFAULT_PALETTE);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const activeUrlRef = useRef<string | null | undefined>(imageUrl);

  useEffect(() => {
    activeUrlRef.current = imageUrl;

    if (!imageUrl) {
      setPalette(DEFAULT_PALETTE);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    extractPaletteFromImage(imageUrl)
      .then((extracted) => {
        if (isMounted && activeUrlRef.current === imageUrl) {
          setPalette(extracted);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted && activeUrlRef.current === imageUrl) {
          setPalette(DEFAULT_PALETTE);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  return { palette, isLoading };
}
