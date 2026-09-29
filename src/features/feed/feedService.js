import { doc, getDoc } from "firebase/firestore";

import { db } from "../../config/firebase";
import { getFollowing } from "../../services/follows/followService";
import {
  getRepostsByUserIds,
} from "../../services/reposts/repostService";
import { getPosts } from "../../services/posts/postService";
import { getUserById } from "../../services/users/userService";

async function loadPost(postId) {
  if (!postId) {
    return null;
  }

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
      `Failed to load reposted post ${postId}:`,
      error,
    );

    return null;
  }
}

async function attachAuthors(posts) {
  const uniqueAuthorIds = [
    ...new Set(
      posts
        .map((post) => post.authorId)
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

  return posts.map((post) => ({
    ...post,
    author: profileMap.get(post.authorId) || null,
  }));
}

export async function getFeedPosts(
  pageSize = 20,
  viewerId = null,
) {
  const originalPosts = await getPosts(pageSize);

  let repostItems = [];

  if (viewerId) {
    try {
      const following = await getFollowing(viewerId);

      const visibleReposterIds = [
        viewerId,
        ...following
          .map((item) => item.followingId)
          .filter(Boolean),
      ];

      const reposts = await getRepostsByUserIds(
        visibleReposterIds,
        pageSize,
      );

      const originalRepostPosts = await Promise.all(
        reposts.map(async (repost) => {
          const post = await loadPost(repost.postId);

          if (!post) {
            return null;
          }

          return {
            ...post,
            isRepost: true,
            repostId: repost.id,
            repostedById: repost.userId,
            repostedAt: repost.createdAt,
          };
        }),
      );

      repostItems = originalRepostPosts.filter(Boolean);
    } catch (error) {
      console.error(
        "Failed to load feed reposts:",
        error,
      );
    }
  }

  const combined = [
    ...repostItems,
    ...originalPosts,
  ];

  const uniqueItems = [];
  const seenKeys = new Set();

  for (const item of combined) {
    const key = item.isRepost
      ? `repost:${item.repostId}`
      : `post:${item.id}`;

    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    uniqueItems.push(item);
  }

  uniqueItems.sort((a, b) => {
    const aTime = (
      a.repostedAt ||
      a.createdAt
    )?.toMillis?.() || 0;

    const bTime = (
      b.repostedAt ||
      b.createdAt
    )?.toMillis?.() || 0;

    return bTime - aTime;
  });

  const limitedItems = uniqueItems.slice(
    0,
    pageSize,
  );

  const itemsWithAuthors =
    await attachAuthors(limitedItems);

  const repostedByIds = [
    ...new Set(
      itemsWithAuthors
        .map((item) => item.repostedById)
        .filter(Boolean),
    ),
  ];

  const reposterProfiles = await Promise.all(
    repostedByIds.map(async (userId) => {
      try {
        const profile = await getUserById(userId);
        return [userId, profile];
      } catch {
        return [userId, null];
      }
    }),
  );

  const reposterMap =
    new Map(reposterProfiles);

  return itemsWithAuthors.map((item) => ({
    ...item,
    repostedByUsername:
      reposterMap.get(item.repostedById)
        ?.username || "",
  }));
}
