import { getPosts, getReels } from "../posts/postService";
import { getUserById } from "../users/userService";

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

export async function getEnrichedPosts(pageSize = 20) {
  const posts = await getPosts(pageSize);
  return enrichContentItems(posts);
}

export async function getEnrichedReels(pageSize = 20) {
  const reels = await getReels(pageSize);
  return enrichContentItems(reels);
}

export async function getEnrichedContent(pageSize = 30) {
  const [posts, reels] = await Promise.all([
    getPosts(pageSize),
    getReels(pageSize),
  ]);

  const enriched = await enrichContentItems([
    ...posts,
    ...reels,
  ]);

  return enriched
    .sort((a, b) => {
      const aTime =
        a.createdAt?.toMillis?.() || 0;
      const bTime =
        b.createdAt?.toMillis?.() || 0;

      return bTime - aTime;
    })
    .slice(0, pageSize);
}
