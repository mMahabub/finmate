'use client';
import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ActiveCallProps {
  callType: 'audio' | 'video';
  remoteUser: { name: string; avatar_url: string | null };
  duration: number;
  localStreamRef: React.RefObject<MediaStream | null>;
  remoteStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isRemoteMuted: boolean;
  isRemoteVideoOff: boolean;
  connectionState: string;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onSwitchCamera: () => void;
  onEndCall: () => void;
}

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};

function AvatarCircle({ name, avatarUrl, size }: { name: string; avatarUrl: string | null; size: number }) {
  const initial = name?.charAt(0)?.toUpperCase() || '?';
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: avatarUrl
          ? `url(${avatarUrl}) center/cover no-repeat`
          : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 0 30px rgba(99, 102, 241, 0.3)',
        flexShrink: 0,
      }}
    >
      {!avatarUrl && (
        <span style={{ color: '#fff', fontSize: size * 0.4, fontWeight: 700 }}>
          {initial}
        </span>
      )}
    </div>
  );
}

// Inline SVG icon components
function MicIcon({ muted }: { muted: boolean }) {
  if (muted) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="1" x2="23" y2="23" />
        <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6" />
        <path d="M17 16.95A7 7 0 015 12" />
        <path d="M19 12a7 7 0 01-.11 1.23" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    );
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function CameraIcon({ off }: { off: boolean }) {
  if (off) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    );
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function SwitchCameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

function PhoneOffIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91" />
      <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
  );
}

function SpeakerIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#fff' : '#fff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      {active && (
        <>
          <path d="M19.07 4.93a10 10 0 010 14.14" />
          <path d="M15.54 8.46a5 5 0 010 7.07" />
        </>
      )}
    </svg>
  );
}

export default function ActiveCall({
  callType,
  remoteUser,
  duration,
  localStreamRef,
  remoteStream,
  isAudioMuted,
  isVideoOff,
  isRemoteMuted,
  isRemoteVideoOff,
  connectionState,
  onToggleAudio,
  onToggleVideo,
  onSwitchCamera,
  onEndCall,
}: ActiveCallProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [localStreamRef]);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Auto-hide controls for video calls
  const scheduleHide = useCallback(() => {
    if (callType !== 'video') return;
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 3000);
  }, [callType]);

  useEffect(() => {
    if (callType === 'video') {
      scheduleHide();
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [callType, scheduleHide]);

  const handleTap = useCallback(() => {
    if (callType !== 'video') return;
    setControlsVisible(prev => !prev);
    scheduleHide();
  }, [callType, scheduleHide]);

  const isRinging = connectionState === 'ringing';
  const isConnecting = connectionState === 'connecting';
  const isFailed = connectionState === 'failed';
  const isClosed = connectionState === 'closed';
  const statusText = isFailed
    ? 'Call failed - network issue'
    : isClosed
      ? 'Call ended'
      : isRinging
        ? 'Ringing...'
        : isConnecting
          ? 'Connecting...'
          : formatDuration(duration);

  // ---- Audio Call Layout ----
  if (callType === 'audio') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.9)',
        }}
      >
        {/* Avatar */}
        <div style={{ marginBottom: 24 }}>
          <AvatarCircle name={remoteUser.name} avatarUrl={remoteUser.avatar_url} size={100} />
        </div>

        {/* Name */}
        <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 600, margin: 0, marginBottom: 8 }}>
          {remoteUser.name}
        </h2>

        {/* Status / Duration */}
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, margin: 0, marginBottom: 8 }}>
          {statusText}
        </p>

        {/* Remote muted indicator */}
        {isRemoteMuted && (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0, marginBottom: 4 }}>
            Muted
          </p>
        )}

        {/* Spacer */}
        <div style={{ flex: 1, minHeight: 60 }} />

        {/* Controls */}
        <div style={{ display: 'flex', gap: 24, paddingBottom: 60 }}>
          {/* Mute */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onToggleAudio}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: isAudioMuted ? '#fff' : 'rgba(255,255,255,0.15)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            <div style={{ color: isAudioMuted ? '#000' : '#fff', display: 'flex' }}>
              <MicIcon muted={isAudioMuted} />
            </div>
          </motion.button>

          {/* End call */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onEndCall}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)',
            }}
            aria-label="End call"
          >
            <PhoneOffIcon />
          </motion.button>

          {/* Speaker */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setSpeakerOn(prev => !prev)}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              backgroundColor: speakerOn ? '#fff' : 'rgba(255,255,255,0.15)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label={speakerOn ? 'Speaker off' : 'Speaker on'}
          >
            <div style={{ color: speakerOn ? '#000' : '#fff', display: 'flex' }}>
              <SpeakerIcon active={speakerOn} />
            </div>
          </motion.button>
        </div>
      </motion.div>
    );
  }

  // ---- Video Call Layout ----
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={handleTap}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Remote video / avatar */}
      {isRemoteVideoOff || !remoteStream ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.9)',
          }}
        >
          <AvatarCircle name={remoteUser.name} avatarUrl={remoteUser.avatar_url} size={120} />
        </div>
      ) : (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{
            flex: 1,
            width: '100%',
            objectFit: 'cover',
            background: '#000',
          }}
        />
      )}

      {/* Local video PIP */}
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          right: 16,
          width: 120,
          height: 160,
          borderRadius: 16,
          overflow: 'hidden',
          border: '2px solid rgba(255,255,255,0.3)',
          background: '#1a1a2e',
        }}
      >
        {isVideoOff ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AvatarCircle name="You" avatarUrl={null} size={48} />
          </div>
        ) : (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: 'scaleX(-1)',
            }}
          />
        )}
      </div>

      {/* Top overlay: name and duration */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              padding: '48px 20px 16px',
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                color: '#fff',
                fontSize: 18,
                fontWeight: 600,
                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
              }}
            >
              {remoteUser.name}
              {isRemoteMuted && (
                <span style={{ fontSize: 12, marginLeft: 8, opacity: 0.6 }}>
                  (Muted)
                </span>
              )}
            </span>
            <span
              style={{
                color: '#fff',
                fontSize: 16,
                fontWeight: 500,
                textShadow: '0 1px 4px rgba(0,0,0,0.5)',
              }}
            >
              {statusText}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom controls */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              bottom: 40,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 20,
              padding: '12px 24px',
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRadius: 40,
            }}
          >
            {/* Mute mic */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onToggleAudio}
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: isAudioMuted ? '#fff' : 'rgba(255,255,255,0.2)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              <div style={{ color: isAudioMuted ? '#000' : '#fff', display: 'flex' }}>
                <MicIcon muted={isAudioMuted} />
              </div>
            </motion.button>

            {/* Camera toggle */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onToggleVideo}
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: isVideoOff ? '#fff' : 'rgba(255,255,255,0.2)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
            >
              <div style={{ color: isVideoOff ? '#000' : '#fff', display: 'flex' }}>
                <CameraIcon off={isVideoOff} />
              </div>
            </motion.button>

            {/* Switch camera */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onSwitchCamera}
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.2)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Switch camera"
            >
              <SwitchCameraIcon />
            </motion.button>

            {/* End call */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onEndCall}
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)',
              }}
              aria-label="End call"
            >
              <PhoneOffIcon />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
