import React, { useEffect, useState } from 'react';

interface VoiceWaveformProps {
  isActive: boolean;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({ isActive }) => {
  const [bars, setBars] = useState<number[]>(Array(5).fill(0.2));

  useEffect(() => {
    if (!isActive) {
      setBars(Array(5).fill(0.2));
      return;
    }

    const interval = setInterval(() => {
      setBars(Array(5).fill(0).map(() => Math.random() * 0.8 + 0.2));
    }, 100);

    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <div className="flex items-center space-x-1 h-8">
      {bars.map((height, i) => (
        <div
          key={i}
          className={`w-1 bg-neon-cyan rounded-full transition-all duration-100 ${
            isActive ? 'animate-pulse' : ''
          }`}
          style={{
            height: `${height * 24}px`,
            boxShadow: isActive ? '0 0 8px hsl(var(--neon-cyan))' : undefined,
          }}
        />
      ))}
    </div>
  );
};