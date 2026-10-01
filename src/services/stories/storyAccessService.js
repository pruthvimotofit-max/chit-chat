import { isFollowing } from "../follows/followService";

export async function canViewStory(story, viewerId) {
  if (!story?.id || !viewerId) {
    return false;
  }

  if (story.authorId === viewerId) {
    return true;
  }

  if (story.visibility === "public") {
    return true;
  }

  if (story.visibility === "followers") {
    return isFollowing(viewerId, story.authorId);
  }

  return false;
}
