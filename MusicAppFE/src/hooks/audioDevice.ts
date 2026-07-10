type NavigatorExtended = Navigator & { 
  deviceMemory?: number;
  connection?: { effectiveType?: string; saveData?: boolean };
};

export const isLikelyConstrainedDevice = () => {
  const nav = navigator as NavigatorExtended;
  const cores = nav.hardwareConcurrency ?? 8;
  const memory = nav.deviceMemory ?? 8;
  const isCoarseSmallScreen = window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth <= 1024;
  const isMobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent);
  
  const isSlowNetwork = nav.connection && (
    nav.connection.saveData === true || 
    nav.connection.effectiveType === 'slow-2g' || 
    nav.connection.effectiveType === '2g' || 
    nav.connection.effectiveType === '3g'
  );

  return isMobileUserAgent || isCoarseSmallScreen || cores <= 4 || memory <= 4 || !!isSlowNetwork;
};

export const isMobileDevice = () => {
  const nav = navigator as NavigatorExtended;
  const isCoarseSmallScreen = window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth <= 1024;
  const isMobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent);
  return isMobileUserAgent || isCoarseSmallScreen;
};

export const getFullCoreCount = () => Math.max(1, navigator.hardwareConcurrency ?? 4);

export const getConstrainedWorkerCount = (total: number) => {
  const cores = getFullCoreCount();
  if (isLikelyConstrainedDevice() || cores <= 4) return Math.min(1, total);
  if (cores <= 8) return Math.min(2, total);
  return Math.min(cores, total);
};

export const getQueuePrecalculateWorkerSettings = (queueCount: number) => {
  const total = Math.max(0, Math.floor(queueCount));
  if (total === 0) return { recommendedWorkers: 0, maxWorkers: 0 };
  const cores = getFullCoreCount();
  const quarterCoreRecommendation = cores < 4 ? 1 : Math.floor(cores / 4);
  const recommendedWorkers = Math.min(quarterCoreRecommendation, total);
  const maxWorkers = cores > 8
    ? Math.min(cores, total)
    : recommendedWorkers;

  return { recommendedWorkers, maxWorkers };
};

export const getPrecalculateDelayMs = () => {
  const cores = getFullCoreCount();
  if (isLikelyConstrainedDevice() || cores <= 4) return 2000;
  if (cores <= 8) return 1000;
  return 500;
};

export const getBufferProgressIntervalMs = () => isLikelyConstrainedDevice() ? 1000 : 250;
