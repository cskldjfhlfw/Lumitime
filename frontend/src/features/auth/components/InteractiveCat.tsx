import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useSpring } from 'motion/react';

export function InteractiveCat() {
  const [following, setFollowing] = useState(false);
  const [catPos, setCatPos] = useState({ x: 0, y: 0 });
  const mouseRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef<number>(0);
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const x = useSpring(0, { stiffness: 60, damping: 18 });
  const y = useSpring(0, { stiffness: 60, damping: 18 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY };

    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    idleTimeoutRef.current = setTimeout(() => setFollowing(false), 4000);
  }, []);

  useEffect(() => {
    if (!following) return;

    window.addEventListener('mousemove', handleMouseMove);

    const animate = () => {
      x.set(mouseRef.current.x - 24);
      y.set(mouseRef.current.y - 24);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafRef.current);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, [following, handleMouseMove, x, y]);

  useEffect(() => {
    const inputs = document.querySelectorAll('input');
    const stopFollowing = () => setFollowing(false);
    inputs.forEach(el => el.addEventListener('focus', stopFollowing));
    return () => inputs.forEach(el => el.removeEventListener('focus', stopFollowing));
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!following) {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      x.set(e.clientX - 24);
      y.set(e.clientY - 24);
    }
    setFollowing(prev => !prev);
  };

  return (
    <>
      {/* Static position at bottom-right of left panel */}
      {!following && (
        <motion.div
          className="absolute bottom-6 right-4 cursor-pointer select-none z-20"
          onClick={handleClick}
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          title="点击我"
        >
          <CatSvg />
        </motion.div>
      )}

      {/* Following state — fixed position */}
      {following && (
        <motion.div
          className="fixed cursor-pointer select-none z-50"
          style={{ x, y, pointerEvents: 'auto' }}
          onClick={handleClick}
        >
          <CatSvg active />
        </motion.div>
      )}
    </>
  );
}

function CatSvg({ active = false }: { active?: boolean }) {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="小猫"
    >
      {/* Body */}
      <ellipse cx="24" cy="30" rx="14" ry="12" fill="white" fillOpacity="0.88" />

      {/* Head */}
      <circle cx="24" cy="16" r="11" fill="white" fillOpacity="0.92" />

      {/* Left ear */}
      <polygon points="13,9 9,1 17,7" fill="white" fillOpacity="0.92" />
      {/* Left ear inner */}
      <polygon points="13,8 10,3 16,7" fill="#888" fillOpacity="0.4" />

      {/* Right ear */}
      <polygon points="35,9 39,1 31,7" fill="white" fillOpacity="0.92" />
      {/* Right ear inner */}
      <polygon points="35,8 38,3 32,7" fill="#888" fillOpacity="0.4" />

      {/* Eyes */}
      <ellipse cx="19" cy="15" rx="2.5" ry={active ? 2 : 1.5} fill="#111" />
      <ellipse cx="29" cy="15" rx="2.5" ry={active ? 2 : 1.5} fill="#111" />
      {/* Eye gleam */}
      <circle cx="20" cy="14" r="0.8" fill="white" />
      <circle cx="30" cy="14" r="0.8" fill="white" />

      {/* Nose */}
      <polygon points="24,19 22.5,21 25.5,21" fill="#ccc" fillOpacity="0.8" />

      {/* Mouth */}
      <path d="M22.5 21 Q24 23 25.5 21" stroke="#aaa" strokeWidth="0.8" fill="none" />

      {/* Whiskers left */}
      <line x1="8" y1="18" x2="20" y2="19" stroke="#aaa" strokeWidth="0.7" strokeOpacity="0.7" />
      <line x1="8" y1="21" x2="20" y2="21" stroke="#aaa" strokeWidth="0.7" strokeOpacity="0.7" />

      {/* Whiskers right */}
      <line x1="40" y1="18" x2="28" y2="19" stroke="#aaa" strokeWidth="0.7" strokeOpacity="0.7" />
      <line x1="40" y1="21" x2="28" y2="21" stroke="#aaa" strokeWidth="0.7" strokeOpacity="0.7" />

      {/* Tail */}
      <path
        d="M37 35 Q44 30 42 40 Q40 46 36 42"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        strokeOpacity="0.88"
      />

      {/* Paws */}
      <ellipse cx="16" cy="40" rx="5" ry="3" fill="white" fillOpacity="0.85" />
      <ellipse cx="32" cy="40" rx="5" ry="3" fill="white" fillOpacity="0.85" />
    </svg>
  );
}
