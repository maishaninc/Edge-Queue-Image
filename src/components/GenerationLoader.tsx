'use client';

import { useEffect, useId, useRef } from 'react';

// Animated "drawing" loader built on anime.js v4, mirroring the drawable-stroke
// pattern used in MX-Insight-Web. The Aivro mark is stroked on, then the
// surrounding sparks pulse, looping while a generation job is running.
export default function GenerationLoader({ className = '' }: { className?: string }) {
  const rootRef = useRef<SVGSVGElement>(null);
  const titleId = useId();

  useEffect(() => {
    let disposed = false;
    const animations: Array<{ revert?: () => void; cancel?: () => void; pause?: () => void }> = [];
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      return undefined;
    }

    void (async () => {
      const { animate, stagger } = await import('animejs');
      const { createDrawable } = await import('animejs/svg');
      if (disposed || !rootRef.current) return;

      const strokes = Array.from(rootRef.current.querySelectorAll<SVGPathElement>('.loader-stroke'));
      const drawables = strokes.flatMap((stroke) => createDrawable(stroke));

      animations.push(
        animate(drawables, {
          draw: ['0 0', '0 1', '1 1'],
          ease: 'inOutQuad',
          duration: 2200,
          delay: stagger(140),
          loop: true,
          loopDelay: 260,
        }),
      );

      const sparks = Array.from(rootRef.current.querySelectorAll<SVGCircleElement>('.loader-spark'));
      if (sparks.length) {
        animations.push(
          animate(sparks, {
            opacity: [0.15, 1, 0.15],
            scale: [0.6, 1.25, 0.6],
            ease: 'inOutSine',
            duration: 1600,
            delay: stagger(180),
            loop: true,
          }),
        );
      }
    })();

    return () => {
      disposed = true;
      animations.forEach((animation) => {
        animation.revert?.();
        animation.cancel?.();
        animation.pause?.();
      });
    };
  }, []);

  return (
    <svg
      ref={rootRef}
      viewBox="0 0 64 64"
      role="img"
      aria-labelledby={titleId}
      className={`generation-loader ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id={titleId}>Generating</title>
      <g stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
        <path className="loader-stroke" d="M32 8L58 54H46L32 29L18 54H6L32 8Z" />
        <path className="loader-stroke" d="M32 40L40 54H24L32 40Z" />
      </g>
      <g fill="currentColor" stroke="none">
        <circle className="loader-spark" cx="12" cy="14" r="2.4" />
        <circle className="loader-spark" cx="54" cy="18" r="2" />
        <circle className="loader-spark" cx="50" cy="44" r="2.6" />
      </g>
    </svg>
  );
}
