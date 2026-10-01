import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import { db } from "../../config/firebase";
import { getUserById } from "../users/userService";

const POSTS_COLLECTION = "posts";
const EXPLORE_FETCH_LIMIT = 200;

async function enrichContentItems(items) {
  const uniqueAuthorIds = [
    ...new Set(
      items
        .map((item) => item.authorId)
        .filter(Boolean),
    ),
  ];

  const profiles = await Promise.all(
    uniqueAuthorIds.map(async (userId) => {
      try {
        const profile = await getUserById(userId);
        return [userId, profile];
      } catch (error) {
        console.error(
          `Failed to load profile ${userId}:`,
          error,
        );
        return [userId, null];
      }
    }),
  );

  const profileMap = new Map(profiles);

  return items.map((item) => ({
    ...item,
    author: profileMap.get(item.authorId) || null,
  }));
}

function isDiscoverable(item) {
  return item?.isArchived !== true;
}

function sortNewestFirst(items) {
  return [...items].sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0;
    const bTime = b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });
}

async function getExploreSourceItems(fetchLimit = EXPLORE_FETCH_LIMIT) {
  const [postsSnapshot, reelsSnapshot] = await Promise.all([
    getDocs(
      query(
        collection(db, POSTS_COLLECTION),
        where("postType", "==", "post"),
        orderBy("createdAt", "desc"),
        limit(fetchLimit),
      ),
    ),
    getDocs(
      query(
        collection(db, POSTS_COLLECTION),
        where("postType", "==", "reel"),
        orderBy("createdAt", "desc"),
        limit(fetchLimit),
      ),
    ),
  ]);

  const posts = postsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const reels = reelsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  return sortNewestFirst(
    [...posts, ...reels].filter(isDiscoverable),
  );
}

export async function getExploreContent(pageSize = 30) {
  const sourceItems = await getExploreSourceItems();
  const enriched = await enrichContentItems(sourceItems);

  return enriched.slice(0, pageSize).map((item) => ({
    ...item,
    exploreType:
      item.postType === "reel"
        ? "reel"
        : "post",
  }));
}

export async function getExploreSearchContent(fetchLimit = EXPLORE_FETCH_LIMIT) {
  const sourceItems = await getExploreSourceItems(fetchLimit);
  return enrichContentItems(sourceItems);
}
