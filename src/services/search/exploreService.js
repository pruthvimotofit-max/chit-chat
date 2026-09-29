import { getEnrichedContent } from "../content/contentService";

export async function getExploreContent(pageSize = 30) {
  const content = await getEnrichedContent(
    pageSize,
  );

  return content.map((item) => ({
    ...item,
    exploreType:
      item.postType === "reel"
        ? "reel"
        : "post",
  }));
}
