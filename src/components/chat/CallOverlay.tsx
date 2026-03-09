'use client';

import { AnimatePresence } from 'framer-motion';
import { useCallContext } from '@/context/CallContext';
import ActiveCall from './ActiveCall';
import IncomingCall from './IncomingCall';

export default function CallOverlay() {
  const {
    callState,
    acceptCall,
    declineCall,
    endCall,
    toggleAudio,
    toggleVideo,
    switchCamera,
    isAudioMuted,
    isVideoOff,
    isRemoteMuted,
    isRemoteVideoOff,
    connectionState,
    localStreamRef,
    remoteStream,
  } = useCallContext();

  const { status, callType, remoteUser, isIncoming, duration } = callState;

  // Incoming call ringing
  const showIncoming = status === 'ringing' && isIncoming && remoteUser;

  // Active/connecting call
  const showActive = (status === 'connecting' || status === 'active') && remoteUser && callType;

  // Outgoing ringing
  const showOutgoing = status === 'ringing' && !isIncoming && remoteUser && callType;

  return (
    <AnimatePresence>
      {showIncoming && (
        <IncomingCall
          key="incoming"
          caller={remoteUser}
          callType={callType || 'audio'}
          onAccept={acceptCall}
          onDecline={declineCall}
        />
      )}

      {(showActive || showOutgoing) && callType && (
        <ActiveCall
          key="active"
          callType={callType}
          remoteUser={remoteUser}
          duration={duration}
          localStreamRef={localStreamRef}
          remoteStream={remoteStream}
          isAudioMuted={isAudioMuted}
          isVideoOff={isVideoOff}
          isRemoteMuted={isRemoteMuted}
          isRemoteVideoOff={isRemoteVideoOff}
          connectionState={showOutgoing ? 'ringing' : connectionState}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onSwitchCamera={switchCamera}
          onEndCall={endCall}
        />
      )}
    </AnimatePresence>
  );
}
