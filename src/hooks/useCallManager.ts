'use client';
import { useState, useCallback, useRef, useEffect } from 'react';

interface CallState {
  status: 'idle' | 'ringing' | 'connecting' | 'active' | 'ended';
  callId: string | null;
  callType: 'audio' | 'video' | null;
  remoteUser: { id: string; name: string; avatar_url: string | null } | null;
  isIncoming: boolean;
  duration: number;
  conversationId: string | null;
}

interface IncomingCallData {
  callId: string;
  caller: { id: string; name: string; avatar_url: string | null };
  callType: 'audio' | 'video';
  conversationId: string;
}

interface CallAcceptedData {
  callId: string;
  callee: { id: string; name: string; avatar_url: string | null };
}

interface CallEndedData {
  callId: string;
  reason: 'ended' | 'declined' | 'missed' | 'error';
}

interface WebRTCSignalData {
  callId: string;
  signal: Record<string, unknown>;
}

interface RemoteToggleData {
  callId: string;
  userId: string;
  enabled: boolean;
}

export interface CallManagerDeps {
  emit: (event: string, data: Record<string, unknown>) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler: (...args: unknown[]) => void) => void;
  userId: string;
  isConnected: boolean;
}

const initialCallState: CallState = {
  status: 'idle',
  callId: null,
  callType: null,
  remoteUser: null,
  isIncoming: false,
  duration: 0,
  conversationId: null,
};

export function useCallManager(deps: CallManagerDeps | null) {
  const [callState, setCallState] = useState<CallState>(initialCallState);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isRemoteVideoOff, setIsRemoteVideoOff] = useState(false);

  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callStateRef = useRef<CallState>(initialCallState);

  // Keep ref in sync with state
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  const clearTimers = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  }, []);

  const resetToIdle = useCallback(() => {
    clearTimers();
    setIsRemoteMuted(false);
    setIsRemoteVideoOff(false);
    setTimeout(() => {
      setCallState(initialCallState);
    }, 2000);
  }, [clearTimers]);

  const startDurationTimer = useCallback(() => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    durationTimerRef.current = setInterval(() => {
      setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
    }, 1000);
  }, []);

  // ---- Public actions ----

  const makeCall = useCallback((userId: string, callType: 'audio' | 'video', conversationId: string, remoteUser: { id: string; name: string; avatar_url: string | null }): string | null => {
    if (!deps) return 'not_ready';
    if (!deps.isConnected) return 'not_connected';
    if (callStateRef.current.status !== 'idle') return 'busy';

    const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    setCallState({
      status: 'ringing',
      callId,
      callType,
      remoteUser,
      isIncoming: false,
      duration: 0,
      conversationId,
    });

    deps.emit('call_initiate', {
      callId,
      calleeId: userId,
      callType,
      conversationId,
    });

    // Ring timeout: 30 seconds
    ringTimeoutRef.current = setTimeout(() => {
      if (callStateRef.current.status === 'ringing' && !callStateRef.current.isIncoming) {
        deps.emit('call_end', { callId, reason: 'missed' });
        setCallState(prev => ({ ...prev, status: 'ended' }));
        resetToIdle();
      }
    }, 30000);

    return null; // success
  }, [deps, resetToIdle]);

  const acceptCall = useCallback(() => {
    if (!deps) return;
    const { callId } = callStateRef.current;
    if (!callId || callStateRef.current.status !== 'ringing') return;

    clearTimers();
    deps.emit('call_accept', { callId });
    setCallState(prev => ({ ...prev, status: 'connecting' }));
  }, [deps, clearTimers]);

  const declineCall = useCallback(() => {
    if (!deps) return;
    const { callId } = callStateRef.current;
    if (!callId) return;

    deps.emit('call_decline', { callId });
    setCallState(prev => ({ ...prev, status: 'ended' }));
    resetToIdle();
  }, [deps, resetToIdle]);

  const endCall = useCallback(() => {
    if (!deps) return;
    const { callId } = callStateRef.current;
    if (!callId) return;

    deps.emit('call_end', { callId, reason: 'ended' });
    setCallState(prev => ({ ...prev, status: 'ended' }));
    resetToIdle();
  }, [deps, resetToIdle]);

  const setConnectionActive = useCallback(() => {
    setCallState(prev => ({ ...prev, status: 'active' }));
    startDurationTimer();
  }, [startDurationTimer]);

  // ---- Socket event handlers ----

  useEffect(() => {
    if (!deps) return;

    const handleIncomingCall = (...args: unknown[]) => {
      const data = args[0] as IncomingCallData;
      if (callStateRef.current.status !== 'idle') {
        // Already in a call, auto-decline
        deps.emit('call_decline', { callId: data.callId });
        return;
      }

      setCallState({
        status: 'ringing',
        callId: data.callId,
        callType: data.callType,
        remoteUser: data.caller,
        isIncoming: true,
        duration: 0,
        conversationId: data.conversationId,
      });
    };

    const handleCallAccepted = (...args: unknown[]) => {
      const data = args[0] as CallAcceptedData;
      if (callStateRef.current.callId !== data.callId) return;
      clearTimers();
      setCallState(prev => ({ ...prev, status: 'connecting' }));
    };

    const handleCallDeclined = (...args: unknown[]) => {
      const data = args[0] as CallEndedData;
      if (callStateRef.current.callId !== data.callId) return;
      setCallState(prev => ({ ...prev, status: 'ended' }));
      resetToIdle();
    };

    const handleCallEnded = (...args: unknown[]) => {
      const data = args[0] as CallEndedData;
      if (callStateRef.current.callId !== data.callId) return;
      setCallState(prev => ({ ...prev, status: 'ended' }));
      resetToIdle();
    };

    const handleCallMissed = (...args: unknown[]) => {
      const data = args[0] as CallEndedData;
      if (callStateRef.current.callId !== data.callId) return;
      setCallState(prev => ({ ...prev, status: 'ended' }));
      resetToIdle();
    };

    const handleWebRTCOffer = (...args: unknown[]) => {
      const data = args[0] as WebRTCSignalData;
      if (callStateRef.current.callId !== data.callId) return;
      webrtcSignalRef.current?.('offer', data.signal);
    };

    const handleWebRTCAnswer = (...args: unknown[]) => {
      const data = args[0] as WebRTCSignalData;
      if (callStateRef.current.callId !== data.callId) return;
      webrtcSignalRef.current?.('answer', data.signal);
    };

    const handleWebRTCIceCandidate = (...args: unknown[]) => {
      const data = args[0] as WebRTCSignalData;
      if (callStateRef.current.callId !== data.callId) return;
      webrtcSignalRef.current?.('ice-candidate', data.signal);
    };

    const handleRemoteAudioToggle = (...args: unknown[]) => {
      const data = args[0] as RemoteToggleData;
      if (callStateRef.current.callId !== data.callId) return;
      setIsRemoteMuted(!data.enabled);
    };

    const handleRemoteVideoToggle = (...args: unknown[]) => {
      const data = args[0] as RemoteToggleData;
      if (callStateRef.current.callId !== data.callId) return;
      setIsRemoteVideoOff(!data.enabled);
    };

    // Dismiss incoming call if socket disconnects
    const handleDisconnect = () => {
      if (callStateRef.current.status === 'ringing' && callStateRef.current.isIncoming) {
        setCallState(prev => ({ ...prev, status: 'ended' }));
        resetToIdle();
      }
    };

    deps.on('incoming_call', handleIncomingCall);
    deps.on('call_accepted', handleCallAccepted);
    deps.on('call_declined', handleCallDeclined);
    deps.on('call_ended', handleCallEnded);
    deps.on('call_missed', handleCallMissed);
    deps.on('webrtc_offer', handleWebRTCOffer);
    deps.on('webrtc_answer', handleWebRTCAnswer);
    deps.on('webrtc_ice_candidate', handleWebRTCIceCandidate);
    deps.on('remote_audio_toggle', handleRemoteAudioToggle);
    deps.on('remote_video_toggle', handleRemoteVideoToggle);
    deps.on('disconnect', handleDisconnect);

    return () => {
      deps.off('incoming_call', handleIncomingCall);
      deps.off('call_accepted', handleCallAccepted);
      deps.off('call_declined', handleCallDeclined);
      deps.off('call_ended', handleCallEnded);
      deps.off('call_missed', handleCallMissed);
      deps.off('webrtc_offer', handleWebRTCOffer);
      deps.off('webrtc_answer', handleWebRTCAnswer);
      deps.off('webrtc_ice_candidate', handleWebRTCIceCandidate);
      deps.off('remote_audio_toggle', handleRemoteAudioToggle);
      deps.off('remote_video_toggle', handleRemoteVideoToggle);
      deps.off('disconnect', handleDisconnect);
    };
  }, [deps, clearTimers, resetToIdle]);

  // Ref for external WebRTC signal handler
  const webrtcSignalRef = useRef<((type: string, signal: Record<string, unknown>) => void) | null>(null);

  const onWebRTCSignal = useCallback((handler: (type: string, signal: Record<string, unknown>) => void) => {
    webrtcSignalRef.current = handler;
  }, []);

  const emitWebRTCSignal = useCallback((type: 'offer' | 'answer' | 'ice-candidate', signal: Record<string, unknown>) => {
    if (!deps) return;
    const { callId } = callStateRef.current;
    if (!callId) return;

    const eventMap: Record<string, string> = {
      'offer': 'webrtc_offer',
      'answer': 'webrtc_answer',
      'ice-candidate': 'webrtc_ice_candidate',
    };

    deps.emit(eventMap[type], { callId, signal });
  }, [deps]);

  const emitAudioToggle = useCallback((enabled: boolean) => {
    if (!deps) return;
    const { callId } = callStateRef.current;
    if (!callId) return;
    deps.emit('call_toggle_audio', { callId, enabled });
  }, [deps]);

  const emitVideoToggle = useCallback((enabled: boolean) => {
    if (!deps) return;
    const { callId } = callStateRef.current;
    if (!callId) return;
    deps.emit('call_toggle_video', { callId, enabled });
  }, [deps]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    callState,
    makeCall,
    acceptCall,
    declineCall,
    endCall,
    setConnectionActive,
    isRemoteMuted,
    isRemoteVideoOff,
    onWebRTCSignal,
    emitWebRTCSignal,
    emitAudioToggle,
    emitVideoToggle,
  };
}

export type { CallState, IncomingCallData };
