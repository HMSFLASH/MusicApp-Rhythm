import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

type UseVirtualListOptions = {
  itemCount: number;
  itemHeight: number;
  overscan?: number;
};

export function useVirtualList({ itemCount, itemHeight, overscan = 8 }: UseVirtualListOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [observedContainer, setObservedContainer] = useState<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setObservedContainer(node);
    setScrollTop(node?.scrollTop ?? 0);
  }, []);

  useLayoutEffect(() => {
    const container = observedContainer;
    if (!container) return;

    const updateSize = () => setViewportHeight(container.clientHeight);
    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [observedContainer]);

  const handleScroll = useCallback(() => {
    setScrollTop(containerRef.current?.scrollTop ?? 0);
  }, []);

  const range = useMemo(() => {
    if (itemCount <= 0 || itemHeight <= 0) {
      return { startIndex: 0, endIndex: -1, visibleIndexes: [] as number[] };
    }

    const measuredViewportHeight = viewportHeight || itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      itemCount - 1,
      Math.ceil((scrollTop + measuredViewportHeight) / itemHeight) + overscan
    );
    const visibleIndexes = Array.from(
      { length: Math.max(0, endIndex - startIndex + 1) },
      (_, offset) => startIndex + offset
    );

    return { startIndex, endIndex, visibleIndexes };
  }, [itemCount, itemHeight, overscan, scrollTop, viewportHeight]);

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'auto') => {
    const container = containerRef.current;
    if (!container || index < 0 || index >= itemCount) return;

    container.scrollTo({
      top: Math.max(0, (index * itemHeight) - (container.clientHeight / 2) + (itemHeight / 2)),
      behavior,
    });
  }, [itemCount, itemHeight]);

  return {
    containerRef: setContainerRef,
    handleScroll,
    offsetY: range.startIndex * itemHeight,
    scrollToIndex,
    totalHeight: itemCount * itemHeight,
    visibleIndexes: range.visibleIndexes,
  };
}
