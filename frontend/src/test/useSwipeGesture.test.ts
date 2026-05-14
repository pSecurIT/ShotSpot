/**
 * Tests for useSwipeGesture Hook
 *
 * Tests touch event handling, swipe direction detection,
 * distance thresholds, and callback invocation.
 */

import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSwipeGesture } from '../hooks/useSwipeGesture';

describe('🎯 useSwipeGesture Hook', () => {
  describe('Initialize Hook', () => {
    it('should return touch event handlers', () => {
      const { result } = renderHook(() => useSwipeGesture({}));

      expect(result.current).toHaveProperty('onTouchStart');
      expect(result.current).toHaveProperty('onTouchEnd');
      expect(result.current).toHaveProperty('onTouchCancel');
      expect(typeof result.current.onTouchStart).toBe('function');
      expect(typeof result.current.onTouchEnd).toBe('function');
      expect(typeof result.current.onTouchCancel).toBe('function');
    });

    it('should accept custom minDistance and maxCrossAxisDistance', () => {
      const onSwipeRight = vi.fn();
      const { result } = renderHook(() =>
        useSwipeGesture({
          minDistance: 100,
          maxCrossAxisDistance: 50,
          onSwipeRight,
        })
      );

      expect(result.current).toBeDefined();
      expect(typeof result.current.onTouchStart).toBe('function');
    });

    it('should use default values when not provided', () => {
      const onSwipeRight = vi.fn();
      const { result } = renderHook(() =>
        useSwipeGesture({
          onSwipeRight,
        })
      );

      expect(result.current).toBeDefined();
    });
  });

  describe('Swipe Detection', () => {
    it('should detect right swipe', () => {
      const onSwipeRight = vi.fn();
      const { result } = renderHook(() =>
        useSwipeGesture({
          minDistance: 56,
          maxCrossAxisDistance: 96,
          onSwipeRight,
        })
      );

      act(() => {
        const touchStartEvent = {
          touches: [{ clientX: 10, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchStart(touchStartEvent);
      });

      act(() => {
        const touchEndEvent = {
          changedTouches: [{ clientX: 100, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchEnd(touchEndEvent);
      });

      expect(onSwipeRight).toHaveBeenCalledTimes(1);
    });

    it('should detect left swipe', () => {
      const onSwipeLeft = vi.fn();
      const { result } = renderHook(() =>
        useSwipeGesture({
          minDistance: 56,
          maxCrossAxisDistance: 96,
          onSwipeLeft,
        })
      );

      act(() => {
        const touchStartEvent = {
          touches: [{ clientX: 350, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchStart(touchStartEvent);
      });

      act(() => {
        const touchEndEvent = {
          changedTouches: [{ clientX: 200, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchEnd(touchEndEvent);
      });

      expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    });

    it('should not trigger callback if swipe distance is below minimum', () => {
      const onSwipeRight = vi.fn();
      const { result } = renderHook(() =>
        useSwipeGesture({
          minDistance: 56,
          maxCrossAxisDistance: 96,
          onSwipeRight,
        })
      );

      act(() => {
        const touchStartEvent = {
          touches: [{ clientX: 10, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchStart(touchStartEvent);
      });

      // Only 30px swipe (below 56px minimum)
      act(() => {
        const touchEndEvent = {
          changedTouches: [{ clientX: 40, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchEnd(touchEndEvent);
      });

      expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it('should not trigger callback if cross-axis distance exceeds maximum', () => {
      const onSwipeRight = vi.fn();
      const { result } = renderHook(() =>
        useSwipeGesture({
          minDistance: 56,
          maxCrossAxisDistance: 96,
          onSwipeRight,
        })
      );

      act(() => {
        const touchStartEvent = {
          touches: [{ clientX: 10, clientY: 300 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchStart(touchStartEvent);
      });

      // 100px horizontal, 150px vertical (exceeds max cross-axis of 96px)
      act(() => {
        const touchEndEvent = {
          changedTouches: [{ clientX: 110, clientY: 450 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchEnd(touchEndEvent);
      });

      expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it('should handle exact minimum distance threshold', () => {
      const onSwipeRight = vi.fn();
      const { result } = renderHook(() =>
        useSwipeGesture({
          minDistance: 56,
          maxCrossAxisDistance: 96,
          onSwipeRight,
        })
      );

      act(() => {
        const touchStartEvent = {
          touches: [{ clientX: 10, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchStart(touchStartEvent);
      });

      // Exactly 56px swipe (exactly at minimum)
      act(() => {
        const touchEndEvent = {
          changedTouches: [{ clientX: 66, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchEnd(touchEndEvent);
      });

      expect(onSwipeRight).toHaveBeenCalledTimes(1);
    });

    it('should handle exact maximum cross-axis distance threshold', () => {
      const onSwipeRight = vi.fn();
      const { result } = renderHook(() =>
        useSwipeGesture({
          minDistance: 56,
          maxCrossAxisDistance: 96,
          onSwipeRight,
        })
      );

      act(() => {
        const touchStartEvent = {
          touches: [{ clientX: 10, clientY: 300 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchStart(touchStartEvent);
      });

      // 100px horizontal, exactly 96px vertical
      act(() => {
        const touchEndEvent = {
          changedTouches: [{ clientX: 110, clientY: 396 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchEnd(touchEndEvent);
      });

      expect(onSwipeRight).toHaveBeenCalledTimes(1);
    });
  });

  describe('Touch Event Handling', () => {
    it('should handle missing touch on touchStart', () => {
      const onSwipeRight = vi.fn();
      const { result } = renderHook(() =>
        useSwipeGesture({
          onSwipeRight,
        })
      );

      act(() => {
        const touchStartEvent = {
          touches: [], // No touches
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchStart(touchStartEvent);
      });

      // Should not crash and not trigger callback later
      act(() => {
        const touchEndEvent = {
          changedTouches: [{ clientX: 100, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchEnd(touchEndEvent);
      });

      expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it('should reset state on touchCancel', () => {
      const onSwipeRight = vi.fn();
      const { result } = renderHook(() =>
        useSwipeGesture({
          minDistance: 56,
          onSwipeRight,
        })
      );

      act(() => {
        const touchStartEvent = {
          touches: [{ clientX: 10, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchStart(touchStartEvent);
      });

      act(() => {
        result.current.onTouchCancel();
      });

      // Now touchEnd should not trigger callback because state was reset
      act(() => {
        const touchEndEvent = {
          changedTouches: [{ clientX: 100, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchEnd(touchEndEvent);
      });

      expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it('should handle missing changedTouches on touchEnd', () => {
      const onSwipeRight = vi.fn();
      const { result } = renderHook(() =>
        useSwipeGesture({
          onSwipeRight,
        })
      );

      act(() => {
        const touchStartEvent = {
          touches: [{ clientX: 10, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchStart(touchStartEvent);
      });

      expect(() => {
        act(() => {
          const touchEndEvent = {
            changedTouches: [], // No touches
          } as unknown as React.TouchEvent<HTMLElement>;
          result.current.onTouchEnd(touchEndEvent);
        });
      }).not.toThrow();

      expect(onSwipeRight).not.toHaveBeenCalled();
    });
  });

  describe('Hook Behavior', () => {
    it('should not trigger callbacks when disabled', () => {
      const onSwipeRight = vi.fn();
      const onSwipeLeft = vi.fn();
      const { result } = renderHook(() =>
        useSwipeGesture({
          enabled: false,
          minDistance: 56,
          onSwipeRight,
          onSwipeLeft,
        })
      );

      act(() => {
        const touchStartEvent = {
          touches: [{ clientX: 10, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchStart(touchStartEvent);
      });

      act(() => {
        const touchEndEvent = {
          changedTouches: [{ clientX: 100, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchEnd(touchEndEvent);
      });

      expect(onSwipeRight).not.toHaveBeenCalled();
      expect(onSwipeLeft).not.toHaveBeenCalled();
    });

    it('should allow toggling enabled state', () => {
      const onSwipeRight = vi.fn();
      const { result, rerender } = renderHook(
        ({ enabled }: { enabled: boolean }) =>
          useSwipeGesture({
            enabled,
            minDistance: 56,
            onSwipeRight,
          }),
        { initialProps: { enabled: true } }
      );

      act(() => {
        const touchStartEvent = {
          touches: [{ clientX: 10, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchStart(touchStartEvent);
      });

      act(() => {
        const touchEndEvent = {
          changedTouches: [{ clientX: 100, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchEnd(touchEndEvent);
      });

      expect(onSwipeRight).toHaveBeenCalledTimes(1);

      // Rerender with enabled: false
      rerender({ enabled: false });
      onSwipeRight.mockClear();

      act(() => {
        const touchStartEvent = {
          touches: [{ clientX: 10, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchStart(touchStartEvent);
      });

      act(() => {
        const touchEndEvent = {
          changedTouches: [{ clientX: 100, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchEnd(touchEndEvent);
      });

      expect(onSwipeRight).not.toHaveBeenCalled();
    });

    it('should handle multiple consecutive swipes', () => {
      const onSwipeRight = vi.fn();
      const onSwipeLeft = vi.fn();
      const { result } = renderHook(() =>
        useSwipeGesture({
          minDistance: 56,
          onSwipeRight,
          onSwipeLeft,
        })
      );

      // First swipe right
      act(() => {
        const touchStartEvent = {
          touches: [{ clientX: 10, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchStart(touchStartEvent);
      });

      act(() => {
        const touchEndEvent = {
          changedTouches: [{ clientX: 100, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchEnd(touchEndEvent);
      });

      expect(onSwipeRight).toHaveBeenCalledTimes(1);
      expect(onSwipeLeft).not.toHaveBeenCalled();

      // Second swipe left
      act(() => {
        const touchStartEvent = {
          touches: [{ clientX: 350, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchStart(touchStartEvent);
      });

      act(() => {
        const touchEndEvent = {
          changedTouches: [{ clientX: 200, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchEnd(touchEndEvent);
      });

      expect(onSwipeRight).toHaveBeenCalledTimes(1);
      expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle mobile menu swipe-to-open (left edge, right swipe)', () => {
      const onSwipeRight = vi.fn();
      const { result } = renderHook(() =>
        useSwipeGesture({
          enabled: true,
          minDistance: 58,
          maxCrossAxisDistance: 96,
          onSwipeRight,
        })
      );

      // Simulate swipe from left edge (18px) moving right
      act(() => {
        const touchStartEvent = {
          touches: [{ clientX: 18, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchStart(touchStartEvent);
      });

      act(() => {
        const touchEndEvent = {
          changedTouches: [{ clientX: 100, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchEnd(touchEndEvent);
      });

      expect(onSwipeRight).toHaveBeenCalledTimes(1);
    });

    it('should handle mobile menu swipe-to-close (right panel, left swipe)', () => {
      const onSwipeLeft = vi.fn();
      const { result } = renderHook(() =>
        useSwipeGesture({
          enabled: true,
          minDistance: 64,
          maxCrossAxisDistance: 88,
          onSwipeLeft,
        })
      );

      // Simulate swipe from right side (menu panel) moving left
      act(() => {
        const touchStartEvent = {
          touches: [{ clientX: 300, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchStart(touchStartEvent);
      });

      act(() => {
        const touchEndEvent = {
          changedTouches: [{ clientX: 100, clientY: 400 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchEnd(touchEndEvent);
      });

      expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    });

    it('should ignore accidental vertical swipes (scrolling)', () => {
      const onSwipeRight = vi.fn();
      const onSwipeLeft = vi.fn();
      const { result } = renderHook(() =>
        useSwipeGesture({
          minDistance: 56,
          maxCrossAxisDistance: 96,
          onSwipeRight,
          onSwipeLeft,
        })
      );

      // User attempts vertical scroll (more vertical than horizontal)
      act(() => {
        const touchStartEvent = {
          touches: [{ clientX: 100, clientY: 200 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchStart(touchStartEvent);
      });

      act(() => {
        const touchEndEvent = {
          changedTouches: [{ clientX: 110, clientY: 500 }],
        } as unknown as React.TouchEvent<HTMLElement>;
        result.current.onTouchEnd(touchEndEvent);
      });

      expect(onSwipeRight).not.toHaveBeenCalled();
      expect(onSwipeLeft).not.toHaveBeenCalled();
    });
  });
});
