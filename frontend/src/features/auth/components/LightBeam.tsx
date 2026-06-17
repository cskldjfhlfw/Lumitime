interface LightBeamProps {
  intensified?: boolean;
}

export function LightBeam({ intensified = false }: LightBeamProps) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Main cone beam from top center */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-0 w-full"
        style={{
          height: '100%',
          background:
            'conic-gradient(from 180deg at 50% 0%, transparent 162deg, rgba(255,252,235,0.10) 170deg, rgba(255,252,235,0.18) 180deg, rgba(255,252,235,0.10) 190deg, transparent 198deg)',
          animation: 'beamPulse 4s ease-in-out infinite',
          opacity: intensified ? 1.4 : 1,
          transition: 'opacity 0.8s ease',
        }}
      />

      {/* Soft radial glow at beam base */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-0"
        style={{
          width: '200px',
          height: '120px',
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(255,252,235,0.20) 0%, transparent 70%)',
          animation: 'glowPulse 4s ease-in-out infinite',
        }}
      />

      {/* Dust particles */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${2 + (i % 3)}px`,
            height: `${2 + (i % 3)}px`,
            left: `${38 + i * 3.5}%`,
            top: `${10 + i * 9}%`,
            background: `rgba(255,252,235,${0.05 + (i % 4) * 0.04})`,
            animation: `dust${i % 3} ${5 + i * 0.7}s ease-in-out infinite`,
          }}
        />
      ))}

      <style>{`
        @keyframes beamPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes dust0 {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.4; }
          50% { transform: translateY(-12px) translateX(4px); opacity: 0.8; }
        }
        @keyframes dust1 {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          50% { transform: translateY(10px) translateX(-6px); opacity: 0.7; }
        }
        @keyframes dust2 {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.5; }
          50% { transform: translateY(-8px) translateX(8px); opacity: 0.9; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
