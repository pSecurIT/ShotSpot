import { useRef } from 'react';
import type { TouchEvent } from 'react';

type SwipeDirection = 'left' | 'right';

type UseSwipeGestureOptions = {
  enabled?: boolean;
  minDistance?: number;
  maxCrossAxisDistance?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

type Point = {
  x: number;
  y: number;
};

export function useSwipeGesture({
  enabled = true,
  minDistance = 56,
  maxCrossAxisDistance = 96,
  onSwipeLeft,
  onSwipeRight,
}: UseSwipeGestureOptions) {
  const startPointRef = useRef<Point | null>(null);

  const reset = () => {
    startPointRef.current = null;
  };

  const triggerSwipe = (direction: SwipeDirection) => {
    if (direction === 'left') {
      onSwipeLeft?.();
      return;
    }

    onSwipeRight?.();
  };

  const evaluateSwipe = (endX: number, endY: number) => {
    const startPoint = startPointRef.current;
    if (!enabled || !startPoint) {
      reset();
      return;
    }

    const deltaX = endX - startPoint.x;
    const deltaY = endY - startPoint.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < minDistance || absY > maxCrossAxisDistance) {
      reset();
      return;
    }

    if (deltaX > 0) {
      triggerSwipe('right');
    } else {
      triggerSwipe('left');
    }

    reset();
  };

  return {
    onTouchStart: (event: TouchEvent<HTMLElement>) => {
      if (!enabled) return;
      const touch = event.touches[0];
      if (!touch) return;
      startPointRef.current = { x: touch.clientX, y: touch.clientY };
    },
    onTouchEnd: (event: TouchEvent<HTMLElement>) => {
      const touch = event.changedTouches[0];
      if (!touch) {
        reset();
        return;
      }

      evaluateSwipe(touch.clientX, touch.clientY);
    },
    onTouchCancel: () => {
      reset();
    },
  };
}
