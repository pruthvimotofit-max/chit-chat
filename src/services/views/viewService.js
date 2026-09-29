import {
  doc,
  getDoc,
  runTransaction,
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
  const postRef = doc(db, "posts", postId);

  return runTransaction(db, async (transaction) => {
    const [viewSnapshot, postSnapshot] = await Promise.all([
      transaction.get(viewRef),
      transaction.get(postRef),
    ]);

    if (viewSnapshot.exists()) {
      return false;
    }

    if (!postSnapshot.exists()) {
      throw new Error("POST_NOT_FOUND");
    }

    const currentViews = postSnapshot.data().viewsCount || 0;

    transaction.set(viewRef, {
      postId,
      userId,
      createdAt: serverTimestamp(),
    });

    transaction.update(postRef, {
      viewsCount: currentViews + 1,
    });

    return true;
  });
}

export async function hasViewedPost(postId, userId) {
  const viewRef = getViewRef(postId, userId);
  const snapshot = await getDoc(viewRef);

  return snapshot.exists();
}
