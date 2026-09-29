import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../config/firebase";

function getCommentLikeRef(postId, commentId, userId) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }

  if (!commentId) {
    throw new Error("COMMENT_ID_REQUIRED");
  }

  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  return doc(
    db,
    "posts",
    postId,
    "comments",
    commentId,
    "likes",
    userId,
  );
}

export async function likeComment({
  postId,
  commentId,
  userId,
}) {
  const likeRef = getCommentLikeRef(
    postId,
    commentId,
    userId,
  );

  await setDoc(likeRef, {
    userId,
    postId,
    commentId,
    createdAt: serverTimestamp(),
  });

  return true;
}

export async function unlikeComment({
  postId,
  commentId,
  userId,
}) {
  const likeRef = getCommentLikeRef(
    postId,
    commentId,
    userId,
  );

  await deleteDoc(likeRef);

  return true;
}

export async function hasLikedComment({
  postId,
  commentId,
  userId,
}) {
  const likeRef = getCommentLikeRef(
    postId,
    commentId,
    userId,
  );

  const snapshot = await getDoc(likeRef);

  return snapshot.exists();
}
