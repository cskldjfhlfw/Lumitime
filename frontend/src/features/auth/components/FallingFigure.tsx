import { motion } from 'motion/react';

interface FallingFigureProps {
  flipped?: boolean;
}

export function FallingFigure({ flipped = false }: FallingFigureProps) {
  return (
    <motion.div
      className="absolute bottom-1/3 left-1/2 -translate-x-1/2 select-none pointer-events-none"
      animate={{
        rotate: flipped ? 180 : 0,
        y: flipped ? [0, -30, 20] : 0,
        scale: flipped ? [1, 1.1, 1] : 1,
      }}
      transition={{
        duration: 1.0,
        ease: [0.4, 0, 0.2, 1],
      }}
    >
      {/* Gentle floating idle animation */}
      <motion.div
        animate={!flipped ? { y: [0, -8, 0] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg
          width="64"
          height="120"
          viewBox="0 0 64 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Head */}
          <circle cx="32" cy="14" r="10" fill="white" fillOpacity="0.9" />

          {/* Body */}
          <path
            d="M32 24 L28 55 L36 55 Z"
            fill="white"
            fillOpacity="0.85"
          />

          {/* Left arm — reaching down */}
          <path
            d="M28 32 Q18 42 14 58"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
            strokeOpacity="0.85"
          />

          {/* Right arm — reaching down */}
          <path
            d="M36 32 Q46 42 50 58"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
            strokeOpacity="0.85"
          />

          {/* Left leg */}
          <path
            d="M30 55 Q26 80 22 100"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
            strokeOpacity="0.85"
          />

          {/* Right leg */}
          <path
            d="M34 55 Q38 80 42 100"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
            strokeOpacity="0.85"
          />
        </svg>
      </motion.div>
    </motion.div>
  );
}
