import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../config/firebase";

function getSaveRef(postId, userId) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }

  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  return doc(db, "posts", postId, "saves", userId);
}

export async function savePost(postId, userId) {
  const saveRef = getSaveRef(postId, userId);

  await setDoc(saveRef, {
    userId,
    postId,
    createdAt: serverTimestamp(),
  });
}

export async function unsavePost(postId, userId) {
  const saveRef = getSaveRef(postId, userId);

  await deleteDoc(saveRef);
}

export async function hasSavedPost(postId, userId) {
  const saveRef = getSaveRef(postId, userId);
  const snapshot = await getDoc(saveRef);

  return snapshot.exists();
}
