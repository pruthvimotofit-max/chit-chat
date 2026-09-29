import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  serverTimestamp,
  where,
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


export async function getSavedPosts(userId) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const savesSnapshot = await getDocs(
    query(
      collectionGroup(db, "saves"),
      where("userId", "==", userId),
    ),
  );

  const savedPostIds = savesSnapshot.docs
    .map((saveDoc) => saveDoc.data().postId)
    .filter(Boolean);

  if (!savedPostIds.length) {
    return [];
  }

  const posts = await Promise.all(
    savedPostIds.map(async (postId) => {
      try {
        const snapshot = await getDoc(
          doc(db, "posts", postId),
        );

        if (!snapshot.exists()) {
          return null;
        }

        return {
          id: snapshot.id,
          ...snapshot.data(),
        };
      } catch (error) {
        console.error(
          `Failed to load saved post ${postId}:`,
          error,
        );
        return null;
      }
    }),
  );

  return posts
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;

      return bTime - aTime;
    });
}
