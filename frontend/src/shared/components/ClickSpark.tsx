import { useEffect, useRef } from 'react';

interface Spark {
  x: number;
  y: number;
  angle: number;
  createdAt: number;
}

interface ClickSparkProps {
  sparkColor?: string;
  sparkSize?: number;
  sparkRadius?: number;
  sparkCount?: number;
  duration?: number;
  children: React.ReactNode;
}

export default function ClickSpark({
  sparkColor = '#ffffff',
  sparkSize = 10,
  sparkRadius = 15,
  sparkCount = 8,
  duration = 400,
  children,
}: ClickSparkProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparksRef = useRef<Spark[]>([]);
  const frameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      sparksRef.current = sparksRef.current.filter(spark => now - spark.createdAt < duration);

      sparksRef.current.forEach(spark => {
        const progress = Math.min((now - spark.createdAt) / duration, 1);
        const distance = progress * sparkRadius;
        const fade = 1 - progress;
        const tailDistance = Math.max(0, distance - sparkSize);
        const startX = spark.x + Math.cos(spark.angle) * tailDistance;
        const startY = spark.y + Math.sin(spark.angle) * tailDistance;
        const endX = spark.x + Math.cos(spark.angle) * distance;
        const endY = spark.y + Math.sin(spark.angle) * distance;

        context.save();
        context.globalAlpha = fade;
        context.strokeStyle = resolveCanvasColor(sparkColor);
        context.lineWidth = 1.6;
        context.lineCap = 'round';
        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(endX, endY);
        context.stroke();
        context.restore();
      });

      if (sparksRef.current.length > 0) {
        frameRef.current = window.requestAnimationFrame(draw);
      } else {
        frameRef.current = undefined;
      }
    };

    const handleClick = (event: MouseEvent) => {
      const createdAt = performance.now();
      const nextSparks = Array.from({ length: sparkCount }, (_, index) => ({
        x: event.clientX,
        y: event.clientY,
        angle: (Math.PI * 2 * index) / sparkCount,
        createdAt,
      }));
      sparksRef.current.push(...nextSparks);
      if (!frameRef.current) frameRef.current = window.requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('click', handleClick, { passive: true });

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('click', handleClick);
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, [duration, sparkColor, sparkCount, sparkRadius]);

  return (
    <div className="relative min-h-screen">
      {children}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-[80]"
        aria-hidden="true"
      />
    </div>
  );
}

function resolveCanvasColor(color: string) {
  const variableName = color.match(/^var\((--[^),\s]+)\)$/)?.[1];
  if (!variableName || typeof window === 'undefined') return color;
  return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim() || color;
}
