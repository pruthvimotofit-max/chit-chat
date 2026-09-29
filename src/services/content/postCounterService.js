import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import { db } from "../../config/firebase";

const MAX_IDS_PER_QUERY = 30;

function chunk(items, size = MAX_IDS_PER_QUERY) {
  const result = [];

  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }

  return result;
}

function createCounterMap(postIds) {
  const result = new Map();

  postIds.forEach((postId) => {
    result.set(postId, {
      likes: 0,
      comments: 0,
      shares: 0,
      reposts: 0,
    });
  });

  return result;
}

async function loadPostSubcollectionCounts(
  collectionName,
  postIds,
  counters,
) {
  for (const ids of chunk(postIds)) {
    if (!ids.length) {
      continue;
    }

    const snapshot = await getDocs(
      query(
        collectionGroup(db, collectionName),
        where("postId", "in", ids),
      ),
    );

    snapshot.docs.forEach((item) => {
      const data = item.data();
      const postId = data.postId;

      if (!postId || !counters.has(postId)) {
        return;
      }

      const pathParts = item.ref.path.split("/");

      // Direct post interaction:
      // posts/{postId}/{collectionName}/{documentId}
      //
      // Comment likes have an additional:
      // comments/{commentId}
      //
      // Only count direct post interactions here.
      if (
        pathParts.length !== 4 ||
        pathParts[0] !== "posts" ||
        pathParts[1] !== postId ||
        pathParts[2] !== collectionName
      ) {
        return;
      }

      const current = counters.get(postId);
      current[collectionName] += 1;
    });
  }
}

async function loadRepostCounts(postIds, counters) {
  for (const ids of chunk(postIds)) {
    if (!ids.length) {
      continue;
    }

    const snapshot = await getDocs(
      query(
        collection(db, "reposts"),
        where("postId", "in", ids),
      ),
    );

    snapshot.docs.forEach((item) => {
      const postId = item.data().postId;

      if (!postId || !counters.has(postId)) {
        return;
      }

      const current = counters.get(postId);
      current.reposts += 1;
    });
  }
}

export async function getBulkPostCounters(postIds) {
  const normalizedPostIds = [
    ...new Set(
      (Array.isArray(postIds) ? postIds : []).filter(Boolean),
    ),
  ];

  if (!normalizedPostIds.length) {
    return new Map();
  }

  const counters = createCounterMap(normalizedPostIds);

  await Promise.all([
    loadPostSubcollectionCounts(
      "likes",
      normalizedPostIds,
      counters,
    ),
    loadPostSubcollectionCounts(
      "comments",
      normalizedPostIds,
      counters,
    ),
    loadPostSubcollectionCounts(
      "shares",
      normalizedPostIds,
      counters,
    ),
    loadRepostCounts(
      normalizedPostIds,
      counters,
    ),
  ]);

  return counters;
}
