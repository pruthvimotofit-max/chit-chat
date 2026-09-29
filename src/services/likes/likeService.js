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
import { createNotification } from "../notifications/notificationService";
import { getUserById } from "../users/userService";

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

  // Notifications are secondary to the like itself.
  // If notification creation fails, the like remains successful.
  try {
    const postSnapshot = await getDoc(
      doc(db, "posts", postId),
    );

    if (!postSnapshot.exists()) {
      return;
    }

    const post = postSnapshot.data();
    const recipientId = post.authorId;

    if (!recipientId || recipientId === userId) {
      return;
    }

    let actorName = "Someone";

    try {
      const actor = await getUserById(userId);
      actorName =
        actor.displayName ||
        actor.username ||
        "Someone";
    } catch (profileError) {
      console.warn(
        "Could not load actor profile for notification:",
        profileError,
      );
    }

    await createNotification({
      recipientId,
      actorId: userId,
      type: post.postType === "reel"
        ? "reel_like"
        : "like",
      message:
        post.postType === "reel"
          ? `${actorName} liked your reel.`
          : `${actorName} liked your post.`,
      postId,
    });
  } catch (notificationError) {
    console.warn(
      "Like succeeded, but notification could not be created:",
      notificationError,
    );
  }
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
