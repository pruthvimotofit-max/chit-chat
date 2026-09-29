import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../config/firebase";

function getViewRef(postId, userId) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }

  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  return doc(db, "posts", postId, "views", userId);
}

export async function recordPostView(postId, userId) {
  const viewRef = getViewRef(postId, userId);

  const existingView = await getDoc(viewRef);

  if (existingView.exists()) {
    return false;
  }

  await setDoc(viewRef, {
    postId,
    userId,
    createdAt: serverTimestamp(),
  });

  return true;
}

export async function hasViewedPost(postId, userId) {
  const viewRef = getViewRef(postId, userId);
  const snapshot = await getDoc(viewRef);

  return snapshot.exists();
}
