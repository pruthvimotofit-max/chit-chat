import {
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "../../config/firebase";

function validateUserId(userId) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }
}

function normalizePostIds(postIds) {
  return [
    ...new Set(
      (Array.isArray(postIds) ? postIds : []).filter(Boolean),
    ),
  ];
}

async function loadLikeState(userId, postIds) {
  const likedPostIds = new Set();

  const snapshots = await Promise.all(
    postIds.map((postId) =>
      getDoc(
        doc(
          db,
          "posts",
          postId,
          "likes",
          userId,
        ),
      ),
    ),
  );

  snapshots.forEach((snapshot, index) => {
    if (snapshot.exists()) {
      likedPostIds.add(postIds[index]);
    }
  });

  return likedPostIds;
}

async function loadSaveState(userId, postIds) {
  const savedPostIds = new Set();

  const snapshots = await Promise.all(
    postIds.map((postId) =>
      getDoc(
        doc(
          db,
          "posts",
          postId,
          "saves",
          userId,
        ),
      ),
    ),
  );

  snapshots.forEach((snapshot, index) => {
    if (snapshot.exists()) {
      savedPostIds.add(postIds[index]);
    }
  });

  return savedPostIds;
}

async function loadRepostState(userId, postIds) {
  const repostedPostIds = new Set();

  const snapshots = await Promise.all(
    postIds.map((postId) =>
      getDoc(
        doc(
          db,
          "reposts",
          `${userId}_${postId}`,
        ),
      ),
    ),
  );

  snapshots.forEach((snapshot, index) => {
    if (snapshot.exists()) {
      repostedPostIds.add(postIds[index]);
    }
  });

  return repostedPostIds;
}

export async function getBulkInteractionState(userId, postIds) {
  validateUserId(userId);

  const normalizedPostIds = normalizePostIds(postIds);

  const result = new Map();

  normalizedPostIds.forEach((postId) => {
    result.set(postId, {
      liked: false,
      saved: false,
      reposted: false,
    });
  });

  if (!normalizedPostIds.length) {
    return result;
  }

  const [
    likedResult,
    savedResult,
    repostedResult,
  ] = await Promise.allSettled([
    loadLikeState(userId, normalizedPostIds),
    loadSaveState(userId, normalizedPostIds),
    loadRepostState(userId, normalizedPostIds),
  ]);

  const likedPostIds =
    likedResult.status === "fulfilled"
      ? likedResult.value
      : new Set();

  const savedPostIds =
    savedResult.status === "fulfilled"
      ? savedResult.value
      : new Set();

  const repostedPostIds =
    repostedResult.status === "fulfilled"
      ? repostedResult.value
      : new Set();

  if (likedResult.status === "rejected") {
    console.error(
      "Failed to load like state:",
      likedResult.reason,
    );
  }

  if (savedResult.status === "rejected") {
    console.error(
      "Failed to load save state:",
      savedResult.reason,
    );
  }

  if (repostedResult.status === "rejected") {
    console.error(
      "Failed to load repost state:",
      repostedResult.reason,
    );
  }

  normalizedPostIds.forEach((postId) => {
    result.set(postId, {
      liked: likedPostIds.has(postId),
      saved: savedPostIds.has(postId),
      reposted: repostedPostIds.has(postId),
    });
  });

  return result;
}
