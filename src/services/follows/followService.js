import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "../../config/firebase";
import { createNotification } from "../notifications/notificationService";
import { getUserById } from "../users/userService";

function validateFollowIds(followerId, followingId) {
  if (!followerId) throw new Error("FOLLOWER_ID_REQUIRED");
  if (!followingId) throw new Error("FOLLOWING_ID_REQUIRED");
  if (followerId === followingId) {
    throw new Error("CANNOT_FOLLOW_SELF");
  }
}

function getFollowerRef(followerId, followingId) {
  validateFollowIds(followerId, followingId);
  return doc(db, "users", followingId, "followers", followerId);
}

function getFollowingRef(followerId, followingId) {
  validateFollowIds(followerId, followingId);
  return doc(db, "users", followerId, "following", followingId);
}

export async function followUser(followerId, followingId) {
  const followerRef = getFollowerRef(followerId, followingId);
  const followingRef = getFollowingRef(followerId, followingId);

  const followData = {
    followerId,
    followingId,
    createdAt: serverTimestamp(),
  };

  const followed = await runTransaction(db, async (transaction) => {
    const [followerSnapshot, followingSnapshot] = await Promise.all([
      transaction.get(followerRef),
      transaction.get(followingRef),
    ]);

    if (followerSnapshot.exists() || followingSnapshot.exists()) {
      return false;
    }

    transaction.set(followerRef, followData);
    transaction.set(followingRef, followData);

    return true;
  });

  if (!followed) {
    return false;
  }

  try {
    let actorName = "Someone";
    let actorUsername = null;
    let actorPhotoURL = null;

    try {
      const actor = await getUserById(followerId);
      actorName = actor.displayName || actor.username || "Someone";
      actorUsername = actor.username || null;
      actorPhotoURL = actor.photoURL || null;
    } catch (profileError) {
      console.warn(
        "Failed to load follower profile for notification:",
        profileError,
      );
    }

    await createNotification({
      recipientId: followingId,
      actorId: followerId,
      type: "follow",
      message: `${actorName} started following you.`,
      actorUsername,
      actorPhotoURL,
    });
  } catch (notificationError) {
    console.warn(
      "Follow succeeded but notification failed:",
      notificationError,
    );
  }

  return true;
}

export async function unfollowUser(followerId, followingId) {
  const followerRef = getFollowerRef(followerId, followingId);
  const followingRef = getFollowingRef(followerId, followingId);

  const unfollowed = await runTransaction(db, async (transaction) => {
    const [followerSnapshot, followingSnapshot] = await Promise.all([
      transaction.get(followerRef),
      transaction.get(followingRef),
    ]);

    if (!followerSnapshot.exists() && !followingSnapshot.exists()) {
      return false;
    }

    transaction.delete(followerRef);
    transaction.delete(followingRef);

    return true;
  });

  return unfollowed;
}

export async function isFollowing(followerId, followingId) {
  const followingRef = getFollowingRef(followerId, followingId);
  const snapshot = await getDoc(followingRef);
  return snapshot.exists();
}

export async function getFollowCounts(userId) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const followersRef = collection(db, "users", userId, "followers");
  const followingRef = collection(db, "users", userId, "following");

  const [followersSnapshot, followingSnapshot] = await Promise.all([
    getCountFromServer(followersRef),
    getCountFromServer(followingRef),
  ]);

  return {
    followers: followersSnapshot.data().count,
    following: followingSnapshot.data().count,
  };
}

export async function getFollowers(userId) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const snapshot = await getDocs(
    collection(db, "users", userId, "followers"),
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function getFollowing(userId) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const snapshot = await getDocs(
    collection(db, "users", userId, "following"),
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }));
}

export async function removeFollower(ownerId, followerId) {
  validateFollowIds(followerId, ownerId);
  return unfollowUser(followerId, ownerId);
}
