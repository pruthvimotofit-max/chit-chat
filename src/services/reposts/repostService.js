import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { createNotification } from "../notifications/notificationService";
import { getUserById } from "../users/userService";

const REPOSTS_COLLECTION = "reposts";

function validatePostId(postId) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }
}

function validateUserId(userId) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }
}

function getRepostId(userId, postId) {
  validateUserId(userId);
  validatePostId(postId);
  return `${userId}_${postId}`;
}

function getRepostRef(userId, postId) {
  return doc(
    db,
    REPOSTS_COLLECTION,
    getRepostId(userId, postId),
  );
}

export async function createRepost({
  postId,
  userId,
  originalAuthorId,
}) {
  validatePostId(postId);
  validateUserId(userId);

  if (!originalAuthorId) {
    throw new Error("ORIGINAL_AUTHOR_ID_REQUIRED");
  }

  if (userId === originalAuthorId) {
    throw new Error("CANNOT_REPOST_OWN_POST");
  }

  const repostRef = getRepostRef(userId, postId);

  // Prevent duplicate repost notifications when the same repost
  // request is triggered more than once.
  const existingRepost = await getDoc(repostRef);

  if (existingRepost.exists()) {
    return {
      id: existingRepost.id,
      ...existingRepost.data(),
    };
  }

  await setDoc(repostRef, {
    postId,
    userId,
    originalAuthorId,
    createdAt: serverTimestamp(),
  });

  // The repost itself is the primary action.
  // Notification creation is secondary.
  try {
    let actorName = "Someone";

    try {
      const actor = await getUserById(userId);

      actorName =
        actor.displayName ||
        actor.username ||
        "Someone";
    } catch (profileError) {
      console.warn(
        "Could not load actor profile for repost notification:",
        profileError,
      );
    }

    let postType = "post";

    try {
      const postSnapshot = await getDoc(
        doc(db, "posts", postId),
      );

      if (postSnapshot.exists()) {
        const post = postSnapshot.data();

        if (
          post.postType === "reel" ||
          post.contentType === "reel"
        ) {
          postType = "reel";
        }
      }
    } catch (postError) {
      console.warn(
        "Could not load post type for repost notification:",
        postError,
      );
    }

    await createNotification({
      recipientId: originalAuthorId,
      actorId: userId,
      type: postType === "reel" ? "reel_repost" : "repost",
      message:
        postType === "reel"
          ? `${actorName} reposted your reel.`
          : `${actorName} reposted your post.`,
      postId,
    });
  } catch (notificationError) {
    console.warn(
      "Repost succeeded, but notification could not be created:",
      notificationError,
    );
  }

  const snapshot = await getDoc(repostRef);

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export async function removeRepost({
  postId,
  userId,
}) {
  validatePostId(postId);
  validateUserId(userId);

  await deleteDoc(
    getRepostRef(userId, postId),
  );
}

export async function hasReposted({
  postId,
  userId,
}) {
  validatePostId(postId);
  validateUserId(userId);

  const snapshot = await getDoc(
    getRepostRef(userId, postId),
  );

  return snapshot.exists();
}

export async function getRepostCount(postId) {
  validatePostId(postId);

  const snapshot = await getCountFromServer(
    query(
      collection(db, REPOSTS_COLLECTION),
      where("postId", "==", postId),
    ),
  );

  return snapshot.data().count;
}

export async function getUserReposts(
  userId,
  pageSize = 20,
) {
  validateUserId(userId);

  const repostQuery = query(
    collection(db, REPOSTS_COLLECTION),
    where("userId", "==", userId),
    limit(pageSize),
  );

  const snapshot = await getDocs(repostQuery);

  return snapshot.docs
    .map((repostDoc) => ({
      id: repostDoc.id,
      ...repostDoc.data(),
    }))
    .sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    })
    .slice(0, pageSize);
}

export async function getRepostsByUserIds(
  userIds,
  pageSize = 20,
) {
  const uniqueUserIds = [
    ...new Set(
      (userIds || []).filter(Boolean),
    ),
  ];

  if (!uniqueUserIds.length) {
    return [];
  }

  const chunks = [];

  for (
    let index = 0;
    index < uniqueUserIds.length;
    index += 30
  ) {
    chunks.push(
      uniqueUserIds.slice(index, index + 30),
    );
  }

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const repostQuery = query(
        collection(db, REPOSTS_COLLECTION),
        where("userId", "in", chunk),
        limit(pageSize),
      );

      const snapshot = await getDocs(repostQuery);

      return snapshot.docs.map((repostDoc) => ({
        id: repostDoc.id,
        ...repostDoc.data(),
      }));
    }),
  );

  return results
    .flat()
    .sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    })
    .slice(0, pageSize);
}
