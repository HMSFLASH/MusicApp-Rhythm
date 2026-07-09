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

  console.log("[AudioDevice] Device Check:", {
    cores, 
    memory, 
    isSlowNetwork: !!isSlowNetwork,
    effectiveType: nav.connection?.effectiveType,
    saveData: nav.connection?.saveData
  });

  return isMobileUserAgent || isCoarseSmallScreen || cores <= 4 || memory <= 4 || !!isSlowNetwork;
};

export const getFullCoreCount = () => Math.max(1, navigator.hardwareConcurrency ?? 4);

export const getBufferProgressIntervalMs = () => isLikelyConstrainedDevice() ? 1000 : 250;
