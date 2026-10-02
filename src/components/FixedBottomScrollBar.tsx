import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

export const FixedBottomScrollBar: React.FC = () => {
  const { dir } = useLanguage();
  const trackRef = useRef<HTMLDivElement>(null);
  const activeContainerRef = useRef<HTMLElement | null>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [thumbWidthPercent, setThumbWidthPercent] = useState(25);
  const [thumbOffsetPercent, setThumbOffsetPercent] = useState(0);
  const [isRtl, setIsRtl] = useState(dir === 'rtl');
  const [isDragging, setIsDragging] = useState(false);

  const updateMetrics = useCallback(() => {
    const mainEl = document.querySelector('main');
    if (!mainEl) {
      setIsVisible(false);
      return;
    }

    let target: HTMLElement | null = null;

    // 1. Search for visible tables inside main and find their scroll container
    const tables = Array.from(mainEl.querySelectorAll<HTMLTableElement>('table'));
    for (const table of tables) {
      if (table.offsetWidth === 0 && table.offsetHeight === 0 && table.getClientRects().length === 0) continue;

      let current: HTMLElement | null = table.parentElement;
      while (current && current !== mainEl) {
        if (current.classList.contains('fixed-bottom-scroll-wrapper')) break;

        const overflow = current.scrollWidth - current.clientWidth;
        if (overflow > 4) {
          target = current;
          break;
        }

        // Check if table width exceeds container client width
        const tableRect = table.getBoundingClientRect();
        const containerRect = current.getBoundingClientRect();
        if (tableRect.width - containerRect.width > 4) {
          const style = window.getComputedStyle(current);
          if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
            target = current;
            break;
          }
        }
        current = current.parentElement;
      }
      if (target) break;
    }

    // 2. Fallback: Search for any overflow-x containers
    if (!target) {
      const scrollables = Array.from(mainEl.querySelectorAll<HTMLElement>(
        '.overflow-x-auto, [class*="overflow-x-auto"], [data-scrollable="true"]'
      ));
      for (const el of scrollables) {
        if (el.offsetWidth === 0 && el.offsetHeight === 0) continue;
        if (el.closest('header') || el.classList.contains('fixed-bottom-scroll-wrapper')) continue;
        if (el.scrollWidth - el.clientWidth > 4) {
          target = el;
          break;
        }
      }
    }

    if (target) {
      activeContainerRef.current = target;
      const scrollWidth = target.scrollWidth;
      const clientWidth = target.clientWidth;
      const maxScroll = scrollWidth - clientWidth;

      if (maxScroll > 4) {
        const computedDir = (target.getAttribute('dir') || target.closest('[dir]')?.getAttribute('dir') || dir || 'rtl') === 'rtl';
        setIsRtl(computedDir);

        const widthRatio = Math.max(0.08, Math.min(0.9, clientWidth / scrollWidth));
        const widthPct = widthRatio * 100;
        setThumbWidthPercent(widthPct);

        const scrollLeft = Math.abs(target.scrollLeft);
        const scrollRatio = Math.min(1, Math.max(0, scrollLeft / maxScroll));
        const availableTravel = 100 - widthPct;
        setThumbOffsetPercent(scrollRatio * availableTravel);

        setIsVisible(true);
        return;
      }
    }

    activeContainerRef.current = null;
    setIsVisible(false);
  }, [dir]);

  useEffect(() => {
    updateMetrics();

    const interval = setInterval(updateMetrics, 250);
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

  // Sync scroll from target container in real-time
  useEffect(() => {
    const target = activeContainerRef.current;
    if (!target) return;

    const handleScroll = () => {
      const scrollWidth = target.scrollWidth;
      const clientWidth = target.clientWidth;
      const maxScroll = scrollWidth - clientWidth;
      if (maxScroll <= 0) return;

      const widthRatio = Math.max(0.08, Math.min(0.9, clientWidth / scrollWidth));
      const widthPct = widthRatio * 100;
      const scrollLeft = Math.abs(target.scrollLeft);
      const scrollRatio = Math.min(1, Math.max(0, scrollLeft / maxScroll));
      const availableTravel = 100 - widthPct;

      setThumbWidthPercent(widthPct);
      setThumbOffsetPercent(scrollRatio * availableTravel);
    };

    target.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      target.removeEventListener('scroll', handleScroll);
    };
  }, [isVisible]);

  // Pointer drag on the thumb
  const handleThumbPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = activeContainerRef.current;
    if (!target) return;

    const startX = e.clientX;
    const startScrollLeft = target.scrollLeft;
    const maxScroll = target.scrollWidth - target.clientWidth;
    const trackWidth = trackRef.current ? trackRef.current.clientWidth : window.innerWidth;
    const availableTravelPx = trackWidth * (1 - thumbWidthPercent / 100);

    setIsDragging(true);

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (availableTravelPx <= 0) return;
      const deltaX = moveEvent.clientX - startX;

      if (isRtl) {
        const scrollDelta = (deltaX / availableTravelPx) * maxScroll;
        if (startScrollLeft <= 0) {
          target.scrollLeft = Math.min(0, Math.max(-maxScroll, startScrollLeft + scrollDelta));
        } else {
          target.scrollLeft = Math.min(maxScroll, Math.max(0, startScrollLeft - scrollDelta));
        }
      } else {
        const scrollDelta = (deltaX / availableTravelPx) * maxScroll;
        target.scrollLeft = Math.min(maxScroll, Math.max(0, startScrollLeft + scrollDelta));
      }
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Clicking on track jumps to clicked percentage
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = activeContainerRef.current;
    const track = trackRef.current;
    if (!target || !track) return;

    const rect = track.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const maxScroll = target.scrollWidth - target.clientWidth;

    if (isRtl) {
      const rtlRatio = 1 - ratio;
      if (target.scrollLeft <= 0) {
        target.scrollLeft = -(rtlRatio * maxScroll);
      } else {
        target.scrollLeft = rtlRatio * maxScroll;
      }
    } else {
      target.scrollLeft = ratio * maxScroll;
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed-bottom-scroll-wrapper fixed bottom-0 left-0 right-0 w-full z-50 bg-white/95 backdrop-blur-sm border-t border-slate-200/90 shadow-[0_-2px_10px_rgba(0,0,0,0.08)] py-1 px-1.5 select-none print:hidden flex items-center"
      style={{ height: '14px' }}
      dir="ltr"
    >
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="relative w-full h-[7px] bg-slate-200/80 hover:bg-slate-200 rounded-full cursor-pointer transition-colors"
      >
        <div
          onPointerDown={handleThumbPointerDown}
          className={`absolute top-0 bottom-0 rounded-full cursor-grab active:cursor-grabbing transition-colors ${
            isDragging ? 'bg-slate-600 shadow-sm' : 'bg-slate-400 hover:bg-slate-500'
          }`}
          style={{
            width: `${thumbWidthPercent}%`,
            ...(isRtl
              ? { right: `${thumbOffsetPercent}%` }
              : { left: `${thumbOffsetPercent}%` }),
          }}
        />
      </div>
    </div>
  );
};
