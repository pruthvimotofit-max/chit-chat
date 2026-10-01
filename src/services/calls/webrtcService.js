const DEFAULT_ICE_SERVERS = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
];

function getIceServers() {
  const configuredServers =
    import.meta.env.VITE_WEBRTC_ICE_SERVERS;

  if (!configuredServers) {
    return DEFAULT_ICE_SERVERS;
  }

  try {
    const parsed = JSON.parse(configuredServers);

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (error) {
    console.warn(
      "Invalid VITE_WEBRTC_ICE_SERVERS configuration. Using default STUN server.",
      error,
    );
  }

  return DEFAULT_ICE_SERVERS;
}

export async function getCallMedia(type) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("MEDIA_DEVICES_NOT_SUPPORTED");
  }

  const isVideoCall = type === "video";

  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: isVideoCall,
  });
}

export function createCallPeerConnection({
  onIceCandidate,
  onTrack,
  onConnectionStateChange,
  onIceConnectionStateChange,
}) {
  if (typeof RTCPeerConnection === "undefined") {
    throw new Error("WEBRTC_NOT_SUPPORTED");
  }

  const peerConnection = new RTCPeerConnection({
    iceServers: getIceServers(),
  });

  peerConnection.onicecandidate = (event) => {
    if (event.candidate && onIceCandidate) {
      onIceCandidate(event.candidate.toJSON());
    }
  };

  peerConnection.ontrack = (event) => {
    const [stream] = event.streams;

    if (stream && onTrack) {
      onTrack(stream);
    }
  };

  peerConnection.onconnectionstatechange = () => {
    onConnectionStateChange?.(
      peerConnection.connectionState,
    );
  };

  peerConnection.oniceconnectionstatechange = () => {
    onIceConnectionStateChange?.(
      peerConnection.iceConnectionState,
    );
  };

  return peerConnection;
}

export function addLocalStreamTracks(
  peerConnection,
  localStream,
) {
  if (!peerConnection || !localStream) {
    throw new Error("LOCAL_STREAM_REQUIRED");
  }

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });
}

export async function createCallOffer(
  peerConnection,
) {
  const offer = await peerConnection.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  });

  await peerConnection.setLocalDescription(offer);

  return peerConnection.localDescription.toJSON();
}

export async function createCallAnswer(
  peerConnection,
) {
  const answer = await peerConnection.createAnswer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: true,
  });

  await peerConnection.setLocalDescription(answer);

  return peerConnection.localDescription.toJSON();
}

export async function setRemoteCallDescription(
  peerConnection,
  description,
) {
  if (!description?.type || !description?.sdp) {
    throw new Error("REMOTE_DESCRIPTION_REQUIRED");
  }

  await peerConnection.setRemoteDescription(
    new RTCSessionDescription({
      type: description.type,
      sdp: description.sdp,
    }),
  );
}

export async function addRemoteCallCandidate(
  peerConnection,
  candidate,
) {
  if (!candidate) {
    return;
  }

  await peerConnection.addIceCandidate(
    new RTCIceCandidate(candidate),
  );
}

export function setCallTrackEnabled(
  localStream,
  kind,
  enabled,
) {
  if (!localStream) {
    return;
  }

  localStream
    .getTracks()
    .filter((track) => track.kind === kind)
    .forEach((track) => {
      track.enabled = enabled;
    });
}

export function stopCallMedia(stream) {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

export function closeCallPeerConnection(
  peerConnection,
) {
  if (!peerConnection) {
    return;
  }

  peerConnection.onicecandidate = null;
  peerConnection.ontrack = null;
  peerConnection.onconnectionstatechange = null;
  peerConnection.oniceconnectionstatechange = null;

  if (peerConnection.signalingState !== "closed") {
    peerConnection.close();
  }
}
