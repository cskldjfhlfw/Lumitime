import { useEffect, useRef } from 'react';
import { cn } from '../lib/utils';

interface TrailPoint {
  x: number;
  y: number;
  createdAt: number;
}

interface RibbonsProps {
  baseThickness?: number;
  colors?: string[];
  speedMultiplier?: number;
  maxAge?: number;
  enableFade?: boolean;
  enableShaderEffect?: boolean;
  className?: string;
}

export default function Ribbons({
  baseThickness = 4.5,
  colors = ['#9ec5e6', '#f4c95d', '#ffffff'],
  speedMultiplier = 0.72,
  maxAge = 420,
  enableFade = true,
  enableShaderEffect = false,
  className,
}: RibbonsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<TrailPoint[]>([]);
  const frameRef = useRef<number>();
  const lastPointRef = useRef<TrailPoint | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawRibbon = (now: number) => {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      pointsRef.current = pointsRef.current.filter(point => now - point.createdAt <= maxAge);

      if (pointsRef.current.length > 1) {
        colors.forEach((color, index) => {
          context.save();
          context.lineCap = 'round';
          context.lineJoin = 'round';
          context.strokeStyle = color;
          context.lineWidth = Math.max(1.4, baseThickness - index * 1.15);
          context.globalAlpha = 0.78 - index * 0.18;
          context.filter = enableShaderEffect ? `blur(${index * 0.35}px)` : 'none';
          context.beginPath();

          pointsRef.current.forEach((point, pointIndex) => {
            const age = now - point.createdAt;
            const life = Math.max(0, 1 - age / maxAge);
            const offset = Math.sin(pointIndex * 0.65 + now * 0.006 * speedMultiplier + index) * (index + 1) * 2.2;
            const x = point.x + offset;
            const y = point.y - offset * 0.38;

            if (enableFade) context.globalAlpha = (0.72 - index * 0.14) * life;
            if (pointIndex === 0) {
              context.moveTo(x, y);
            } else {
              const previous = pointsRef.current[pointIndex - 1];
              const midX = (previous.x + x) / 2;
              const midY = (previous.y + y) / 2;
              context.quadraticCurveTo(previous.x, previous.y, midX, midY);
            }
          });

          context.stroke();
          context.restore();
        });
      }

      frameRef.current = window.requestAnimationFrame(drawRibbon);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const now = performance.now();
      const lastPoint = lastPointRef.current;
      const nextPoint = { x: event.clientX, y: event.clientY, createdAt: now };
      if (!lastPoint || Math.hypot(event.clientX - lastPoint.x, event.clientY - lastPoint.y) > 7) {
        pointsRef.current.push(nextPoint);
        lastPointRef.current = nextPoint;
      }
    };

    resize();
    frameRef.current = window.requestAnimationFrame(drawRibbon);
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, [baseThickness, colors, enableFade, enableShaderEffect, maxAge, speedMultiplier]);

  return (
    <canvas
      ref={canvasRef}
      className={cn('ribbons-canvas pointer-events-none fixed inset-0 z-[35]', className)}
      aria-hidden="true"
    />
  );
}
