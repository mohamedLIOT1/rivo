import { useRef, useEffect, useLayoutEffect, useCallback } from 'react';

/**
 * useChatScroll Hook
 * Guarantees instantaneous snapping to bottom on chat open, message changes,
 * and container resize without smooth scrolling delay or jumpiness.
 * Strictly < 400 lines.
 */
export function useChatScroll({ isOpen, activeUserId, messagesCount, loading, loadingEarlier }) {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const scrollTimersRef = useRef([]);

  const clearScrollTimers = useCallback(() => {
    scrollTimersRef.current.forEach((t) => clearTimeout(t));
    scrollTimersRef.current = [];
  }, []);

  const scrollToBottom = useCallback((behavior = 'instant') => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
    const endEl = messagesEndRef.current;
    if (endEl) {
      try {
        endEl.scrollIntoView({
          behavior: behavior === 'smooth' ? 'smooth' : 'instant',
          block: 'end'
        });
      } catch {
        endEl.scrollIntoView(false);
      }
    }
  }, []);

  const scheduleScrollToBottom = useCallback(() => {
    clearScrollTimers();
    // 1. Immediate layout jump
    scrollToBottom('instant');

    // 2. Immediate animation frame
    const raf = requestAnimationFrame(() => scrollToBottom('instant'));

    // 3. Multi-frame staggered fallbacks to account for modal zoom-in CSS transition & avatar mounts
    const delays = [30, 80, 150, 250, 400];
    delays.forEach((ms) => {
      const t = setTimeout(() => {
        scrollToBottom('instant');
        if (ms === 400) {
          isInitialLoadRef.current = false;
        }
      }, ms);
      scrollTimersRef.current.push(t);
    });

    return () => {
      cancelAnimationFrame(raf);
      clearScrollTimers();
    };
  }, [scrollToBottom, clearScrollTimers]);

  // Reset initial load flag whenever modal opens or active chat partner changes
  useEffect(() => {
    isInitialLoadRef.current = true;
    clearScrollTimers();
  }, [isOpen, activeUserId, clearScrollTimers]);

  // Snap to bottom on message load or message updates
  useLayoutEffect(() => {
    if (loading || messagesCount === 0 || loadingEarlier) return;

    if (isInitialLoadRef.current) {
      scheduleScrollToBottom();
    } else {
      // Check if user is near bottom before auto-scrolling on incoming messages
      const container = messagesContainerRef.current;
      if (container) {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 160;
        if (isNearBottom) {
          scrollToBottom('smooth');
        }
      }
    }
  }, [loading, messagesCount, loadingEarlier, scheduleScrollToBottom, scrollToBottom]);

  // ResizeObserver to lock bottom during container expansions or font/image load
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || typeof window === 'undefined' || !window.ResizeObserver) return;

    const ro = new ResizeObserver(() => {
      if (isInitialLoadRef.current) {
        scrollToBottom('instant');
      } else {
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
        if (isNearBottom) {
          scrollToBottom('instant');
        }
      }
    });

    ro.observe(container);
    return () => {
      ro.disconnect();
      clearScrollTimers();
    };
  }, [scrollToBottom, clearScrollTimers]);

  return {
    messagesEndRef,
    messagesContainerRef,
    scrollToBottom,
    scheduleScrollToBottom,
    isInitialLoadRef
  };
}
