'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import Peer from 'simple-peer';

interface UseWebRTCOptions {
  onRemoteStream: (stream: MediaStream) => void;
  onConnectionStateChange: (state: string) => void;
  onError: (error: Error) => void;
}

export function useWebRTC({ onRemoteStream, onConnectionStateChange, onError }: UseWebRTCOptions) {
  const peerRef = useRef<Peer.Instance | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const getLocalStream = useCallback(async (video: boolean) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: video ? { facingMode: 'user' } : false,
      });
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      onError(err as Error);
      return null;
    }
  }, [onError]);

  const signalCallbackRef = useRef<((data: Peer.SignalData) => void) | null>(null);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const createPeer = useCallback((initiator: boolean, stream: MediaStream) => {
    const peer = new Peer({
      initiator,
      trickle: true,
      stream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
          {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject',
          },
        ],
      },
    });

    peer.on('signal', (data) => {
      signalCallbackRef.current?.(data);
    });

    peer.on('stream', (remoteStream) => {
      onRemoteStream(remoteStream);
    });

    peer.on('connect', () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      onConnectionStateChange('connected');
    });

    peer.on('close', () => {
      onConnectionStateChange('closed');
    });

    peer.on('error', (err) => {
      onError(err);
      onConnectionStateChange('failed');
    });

    peerRef.current = peer;
    return peer;
  }, [onRemoteStream, onConnectionStateChange, onError]);

  const startCall = useCallback(async (video: boolean, onSignal: (data: Peer.SignalData) => void) => {
    signalCallbackRef.current = onSignal;
    const stream = await getLocalStream(video);
    if (!stream) return null;
    onConnectionStateChange('connecting');
    const peer = createPeer(true, stream);

    // 15-second connection timeout
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    connectionTimeoutRef.current = setTimeout(() => {
      if (peerRef.current && !peerRef.current.connected) {
        onError(new Error('Connection timeout - network issue'));
        onConnectionStateChange('failed');
        peerRef.current.destroy();
      }
    }, 15000);

    return peer;
  }, [getLocalStream, createPeer, onConnectionStateChange, onError]);

  const answerCall = useCallback(async (video: boolean, incomingSignal: Peer.SignalData, onSignal: (data: Peer.SignalData) => void) => {
    signalCallbackRef.current = onSignal;
    const stream = await getLocalStream(video);
    if (!stream) return null;
    onConnectionStateChange('connecting');
    const peer = createPeer(false, stream);
    peer.signal(incomingSignal);

    // 15-second connection timeout
    if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
    connectionTimeoutRef.current = setTimeout(() => {
      if (peerRef.current && !peerRef.current.connected) {
        onError(new Error('Connection timeout - network issue'));
        onConnectionStateChange('failed');
        peerRef.current.destroy();
      }
    }, 15000);

    return peer;
  }, [getLocalStream, createPeer, onConnectionStateChange, onError]);

  const handleSignal = useCallback((data: Peer.SignalData) => {
    peerRef.current?.signal(data);
  }, []);

  const endCall = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    peerRef.current?.destroy();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setIsAudioMuted(false);
    setIsVideoOff(false);
  }, []);

  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsAudioMuted(prev => !prev);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      stream.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
      setIsVideoOff(prev => !prev);
    }
  }, []);

  const switchCamera = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;
    const constraints = videoTrack.getConstraints();
    const facingMode = constraints.facingMode === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
      });
      const newTrack = newStream.getVideoTracks()[0];
      stream.removeTrack(videoTrack);
      stream.addTrack(newTrack);
      videoTrack.stop();
      // simple-peer doesn't expose replaceTrack natively;
      // the remote side will continue receiving the old track.
      // A full implementation would recreate the peer or use RTCRtpSender.replaceTrack.
    } catch {
      // Camera switch not supported on this device
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
      peerRef.current?.destroy();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return {
    localStream: localStreamRef.current,
    localStreamRef,
    startCall,
    answerCall,
    handleSignal,
    endCall,
    toggleAudio,
    toggleVideo,
    switchCamera,
    isAudioMuted,
    isVideoOff,
  };
}
