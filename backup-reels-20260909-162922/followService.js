import {
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../../config/firebase";

function validateFollowIds(followerId, followingId) {
  if (!followerId) throw new Error("FOLLOWER_ID_REQUIRED");
  if (!followingId) throw new Error("FOLLOWING_ID_REQUIRED");

  if (followerId === followingId) {
    throw new Error("CANNOT_FOLLOW_SELF");
  }
}

function getFollowerRef(followerId, followingId) {
  validateFollowIds(followerId, followingId);

  return doc(
    db,
    "users",
    followingId,
    "followers",
    followerId,
  );
}

function getFollowingRef(followerId, followingId) {
  validateFollowIds(followerId, followingId);

  return doc(
    db,
    "users",
    followerId,
    "following",
    followingId,
  );
}

export async function followUser(followerId, followingId) {
  const followerRef = getFollowerRef(followerId, followingId);
  const followingRef = getFollowingRef(followerId, followingId);

  const followData = {
    followerId,
    followingId,
    createdAt: serverTimestamp(),
  };

  await Promise.all([
    setDoc(followerRef, followData),
    setDoc(followingRef, followData),
  ]);

  return true;
}

export async function unfollowUser(followerId, followingId) {
  const followerRef = getFollowerRef(followerId, followingId);
  const followingRef = getFollowingRef(followerId, followingId);

  await Promise.all([
    deleteDoc(followerRef),
    deleteDoc(followingRef),
  ]);

  return true;
}

export async function isFollowing(followerId, followingId) {
  const followingRef = getFollowingRef(followerId, followingId);

  const snapshot = await getDoc(followingRef);

  return snapshot.exists();
}
