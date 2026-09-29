import {
  addDoc,
  collection,
  getCountFromServer,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../config/firebase";

function getSharesCollection(postId) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }

  return collection(db, "posts", postId, "shares");
}

export async function recordShare({
  postId,
  userId,
  method = "native",
}) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const allowedMethods = [
    "native",
    "copy_link",
    "direct_message",
  ];

  if (!allowedMethods.includes(method)) {
    throw new Error("INVALID_SHARE_METHOD");
  }

  const shareData = {
    postId,
    userId,
    method,
    createdAt: serverTimestamp(),
  };

  const shareRef = await addDoc(
    getSharesCollection(postId),
    shareData,
  );

  return {
    id: shareRef.id,
    ...shareData,
  };
}


export async function getShareCount(postId) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }

  const snapshot = await getCountFromServer(
    getSharesCollection(postId),
  );

  return snapshot.data().count;
}
