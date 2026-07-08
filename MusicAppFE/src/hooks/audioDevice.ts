type NavigatorWithDeviceMemory = Navigator & { deviceMemory?: number };

export const isLikelyConstrainedDevice = () => {
  const nav = navigator as NavigatorWithDeviceMemory;
  const cores = nav.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;
  const isCoarseSmallScreen = window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth <= 1024;
  const isMobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent);

  return isMobileUserAgent || isCoarseSmallScreen || cores <= 4 || memory <= 4;
};

export const getFullCoreCount = () => Math.max(1, navigator.hardwareConcurrency ?? 4);

export const getBufferProgressIntervalMs = () => isLikelyConstrainedDevice() ? 1000 : 250;
