import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../../config/firebase";

const CALLS_COLLECTION = "calls";

const CALL_TYPES = new Set(["audio", "video"]);

const CALL_STATUSES = new Set([
  "ringing",
  "active",
  "declined",
  "ended",
  "missed",
]);

function getCallRef(callId) {
  return doc(db, CALLS_COLLECTION, callId);
}

function getCallCandidatesCollection(callId, role) {
  if (role !== "offer" && role !== "answer") {
    throw new Error("INVALID_CALL_CANDIDATE_ROLE");
  }

  return collection(
    db,
    CALLS_COLLECTION,
    callId,
    role === "offer"
      ? "offerCandidates"
      : "answerCandidates",
  );
}

function validateCallType(type) {
  if (!CALL_TYPES.has(type)) {
    throw new Error("INVALID_CALL_TYPE");
  }
}

function validateCallStatus(status) {
  if (!CALL_STATUSES.has(status)) {
    throw new Error("INVALID_CALL_STATUS");
  }
}

export async function createCall({
  callId,
  conversationId,
  callerId,
  calleeId,
  type,
  offer,
}) {
  if (!conversationId) {
    throw new Error("CONVERSATION_ID_REQUIRED");
  }

  if (!callerId || !calleeId) {
    throw new Error("CALL_PARTICIPANTS_REQUIRED");
  }

  if (callerId === calleeId) {
    throw new Error("SELF_CALL_NOT_ALLOWED");
  }

  validateCallType(type);

  if (!offer?.type || !offer?.sdp) {
    throw new Error("CALL_OFFER_REQUIRED");
  }

  const callRef = callId
    ? getCallRef(callId)
    : doc(collection(db, CALLS_COLLECTION));

  const callData = {
    conversationId,
    callerId,
    calleeId,
    type,
    status: "ringing",
    offer: {
      type: offer.type,
      sdp: offer.sdp,
    },
    answer: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(callRef, callData);

  return callRef.id;
}

export function subscribeToIncomingCalls(userId, callback) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const callsQuery = query(
    collection(db, CALLS_COLLECTION),
    where("calleeId", "==", userId),
  );

  return onSnapshot(
    callsQuery,
    (snapshot) => {
      const calls = snapshot.docs
        .map((snapshotDoc) => ({
          id: snapshotDoc.id,
          ...snapshotDoc.data(),
        }))
        .filter((call) => call.status === "ringing")
        .sort((a, b) => {
          const aTime =
            a.createdAt?.toMillis?.() || 0;
          const bTime =
            b.createdAt?.toMillis?.() || 0;

          return bTime - aTime;
        });

      callback(calls);
    },
    (error) => {
      console.error(
        "Failed to subscribe to incoming calls:",
        error,
      );
    },
  );
}

export function subscribeToCall(callId, callback) {
  if (!callId) {
    throw new Error("CALL_ID_REQUIRED");
  }

  return onSnapshot(
    getCallRef(callId),
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }

      callback({
        id: snapshot.id,
        ...snapshot.data(),
      });
    },
    (error) => {
      console.error(
        "Failed to subscribe to call:",
        error,
      );
    },
  );
}

export async function updateCallStatus(
  callId,
  status,
) {
  if (!callId) {
    throw new Error("CALL_ID_REQUIRED");
  }

  validateCallStatus(status);

  await updateDoc(getCallRef(callId), {
    status,
    updatedAt: serverTimestamp(),
    ...(status === "ended" || status === "declined"
      ? {
          endedAt: serverTimestamp(),
        }
      : {}),
  });
}

export async function setCallAnswer(
  callId,
  answer,
) {
  if (!callId) {
    throw new Error("CALL_ID_REQUIRED");
  }

  if (!answer?.type || !answer?.sdp) {
    throw new Error("CALL_ANSWER_REQUIRED");
  }

  await updateDoc(getCallRef(callId), {
    answer: {
      type: answer.type,
      sdp: answer.sdp,
    },
    status: "active",
    updatedAt: serverTimestamp(),
  });
}

export async function addCallCandidate(
  callId,
  role,
  candidate,
) {
  if (!callId) {
    throw new Error("CALL_ID_REQUIRED");
  }

  if (!candidate) {
    throw new Error("CALL_CANDIDATE_REQUIRED");
  }

  const candidateCollection =
    getCallCandidatesCollection(callId, role);

  await addDoc(candidateCollection, candidate);
}

export function subscribeToCallCandidates(
  callId,
  role,
  callback,
) {
  if (!callId) {
    throw new Error("CALL_ID_REQUIRED");
  }

  const candidateCollection =
    getCallCandidatesCollection(callId, role);

  return onSnapshot(
    candidateCollection,
    (snapshot) => {
      callback(
        snapshot.docChanges()
          .filter(
            (change) => change.type === "added",
          )
          .map((change) => ({
            id: change.doc.id,
            ...change.doc.data(),
          })),
      );
    },
    (error) => {
      console.error(
        "Failed to subscribe to call candidates:",
        error,
      );
    },
  );
}
