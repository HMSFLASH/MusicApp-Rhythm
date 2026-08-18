import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

export type ScrollAlign = 'start' | 'center' | 'end' | 'auto';

export type UseVirtualListOptions = {
  itemCount: number;
  itemHeight: number;
  overscan?: number;
  scrollElement?: HTMLElement | null;
};

export function useVirtualList({
  itemCount,
  itemHeight,
  overscan = 8,
  scrollElement,
}: UseVirtualListOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [observedContainer, setObservedContainer] = useState<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    setObservedContainer(node);
    if (node) {
      setScrollTop(node.scrollTop ?? 0);
      setViewportHeight(node.clientHeight ?? 0);
    }
  }, []);

  useLayoutEffect(() => {
    const container = observedContainer;
    if (!container) return;

    // Helper to find the scrollable parent if the container itself does not handle scrolling
    const getScrollParent = (node: HTMLElement): HTMLElement | Window => {
      if (scrollElement) return scrollElement;
      let current: HTMLElement | null = node;
      while (current && current !== document.body && current !== document.documentElement) {
        const style = window.getComputedStyle(current);
        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
          return current;
        }
        current = current.parentElement;
      }
      return window;
    };

    const target = getScrollParent(container);

    const updateMeasurements = () => {
      if (target === container) {
        setViewportHeight(container.clientHeight);
        setScrollTop(container.scrollTop);
      } else if (target === window) {
        const rect = container.getBoundingClientRect();
        const effectiveScrollTop = Math.max(0, -rect.top);
        setViewportHeight(window.innerHeight);
        setScrollTop(effectiveScrollTop);
      } else {
        const targetEl = target as HTMLElement;
        const targetRect = targetEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const effectiveScrollTop = Math.max(0, targetRect.top - containerRect.top);
        setViewportHeight(targetEl.clientHeight);
        setScrollTop(effectiveScrollTop);
      }
    };

    updateMeasurements();

    const onScroll = () => {
      updateMeasurements();
    };

    target.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateMeasurements);

    const resizeObserver = new ResizeObserver(updateMeasurements);
    resizeObserver.observe(container);
    if (target instanceof HTMLElement && target !== container) {
      resizeObserver.observe(target);
    }

    return () => {
      target.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateMeasurements);
      resizeObserver.disconnect();
    };
  }, [observedContainer, scrollElement]);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop ?? 0);
    }
  }, []);

  const range = useMemo(() => {
    if (itemCount <= 0 || itemHeight <= 0) {
      return { startIndex: 0, endIndex: -1, visibleIndexes: [] as number[] };
    }

    const measuredViewportHeight = viewportHeight || itemHeight * 10;
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

  const scrollToIndex = useCallback((
    index: number,
    behavior: ScrollBehavior = 'auto',
    align: ScrollAlign = 'center'
  ) => {
    const container = containerRef.current;
    if (!container || index < 0 || index >= itemCount) return;

    let targetTop = index * itemHeight;
    const containerHeight = container.clientHeight || viewportHeight;

    if (align === 'center') {
      targetTop = Math.max(0, (index * itemHeight) - (containerHeight / 2) + (itemHeight / 2));
    } else if (align === 'end') {
      targetTop = Math.max(0, (index * itemHeight) - containerHeight + itemHeight);
    }

    container.scrollTo({
      top: targetTop,
      behavior,
    });
  }, [itemCount, itemHeight, viewportHeight]);

  return {
    containerRef: setContainerRef,
    handleScroll,
    offsetY: range.startIndex * itemHeight,
    scrollToIndex,
    totalHeight: itemCount * itemHeight,
    visibleIndexes: range.visibleIndexes,
    startIndex: range.startIndex,
    endIndex: range.endIndex,
  };
}
