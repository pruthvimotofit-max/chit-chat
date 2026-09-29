import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../config/firebase";

function getLikeRef(postId, userId) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }

  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  return doc(db, "posts", postId, "likes", userId);
}

function getLikesCollection(postId) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }

  return collection(db, "posts", postId, "likes");
}

export async function likePost(postId, userId) {
  const likeRef = getLikeRef(postId, userId);

  await setDoc(likeRef, {
    userId,
    postId,
    createdAt: serverTimestamp(),
  });
}

export async function unlikePost(postId, userId) {
  await deleteDoc(getLikeRef(postId, userId));
}

export async function hasLikedPost(postId, userId) {
  const likeRef = getLikeRef(postId, userId);
  const snapshot = await getDoc(likeRef);

  return snapshot.exists();
}

export async function getLikeCount(postId) {
  const snapshot = await getCountFromServer(
    getLikesCollection(postId),
  );

  return snapshot.data().count;
}
