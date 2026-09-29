import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../config/firebase";

function getRepliesCollection(postId, commentId) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }

  if (!commentId) {
    throw new Error("COMMENT_ID_REQUIRED");
  }

  return collection(
    db,
    "posts",
    postId,
    "comments",
    commentId,
    "replies",
  );
}

export async function getCommentReplies(
  postId,
  commentId,
  pageSize = 50,
) {
  const repliesQuery = query(
    getRepliesCollection(postId, commentId),
    orderBy("createdAt", "asc"),
    limit(pageSize),
  );

  const snapshot = await getDocs(repliesQuery);

  return snapshot.docs.map((replyDoc) => ({
    id: replyDoc.id,
    ...replyDoc.data(),
  }));
}

export async function createCommentReply({
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
    throw new Error("REPLY_TEXT_REQUIRED");
  }

  if (trimmedText.length > 1000) {
    throw new Error("REPLY_TOO_LONG");
  }

  const replyData = {
    userId,
    postId,
    commentId,
    text: trimmedText,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const replyRef = await addDoc(
    getRepliesCollection(postId, commentId),
    replyData,
  );

  return {
    id: replyRef.id,
    ...replyData,
  };
}

export async function updateCommentReply({
  postId,
  commentId,
  replyId,
  text,
}) {
  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new Error("REPLY_TEXT_REQUIRED");
  }

  if (trimmedText.length > 1000) {
    throw new Error("REPLY_TOO_LONG");
  }

  const replyRef = doc(
    db,
    "posts",
    postId,
    "comments",
    commentId,
    "replies",
    replyId,
  );

  await updateDoc(replyRef, {
    text: trimmedText,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCommentReply({
  postId,
  commentId,
  replyId,
}) {
  if (!postId || !commentId || !replyId) {
    throw new Error("REPLY_ID_REQUIRED");
  }

  const replyRef = doc(
    db,
    "posts",
    postId,
    "comments",
    commentId,
    "replies",
    replyId,
  );

  await deleteDoc(replyRef);
}
