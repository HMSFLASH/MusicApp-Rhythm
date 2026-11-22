import { useState, useEffect } from 'react';
import { extractPaletteFromImage, DEFAULT_PALETTE, type PaletteResult } from '../utils/colorExtractor';

export function useArtworkPalette(imageUrl: string | null | undefined) {
  const [resolved, setResolved] = useState<{ url: string; palette: PaletteResult } | null>(null);

  useEffect(() => {
    if (!imageUrl) return;

    let isMounted = true;

    extractPaletteFromImage(imageUrl)
      .then((extracted) => {
        if (isMounted) {
          setResolved({ url: imageUrl, palette: extracted });
        }
      })
      .catch(() => {
        if (isMounted) {
          setResolved({ url: imageUrl, palette: DEFAULT_PALETTE });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  if (!imageUrl) {
    return { palette: DEFAULT_PALETTE, isLoading: false };
  }

  const isCurrentResolved = resolved?.url === imageUrl;
  return {
    palette: isCurrentResolved ? resolved.palette : DEFAULT_PALETTE,
    isLoading: !isCurrentResolved,
  };
}
