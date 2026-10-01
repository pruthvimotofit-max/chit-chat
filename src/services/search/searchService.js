import { searchUsersByUsername } from "../users/userService";
import { getExploreSearchContent } from "./exploreService";

export async function searchUsers(query) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  return searchUsersByUsername(trimmedQuery);
}

function matchesContent(item, query) {
  const searchText = query.toLowerCase();

  const caption = item.caption || "";
  const location = item.location || "";
  const username = item.author?.username || "";
  const displayName = item.author?.displayName || "";

  return (
    caption.toLowerCase().includes(searchText) ||
    location.toLowerCase().includes(searchText) ||
    username.toLowerCase().includes(searchText) ||
    displayName.toLowerCase().includes(searchText)
  );
}

export async function searchContent(query, pageSize = 50) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const content = await getExploreSearchContent(
    Math.max(200, pageSize * 2),
  );

  return content
    .map((item) => ({
      ...item,
      searchType:
        item.postType === "reel"
          ? "reel"
          : "post",
    }))
    .filter((item) =>
      matchesContent(item, trimmedQuery),
    )
    .filter((item) => {
      const media = item.media?.[0];

      return Boolean(
        media?.url ||
        typeof media === "string" ||
        item.videoUrl ||
        item.imageUrl,
      );
    })
    .sort((a, b) => {
      const aTime =
        a.createdAt?.toMillis?.() || 0;
      const bTime =
        b.createdAt?.toMillis?.() || 0;

      return bTime - aTime;
    })
    .slice(0, pageSize);
}
