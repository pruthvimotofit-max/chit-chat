import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../config/firebase";

function getCommentsCollection(postId) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }

  return collection(db, "posts", postId, "comments");
}

export async function getComments(postId, pageSize = 50) {
  const commentsQuery = query(
    getCommentsCollection(postId),
    orderBy("createdAt", "asc"),
    limit(pageSize),
  );

  const snapshot = await getDocs(commentsQuery);

  return snapshot.docs.map((commentDoc) => ({
    id: commentDoc.id,
    ...commentDoc.data(),
  }));
}

export async function createComment({
  postId,
  userId,
  text,
}) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new Error("COMMENT_TEXT_REQUIRED");
  }

  if (trimmedText.length > 1000) {
    throw new Error("COMMENT_TOO_LONG");
  }

  const commentData = {
    userId,
    postId,
    text: trimmedText,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const commentRef = await addDoc(
    getCommentsCollection(postId),
    commentData,
  );

  return {
    id: commentRef.id,
    ...commentData,
  };
}

export async function updateComment({
  postId,
  commentId,
  userId,
  text,
}) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new Error("COMMENT_TEXT_REQUIRED");
  }

  if (trimmedText.length > 1000) {
    throw new Error("COMMENT_TOO_LONG");
  }

  const commentRef = doc(
    db,
    "posts",
    postId,
    "comments",
    commentId,
  );

  await updateDoc(commentRef, {
    text: trimmedText,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteComment({
  postId,
  commentId,
}) {
  if (!postId || !commentId) {
    throw new Error("COMMENT_ID_REQUIRED");
  }

  const commentRef = doc(
    db,
    "posts",
    postId,
    "comments",
    commentId,
  );

  await deleteDoc(commentRef);
}


export async function getCommentCount(postId) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }

  const snapshot = await getCountFromServer(
    getCommentsCollection(postId),
  );

  return snapshot.data().count;
}
