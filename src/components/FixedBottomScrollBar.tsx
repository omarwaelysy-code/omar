import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export const FixedBottomScrollBar: React.FC = () => {
  const { dir } = useLanguage();
  const barRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetDir, setTargetDir] = useState<'rtl' | 'ltr'>(dir || 'rtl');
  const activeContainerRef = useRef<HTMLElement | null>(null);
  const isSyncing = useRef(false);
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateTargetAndMetrics = useCallback(() => {
    // Look for active/visible scrollable tables or containers
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(
      '#invoices-list-table, #purchase-invoices-list-table, .overflow-x-auto, [class*="overflow-x-auto"], table, [data-scrollable="true"]'
    ));

    let bestContainer: HTMLElement | null = null;
    let maxScore = 0;

    for (const el of candidates) {
      const target = (el.tagName === 'TABLE' ? el.parentElement : el) as HTMLElement;
      if (!target || target.offsetParent === null) continue;
      if (target.classList.contains('fixed-bottom-scroll-bar') || target.closest('.fixed-bottom-scroll-wrapper')) continue;

      const overflow = target.scrollWidth - target.clientWidth;
      if (overflow <= 10) continue;

      const rect = target.getBoundingClientRect();
      // Must have some presence on screen
      if (rect.bottom < 50 || rect.top > window.innerHeight - 30) continue;

      const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      const score = Math.max(0, visibleHeight) * 1000 + overflow;

      if (score > maxScore) {
        maxScore = score;
        bestContainer = target;
      }
    }

    // Fallback: if user is scrolled past but container exists on screen
    if (!bestContainer) {
      for (const el of candidates) {
        const target = (el.tagName === 'TABLE' ? el.parentElement : el) as HTMLElement;
        if (!target || target.offsetParent === null) continue;
        if (target.classList.contains('fixed-bottom-scroll-bar') || target.closest('.fixed-bottom-scroll-wrapper')) continue;
        const overflow = target.scrollWidth - target.clientWidth;
        if (overflow > 10) {
          bestContainer = target;
          break;
        }
      }
    }

    if (bestContainer) {
      activeContainerRef.current = bestContainer;
      setScrollWidth(bestContainer.scrollWidth);
      setContainerWidth(bestContainer.clientWidth);
      const computedDir = (bestContainer.getAttribute('dir') || bestContainer.closest('[dir]')?.getAttribute('dir') || dir || 'rtl') as 'rtl' | 'ltr';
      setTargetDir(computedDir);
      setIsVisible(true);

      if (barRef.current && !isSyncing.current) {
        isSyncing.current = true;
        barRef.current.scrollLeft = bestContainer.scrollLeft;
        requestAnimationFrame(() => { isSyncing.current = false; });
      }
    } else {
      activeContainerRef.current = null;
      setIsVisible(false);
    }
  }, [dir]);

  useEffect(() => {
    updateTargetAndMetrics();

    // Regular poll to detect tab switching, modals closing, or new data loaded
    const interval = setInterval(updateTargetAndMetrics, 300);

    const handleResize = () => updateTargetAndMetrics();
    window.addEventListener('resize', handleResize);

    const observer = new MutationObserver(() => {
      updateTargetAndMetrics();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'dir']
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [updateTargetAndMetrics]);

  // Sync scroll from target container to the fixed bottom scrollbar
  useEffect(() => {
    const target = activeContainerRef.current;
    if (!target) return;

    const handleTargetScroll = () => {
      if (isSyncing.current) return;
      if (barRef.current) {
        isSyncing.current = true;
        barRef.current.scrollLeft = target.scrollLeft;
        requestAnimationFrame(() => {
          isSyncing.current = false;
        });
      }
    };

    target.addEventListener('scroll', handleTargetScroll, { passive: true });
    return () => {
      target.removeEventListener('scroll', handleTargetScroll);
    };
  }, [isVisible, scrollWidth]);

  // Handle scroll on the fixed bottom bar
  const handleBarScroll = () => {
    if (isSyncing.current) return;
    const target = activeContainerRef.current;
    if (target && barRef.current) {
      isSyncing.current = true;
      target.scrollLeft = barRef.current.scrollLeft;
      requestAnimationFrame(() => {
        isSyncing.current = false;
      });
    }
  };

  // Continuous step scrolling for arrow buttons
  const stepScroll = useCallback((direction: 'left' | 'right') => {
    const target = activeContainerRef.current;
    if (!target) return;
    const delta = direction === 'left' ? -160 : 160;
    target.scrollLeft += delta;
  }, []);

  const startContinuousScroll = useCallback((direction: 'left' | 'right') => {
    stepScroll(direction);
    if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    scrollIntervalRef.current = setInterval(() => {
      stepScroll(direction);
    }, 60);
  }, [stepScroll]);

  const stopContinuousScroll = useCallback(() => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, []);

  if (!isVisible || scrollWidth <= containerWidth) return null;

  return (
    <div
      className="fixed-bottom-scroll-wrapper sticky bottom-0 left-0 right-0 z-30 flex items-stretch bg-[#f1f5f9] border-t border-slate-300 shadow-md select-none print:hidden h-[18px]"
      dir="ltr"
    >
      {/* Left Arrow Button */}
      <button
        type="button"
        onMouseDown={() => startContinuousScroll('left')}
        onMouseUp={stopContinuousScroll}
        onMouseLeave={stopContinuousScroll}
        onTouchStart={() => startContinuousScroll('left')}
        onTouchEnd={stopContinuousScroll}
        className="w-[20px] h-full flex items-center justify-center bg-[#e2e8f0] hover:bg-[#cbd5e1] active:bg-[#94a3b8] border-r border-[#cbd5e1] text-[#334155] shrink-0 cursor-pointer transition-colors"
        title="تمرير لليسار"
        aria-label="Scroll left"
      >
        <svg className="w-2.5 h-2.5 fill-[#334155]" viewBox="0 0 24 24">
          <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z" />
        </svg>
      </button>

      {/* Middle Scrollable Bar */}
      <div
        ref={barRef}
        onScroll={handleBarScroll}
        className="fixed-bottom-scroll-bar flex-1 h-full overflow-x-scroll overflow-y-hidden"
        dir={targetDir}
      >
        <div style={{ width: `${scrollWidth}px`, height: '1px' }} />
      </div>

      {/* Right Arrow Button */}
      <button
        type="button"
        onMouseDown={() => startContinuousScroll('right')}
        onMouseUp={stopContinuousScroll}
        onMouseLeave={stopContinuousScroll}
        onTouchStart={() => startContinuousScroll('right')}
        onTouchEnd={stopContinuousScroll}
        className="w-[20px] h-full flex items-center justify-center bg-[#e2e8f0] hover:bg-[#cbd5e1] active:bg-[#94a3b8] border-l border-[#cbd5e1] text-[#334155] shrink-0 cursor-pointer transition-colors"
        title="تمرير لليمين"
        aria-label="Scroll right"
      >
        <svg className="w-2.5 h-2.5 fill-[#334155]" viewBox="0 0 24 24">
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
        </svg>
      </button>
    </div>
  );
};
