export interface PaletteResult {
  primary: string;
  secondary: string;
  accent: string;
  ambientDark: string;
  glow: string;
  rgbPrimary: string;
  rgbSecondary: string;
  rgbAccent: string;
  isDark: boolean;
}

export const DEFAULT_PALETTE: PaletteResult = {
  primary: '#00f5ff',
  secondary: '#6366f1',
  accent: '#38bdf8',
  ambientDark: 'rgba(6, 11, 20, 0.92)',
  glow: 'rgba(0, 245, 255, 0.45)',
  rgbPrimary: '0, 245, 255',
  rgbSecondary: '99, 102, 241',
  rgbAccent: '56, 189, 248',
  isDark: true,
};

const paletteCache = new Map<string, PaletteResult>();
const MAX_CACHE_SIZE = 60;

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [Math.round(h * 360), s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = (h % 360 + 360) % 360;
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h / 360 + 1 / 3);
    g = hue2rgb(p, q, h / 360);
    b = hue2rgb(p, q, h / 360 - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

interface ColorBucket {
  hSum: number;
  sSum: number;
  lSum: number;
  rSum: number;
  gSum: number;
  bSum: number;
  count: number;
  vibrancyScore: number;
}

/**
 * Extracts a rich, vibrant adaptive color palette from an image URL using offscreen Canvas.
 */
export async function extractPaletteFromImage(imageUrl: string | null | undefined): Promise<PaletteResult> {
  if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
    return DEFAULT_PALETTE;
  }

  const cached = paletteCache.get(imageUrl);
  if (cached) {
    return cached;
  }

  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      // Timeout guard in case image hangs
      const timeout = setTimeout(() => {
        img.src = '';
        reject(new Error('Image load timeout'));
      }, 5000);
      img.addEventListener('load', () => clearTimeout(timeout), { once: true });
      img.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    const size = 48; // Fast and representative downsampling
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return DEFAULT_PALETTE;

    ctx.drawImage(img, 0, 0, size, size);
    const imageData = ctx.getImageData(0, 0, size, size).data;

    const NUM_BUCKETS = 16;
    const buckets: ColorBucket[] = Array.from({ length: NUM_BUCKETS }, () => ({
      hSum: 0,
      sSum: 0,
      lSum: 0,
      rSum: 0,
      gSum: 0,
      bSum: 0,
      count: 0,
      vibrancyScore: 0,
    }));

    let totalValidPixels = 0;
    let totalR = 0;
    let totalG = 0;
    let totalB = 0;

    for (let i = 0; i < imageData.length; i += 4) {
      const a = imageData[i + 3];
      if (a < 128) continue; // Skip transparent

      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];

      totalR += r;
      totalG += g;
      totalB += b;
      totalValidPixels++;

      const [h, s, l] = rgbToHsl(r, g, b);

      // Skip extreme darks (black/muddy) and extreme lights (washed out/pure white)
      if (l < 0.12 || l > 0.92) continue;

      const bucketIdx = Math.floor((h / 360) * NUM_BUCKETS) % NUM_BUCKETS;
      const bkt = buckets[bucketIdx];

      bkt.hSum += h;
      bkt.sSum += s;
      bkt.lSum += l;
      bkt.rSum += r;
      bkt.gSum += g;
      bkt.bSum += b;
      bkt.count++;

      // Higher saturation and medium luminance give a vibrant aesthetic score
      const satWeight = Math.pow(s, 1.4);
      const lumWeight = 1 - Math.abs(l - 0.5) * 1.5;
      bkt.vibrancyScore += satWeight * Math.max(0.2, lumWeight);
    }

    // Filter buckets with sufficient samples
    const validBuckets = buckets.filter((b) => b.count >= Math.max(3, size * size * 0.005));

    let primaryR: number, primaryG: number, primaryB: number;
    let secondaryR: number, secondaryG: number, secondaryB: number;
    let accentR: number, accentG: number, accentB: number;

    if (validBuckets.length === 0) {
      // Monochromatic / grayscale artwork fallback
      if (totalValidPixels > 0) {
        const avgR = Math.round(totalR / totalValidPixels);
        const avgG = Math.round(totalG / totalValidPixels);
        const avgB = Math.round(totalB / totalValidPixels);
        const [h, , l] = rgbToHsl(avgR, avgG, avgB);

        // Enhance monochromatic art with an elegant atmospheric hue
        const boostedL = Math.max(0.4, Math.min(0.65, l));
        [primaryR, primaryG, primaryB] = hslToRgb(h || 200, 0.45, boostedL);
        [secondaryR, secondaryG, secondaryB] = hslToRgb((h || 200) + 40, 0.35, boostedL * 0.85);
        [accentR, accentB, accentG] = hslToRgb((h || 200) - 30, 0.5, boostedL * 1.1);
      } else {
        return DEFAULT_PALETTE;
      }
    } else {
      // Sort by vibrancy score
      validBuckets.sort((a, b) => b.vibrancyScore - a.vibrancyScore);

      const top1 = validBuckets[0];
      const h1 = top1.hSum / top1.count;
      const s1 = Math.max(0.4, Math.min(0.9, (top1.sSum / top1.count) * 1.15));
      const l1 = Math.max(0.35, Math.min(0.65, top1.lSum / top1.count));
      [primaryR, primaryG, primaryB] = hslToRgb(h1, s1, l1);

      // Find secondary bucket with distinct hue (distance >= 35 deg)
      const top2 = validBuckets.find((b) => {
        const h2 = b.hSum / b.count;
        const diff = Math.abs(h1 - h2);
        const hueDist = Math.min(diff, 360 - diff);
        return hueDist >= 35;
      });

      if (top2) {
        const h2 = top2.hSum / top2.count;
        const s2 = Math.max(0.35, Math.min(0.85, (top2.sSum / top2.count) * 1.1));
        const l2 = Math.max(0.3, Math.min(0.6, top2.lSum / top2.count));
        [secondaryR, secondaryG, secondaryB] = hslToRgb(h2, s2, l2);
      } else {
        // Generate complementary secondary hue
        const h2 = (h1 + 45) % 360;
        [secondaryR, secondaryG, secondaryB] = hslToRgb(h2, s1 * 0.85, Math.max(0.3, l1 * 0.8));
      }

      // Find accent bucket
      const top3 = validBuckets.find((b) => {
        if (b === top1 || b === top2) return false;
        const h3 = b.hSum / b.count;
        const diff1 = Math.abs(h1 - h3);
        const hueDist1 = Math.min(diff1, 360 - diff1);
        return hueDist1 >= 30;
      });

      if (top3) {
        const h3 = top3.hSum / top3.count;
        const s3 = Math.max(0.4, Math.min(0.9, top3.sSum / top3.count));
        const l3 = Math.max(0.4, Math.min(0.7, top3.lSum / top3.count));
        [accentR, accentG, accentB] = hslToRgb(h3, s3, l3);
      } else {
        // Generate harmonic accent hue
        const h3 = (h1 + 180) % 360;
        [accentR, accentG, accentB] = hslToRgb(h3, Math.min(0.8, s1), Math.min(0.65, l1 * 1.1));
      }
    }

    const primaryHex = rgbToHex(primaryR, primaryG, primaryB);
    const secondaryHex = rgbToHex(secondaryR, secondaryG, secondaryB);
    const accentHex = rgbToHex(accentR, accentG, accentB);

    const rgbPrimary = `${primaryR}, ${primaryG}, ${primaryB}`;
    const rgbSecondary = `${secondaryR}, ${secondaryG}, ${secondaryB}`;
    const rgbAccent = `${accentR}, ${accentG}, ${accentB}`;

    const paletteResult: PaletteResult = {
      primary: primaryHex,
      secondary: secondaryHex,
      accent: accentHex,
      ambientDark: `rgba(${Math.round(primaryR * 0.08)}, ${Math.round(primaryG * 0.08)}, ${Math.round(primaryB * 0.12)}, 0.92)`,
      glow: `rgba(${rgbPrimary}, 0.45)`,
      rgbPrimary,
      rgbSecondary,
      rgbAccent,
      isDark: true,
    };

    if (paletteCache.size >= MAX_CACHE_SIZE) {
      const firstKey = paletteCache.keys().next().value;
      if (firstKey) paletteCache.delete(firstKey);
    }
    paletteCache.set(imageUrl, paletteResult);

    return paletteResult;
  } catch (err) {
    // If CORS or decoding error occurs, gracefully fallback
    console.warn('[colorExtractor] Could not extract palette, using fallback:', err);
    return DEFAULT_PALETTE;
  }
}
