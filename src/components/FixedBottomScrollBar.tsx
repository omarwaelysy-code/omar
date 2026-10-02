import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export const FixedBottomScrollBar: React.FC = () => {
  const { dir } = useLanguage();
  const barRef = useRef<HTMLDivElement>(null);
  const activeContainerRef = useRef<HTMLElement | null>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [targetDir, setTargetDir] = useState<'rtl' | 'ltr'>(dir || 'rtl');
  const [position, setPosition] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const isSyncing = useRef(false);

  const updateMetrics = useCallback(() => {
    const mainEl = document.querySelector('main');
    if (!mainEl) {
      setIsVisible(false);
      return;
    }

    const mainRect = mainEl.getBoundingClientRect();
    setPosition({
      left: mainRect.left,
      width: mainRect.width,
    });

    // Find active scrollable container inside main
    let target: HTMLElement | null = null;

    // 1. Prioritize visible tables inside main
    const tables = Array.from(mainEl.querySelectorAll<HTMLTableElement>('table'));
    for (const table of tables) {
      if (table.offsetParent === null) continue;
      const parent = table.parentElement;
      if (!parent || parent.classList.contains('fixed-bottom-scroll-bar')) continue;

      const overflow = parent.scrollWidth - parent.clientWidth;
      if (overflow > 4) {
        target = parent;
        break;
      }
    }

    // 2. Check general overflow-x containers inside main
    if (!target) {
      const scrollables = Array.from(mainEl.querySelectorAll<HTMLElement>(
        '.overflow-x-auto, [class*="overflow-x-auto"], [data-scrollable="true"]'
      ));
      for (const el of scrollables) {
        if (el.offsetParent === null) continue;
        if (el.closest('header') || el.classList.contains('fixed-bottom-scroll-bar')) continue;

        const overflow = el.scrollWidth - el.clientWidth;
        if (overflow > 4) {
          target = el;
          break;
        }
      }
    }

    if (target) {
      activeContainerRef.current = target;
      setScrollWidth(target.scrollWidth);
      setContainerWidth(target.clientWidth);
      const computedDir = (target.getAttribute('dir') || target.closest('[dir]')?.getAttribute('dir') || dir || 'rtl') as 'rtl' | 'ltr';
      setTargetDir(computedDir);
      setIsVisible(true);

      if (barRef.current && !isSyncing.current) {
        isSyncing.current = true;
        barRef.current.scrollLeft = target.scrollLeft;
        requestAnimationFrame(() => {
          isSyncing.current = false;
        });
      }
    } else {
      activeContainerRef.current = null;
      setIsVisible(false);
    }
  }, [dir]);

  useEffect(() => {
    updateMetrics();

    // Check on interval for route changes, data loading, or tab switching
    const interval = setInterval(updateMetrics, 300);

    const handleResize = () => updateMetrics();
    window.addEventListener('resize', handleResize);

    const observer = new MutationObserver(() => {
      updateMetrics();
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
  }, [updateMetrics]);

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

  if (!isVisible || scrollWidth <= containerWidth) return null;

  return (
    <div
      className="fixed-bottom-scroll-wrapper fixed bottom-0 z-40 bg-white/95 backdrop-blur-xs border-t border-slate-200/80 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] print:hidden select-none"
      style={{
        left: `${position.left}px`,
        width: `${position.width}px`,
        height: '11px',
      }}
      dir={targetDir}
    >
      <div
        ref={barRef}
        onScroll={handleBarScroll}
        className="fixed-bottom-scroll-bar w-full h-full overflow-x-auto overflow-y-hidden custom-scrollbar"
        dir={targetDir}
        style={{
          height: '11px',
        }}
      >
        <div style={{ width: `${scrollWidth}px`, height: '1px' }} />
      </div>
    </div>
  );
};
