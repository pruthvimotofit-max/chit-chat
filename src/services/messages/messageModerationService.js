import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "../../config/firebase";

const USERS_COLLECTION = "users";
const REPORTS_COLLECTION = "reports";

function getBlockedUserRef(userId, blockedUserId) {
  if (!userId || !blockedUserId) {
    throw new Error("BLOCK_USER_IDS_REQUIRED");
  }

  if (userId === blockedUserId) {
    throw new Error("CANNOT_BLOCK_SELF");
  }

  return doc(
    db,
    USERS_COLLECTION,
    userId,
    "blocked",
    blockedUserId,
  );
}

export async function blockUser(userId, blockedUserId) {
  const blockedRef = getBlockedUserRef(
    userId,
    blockedUserId,
  );

  await setDoc(blockedRef, {
    userId,
    blockedUserId,
    createdAt: serverTimestamp(),
  });

  return {
    userId,
    blockedUserId,
  };
}

export async function unblockUser(userId, blockedUserId) {
  const blockedRef = getBlockedUserRef(
    userId,
    blockedUserId,
  );

  await deleteDoc(blockedRef);

  return {
    userId,
    blockedUserId,
  };
}

export async function isUserBlocked(userId, otherUserId) {
  const blockedRef = getBlockedUserRef(
    userId,
    otherUserId,
  );

  const snapshot = await getDoc(blockedRef);
  return snapshot.exists();
}

export async function reportUser({
  reporterId,
  reportedUserId,
  conversationId,
  reason = "inappropriate",
}) {
  if (!reporterId || !reportedUserId) {
    throw new Error("REPORT_USERS_REQUIRED");
  }

  if (reporterId === reportedUserId) {
    throw new Error("CANNOT_REPORT_SELF");
  }

  if (!conversationId) {
    throw new Error("REPORT_USER_CONTEXT_REQUIRED");
  }

  const reportRef = await addDoc(
    collection(db, REPORTS_COLLECTION),
    {
      reporterId,
      reportedUserId,
      conversationId,
      reason,
      type: "user",
      status: "open",
      createdAt: serverTimestamp(),
    },
  );

  return {
    id: reportRef.id,
  };
}

export async function reportMessage({
  reporterId,
  reportedUserId,
  conversationId,
  messageId,
  reason = "inappropriate",
}) {
  if (!reporterId || !reportedUserId) {
    throw new Error("REPORT_USERS_REQUIRED");
  }

  if (reporterId === reportedUserId) {
    throw new Error("CANNOT_REPORT_SELF");
  }

  if (!conversationId || !messageId) {
    throw new Error("REPORT_MESSAGE_CONTEXT_REQUIRED");
  }

  const reportRef = await addDoc(
    collection(db, REPORTS_COLLECTION),
    {
      reporterId,
      reportedUserId,
      conversationId,
      messageId,
      reason,
      status: "open",
      createdAt: serverTimestamp(),
    },
  );

  return {
    id: reportRef.id,
  };
}
