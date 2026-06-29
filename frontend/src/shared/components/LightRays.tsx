import { useEffect, useRef } from 'react';
import { cn } from '../lib/utils';

type RaysOrigin = 'top-left' | 'top-center' | 'top-right' | 'center';

interface LightRaysProps {
  raysOrigin?: RaysOrigin;
  raysColor?: string;
  raysSpeed?: number;
  lightSpread?: number;
  rayLength?: number;
  followMouse?: boolean;
  mouseInfluence?: number;
  noiseAmount?: number;
  distortion?: number;
  className?: string;
  pulsating?: boolean;
  fadeDistance?: number;
  saturation?: number;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export default function LightRays({
  raysOrigin = 'top-center',
  raysColor = '#fff7dc',
  raysSpeed = 0.85,
  lightSpread = 0.5,
  rayLength = 2.8,
  followMouse = true,
  mouseInfluence = 0.08,
  noiseAmount = 0,
  distortion = 0,
  className,
  pulsating = false,
  fadeDistance = 1,
  saturation = 1,
}: LightRaysProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0.5, y: 0.2 });
  const frameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    let width = 0;
    let height = 0;
    const color = parseColor(raysColor);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const originFor = () => {
      const base = {
        'top-left': { x: width * 0.08, y: 0 },
        'top-center': { x: width * 0.5, y: 0 },
        'top-right': { x: width * 0.92, y: 0 },
        center: { x: width * 0.5, y: height * 0.45 },
      }[raysOrigin];

      if (!followMouse) return base;
      const influenceX = (pointerRef.current.x - 0.5) * width * mouseInfluence;
      const influenceY = (pointerRef.current.y - 0.2) * height * mouseInfluence;
      return { x: base.x + influenceX, y: base.y + influenceY };
    };

    const draw = (now: number) => {
      context.clearRect(0, 0, width, height);
      const origin = originFor();
      const beamCount = 16;
      const spread = Math.PI * Math.max(0.18, Math.min(lightSpread, 1));
      const startAngle = Math.PI / 2 - spread / 2;
      const length = Math.max(width, height) * Math.max(1.1, rayLength);
      const pulse = pulsating ? 0.92 + Math.sin(now / 900) * 0.08 : 1;
      const drift = (now / 7000) * raysSpeed;

      context.save();
      context.globalCompositeOperation = 'lighter';
      context.filter = `saturate(${saturation}) blur(0.3px)`;

      for (let index = 0; index < beamCount; index += 1) {
        const t = index / Math.max(1, beamCount - 1);
        const wobble = Math.sin(drift + index * 1.7) * 0.055 * (1 + distortion);
        const angle = startAngle + t * spread + wobble;
        const widthScale = 0.18 + Math.sin(drift * 1.4 + index) * 0.04 + noiseAmount * 0.05;
        const halfWidth = (18 + width * widthScale * 0.08) * (0.75 + t * 0.35);
        const endX = origin.x + Math.cos(angle) * length;
        const endY = origin.y + Math.sin(angle) * length;
        const normalX = Math.cos(angle + Math.PI / 2) * halfWidth;
        const normalY = Math.sin(angle + Math.PI / 2) * halfWidth;
        const alpha = (0.08 + (1 - Math.abs(t - 0.5) * 2) * 0.12) * pulse * fadeDistance;

        const gradient = context.createLinearGradient(origin.x, origin.y, endX, endY);
        gradient.addColorStop(0, rgba(color, alpha * 0.9));
        gradient.addColorStop(0.38, rgba(color, alpha * 0.45));
        gradient.addColorStop(1, rgba(color, 0));

        context.fillStyle = gradient;
        context.beginPath();
        context.moveTo(origin.x, origin.y);
        context.lineTo(endX + normalX, endY + normalY);
        context.lineTo(endX - normalX, endY - normalY);
        context.closePath();
        context.fill();
      }

      context.restore();
      frameRef.current = window.requestAnimationFrame(draw);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current = {
        x: (event.clientX - rect.left) / Math.max(1, rect.width),
        y: (event.clientY - rect.top) / Math.max(1, rect.height),
      };
    };

    resize();
    frameRef.current = window.requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    if (followMouse) window.addEventListener('pointermove', handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, [
    distortion,
    fadeDistance,
    followMouse,
    lightSpread,
    mouseInfluence,
    noiseAmount,
    pulsating,
    rayLength,
    raysColor,
    raysOrigin,
    raysSpeed,
    saturation,
  ]);

  return <canvas ref={canvasRef} className={cn('light-rays pointer-events-none absolute inset-0 h-full w-full', className)} aria-hidden="true" />;
}

function parseColor(color: string): Rgb {
  if (color.startsWith('#')) {
    const normalized = color.length === 4
      ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
      : color;
    return {
      r: Number.parseInt(normalized.slice(1, 3), 16),
      g: Number.parseInt(normalized.slice(3, 5), 16),
      b: Number.parseInt(normalized.slice(5, 7), 16),
    };
  }
  return { r: 255, g: 247, b: 220 };
}

function rgba(color: Rgb, alpha: number) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${Math.max(0, Math.min(alpha, 1))})`;
}
