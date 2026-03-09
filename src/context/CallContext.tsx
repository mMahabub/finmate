'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSocketContext } from '@/context/SocketContext';
import { useCallManager } from '@/hooks/useCallManager';
import { useWebRTC } from '@/hooks/useWebRTC';
import type { CallState } from '@/hooks/useCallManager';

interface CallContextType {
  callState: CallState;
  makeCall: (
    userId: string,
    callType: 'audio' | 'video',
    conversationId: string,
    remoteUser: { id: string; name: string; avatar_url: string | null }
  ) => string | null;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  switchCamera: () => void;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isRemoteMuted: boolean;
  isRemoteVideoOff: boolean;
  connectionState: string;
  localStreamRef: React.RefObject<MediaStream | null>;
  remoteStream: MediaStream | null;
}

const CallContext = createContext<CallContextType | null>(null);

export function useCallContext() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCallContext must be used within a CallProvider');
  }
  return context;
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { getSocket, isConnected } = useSocketContext();

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<string>('idle');

  // Build socket deps for useCallManager
  const socket = getSocket();
  const callManagerDeps = socket && user ? {
    emit: (event: string, data: Record<string, unknown>) => socket.emit(event, data),
    on: (event: string, handler: (...args: unknown[]) => void) => { socket.on(event, handler); },
    off: (event: string, handler: (...args: unknown[]) => void) => { socket.off(event, handler); },
    userId: user.id,
    isConnected,
  } : null;

  const callManager = useCallManager(callManagerDeps);

  const webrtc = useWebRTC({
    onRemoteStream: useCallback((stream: MediaStream) => {
      setRemoteStream(stream);
    }, []),
    onConnectionStateChange: useCallback((state: string) => {
      setConnectionState(state);
      if (state === 'connected') {
        callManager.setConnectionActive();
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
    onError: useCallback((error: Error) => {
      console.error('WebRTC error:', error);
    }, []),
  });

  // Store refs to latest functions to avoid stale closures
  const callManagerRef = useRef(callManager);
  callManagerRef.current = callManager;
  const webrtcRef = useRef(webrtc);
  webrtcRef.current = webrtc;

  // Bridge WebRTC signals: useCallManager <-> useWebRTC
  // When call manager receives a WebRTC signal from the remote peer, forward to local peer
  callManager.onWebRTCSignal((type: string, signal: Record<string, unknown>) => {
    if (type === 'offer') {
      // We received an offer — we need to answer the call via WebRTC
      const cs = callManagerRef.current.callState;
      webrtcRef.current.answerCall(
        cs.callType === 'video',
        signal as unknown as import('simple-peer').SignalData,
        (data) => {
          callManagerRef.current.emitWebRTCSignal(
            data.type === 'offer' ? 'offer' : data.type === 'answer' ? 'answer' : 'ice-candidate',
            data as unknown as Record<string, unknown>
          );
        }
      );
    } else if (type === 'answer') {
      webrtcRef.current.handleSignal(signal as unknown as import('simple-peer').SignalData);
    } else if (type === 'ice-candidate') {
      webrtcRef.current.handleSignal(signal as unknown as import('simple-peer').SignalData);
    }
  });

  // Wrap makeCall to also start WebRTC
  const makeCall = useCallback((
    userId: string,
    callType: 'audio' | 'video',
    conversationId: string,
    remoteUser: { id: string; name: string; avatar_url: string | null }
  ): string | null => {
    const error = callManagerRef.current.makeCall(userId, callType, conversationId, remoteUser);
    if (error) return error;

    // Start WebRTC as initiator
    webrtcRef.current.startCall(callType === 'video', (data) => {
      callManagerRef.current.emitWebRTCSignal(
        data.type === 'offer' ? 'offer' : data.type === 'answer' ? 'answer' : 'ice-candidate',
        data as unknown as Record<string, unknown>
      );
    });

    return null;
  }, []);

  // Wrap acceptCall to prepare for incoming WebRTC
  const acceptCall = useCallback(() => {
    callManagerRef.current.acceptCall();
    // The actual WebRTC answer happens when we receive the offer signal (handled above)
  }, []);

  // Wrap endCall to also clean up WebRTC
  const endCall = useCallback(() => {
    callManagerRef.current.endCall();
    webrtcRef.current.endCall();
    setRemoteStream(null);
    setConnectionState('idle');
  }, []);

  const declineCall = useCallback(() => {
    callManagerRef.current.declineCall();
    webrtcRef.current.endCall();
    setRemoteStream(null);
    setConnectionState('idle');
  }, []);

  // Audio/video toggles that also notify remote peer
  const toggleAudio = useCallback(() => {
    webrtcRef.current.toggleAudio();
    callManagerRef.current.emitAudioToggle(webrtcRef.current.isAudioMuted); // will be toggled, so send current (pre-toggle) state
  }, []);

  const toggleVideo = useCallback(() => {
    webrtcRef.current.toggleVideo();
    callManagerRef.current.emitVideoToggle(webrtcRef.current.isVideoOff);
  }, []);

  const value: CallContextType = {
    callState: callManager.callState,
    makeCall,
    acceptCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo,
    switchCamera: webrtc.switchCamera,
    isAudioMuted: webrtc.isAudioMuted,
    isVideoOff: webrtc.isVideoOff,
    isRemoteMuted: callManager.isRemoteMuted,
    isRemoteVideoOff: callManager.isRemoteVideoOff,
    connectionState,
    localStreamRef: webrtc.localStreamRef,
    remoteStream,
  };

  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
}
