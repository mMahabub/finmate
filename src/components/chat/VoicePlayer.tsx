'use client';
import { useState, useRef, useEffect, useMemo } from 'react';

interface VoicePlayerProps {
  url: string;
  duration: number;
  isSent: boolean;
}

function hashString(str: string): number {
  return str.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0);
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s & 0x7fffffff) / 0x7fffffff;
  };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const PlayIcon = ({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
    <polygon points="6,3 20,12 6,21" />
  </svg>
);

const PauseIcon = ({ color = 'currentColor', size = 16 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
    <rect x="5" y="3" width="5" height="18" rx="1" />
    <rect x="14" y="3" width="5" height="18" rx="1" />
  </svg>
);

const PLAYBACK_RATES = [1, 1.5, 2] as const;

export default function VoicePlayer({ url, duration, isSent }: VoicePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [rateIndex, setRateIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number>(0);

  const isLegacyUrl = url.startsWith('/uploads/');

  const bars = useMemo(() => {
    const hash = hashString(url);
    const rng = seededRandom(Math.abs(hash));
    return Array.from({ length: 25 }, () => 0.3 + rng() * 0.7);
  }, [url]);

  useEffect(() => {
    if (isLegacyUrl) return;
    const audio = new Audio(url);
    audioRef.current = audio;

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [url, isLegacyUrl]);

  useEffect(() => {
    if (isLegacyUrl) return;
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      if (!audio.paused) {
        animFrameRef.current = requestAnimationFrame(updateTime);
      }
    };

    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(updateTime);
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isPlaying, isLegacyUrl]);

  // Old voice messages stored on ephemeral filesystem are gone after redeploy
  if (isLegacyUrl) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, width: 250,
        padding: '8px 12px', opacity: 0.5,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          backgroundColor: isSent ? 'rgba(255,255,255,0.2)' : 'var(--color-accent-primary, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
        <span style={{
          fontSize: 12,
          color: isSent ? 'rgba(255,255,255,0.6)' : 'var(--color-text-secondary, #6b7280)',
          fontStyle: 'italic',
        }}>
          Voice message unavailable
        </span>
      </div>
    );
  }

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.error('Playback error:', err);
      });
    }
  };

  const cycleRate = () => {
    const nextIndex = (rateIndex + 1) % PLAYBACK_RATES.length;
    setRateIndex(nextIndex);
    if (audioRef.current) {
      audioRef.current.playbackRate = PLAYBACK_RATES[nextIndex];
    }
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const displayTime = isPlaying || currentTime > 0
    ? `${formatTime(currentTime)} / ${formatTime(duration)}`
    : formatTime(duration);

  const accentColor = isSent ? '#ffffff' : 'var(--color-accent-primary, #6366f1)';
  const dimColor = isSent ? 'rgba(255,255,255,0.35)' : 'rgba(100,100,100,0.25)';
  const secondaryTextColor = isSent ? 'rgba(255,255,255,0.7)' : 'var(--color-text-secondary, #6b7280)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '250px',
        padding: '8px 12px',
      }}
    >
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        type="button"
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: 'none',
          backgroundColor: isSent ? 'rgba(255,255,255,0.2)' : 'var(--color-accent-primary, #6366f1)',
          color: isSent ? '#fff' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          padding: 0,
        }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <PauseIcon size={14} color="#fff" />
        ) : (
          <PlayIcon size={14} color="#fff" />
        )}
      </button>

      {/* Waveform and info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Waveform bars */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            height: '28px',
            gap: '2px',
          }}
        >
          {bars.map((height, i) => {
            const barProgress = i / bars.length;
            const isPlayed = barProgress <= progress;
            return (
              <div
                key={i}
                style={{
                  width: '3px',
                  height: `${height * 100}%`,
                  borderRadius: '1.5px',
                  backgroundColor: isPlayed ? accentColor : dimColor,
                  transition: 'background-color 0.1s',
                  flexShrink: 0,
                }}
              />
            );
          })}
        </div>

        {/* Duration and speed */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '4px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              color: secondaryTextColor,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {displayTime}
          </span>

          <button
            onClick={cycleRate}
            type="button"
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: secondaryTextColor,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 4px',
              borderRadius: '4px',
              lineHeight: 1,
            }}
            aria-label={`Playback speed ${PLAYBACK_RATES[rateIndex]}x`}
          >
            {PLAYBACK_RATES[rateIndex]}x
          </button>
        </div>
      </div>
    </div>
  );
}
