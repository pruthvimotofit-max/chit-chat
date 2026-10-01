import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "../../config/firebase";
import { canViewStory } from "./storyAccessService";
import { getFollowing } from "../follows/followService";

const STORIES_COLLECTION = "stories";

function getStoriesCollection() {
  return collection(db, STORIES_COLLECTION);
}

function getStoryRef(storyId) {
  if (!storyId) {
    throw new Error("STORY_ID_REQUIRED");
  }

  return doc(db, STORIES_COLLECTION, storyId);
}

function getStoryViewsCollection(storyId) {
  if (!storyId) {
    throw new Error("STORY_ID_REQUIRED");
  }

  return collection(
    db,
    STORIES_COLLECTION,
    storyId,
    "views",
  );
}

export function createStoryId() {
  return doc(getStoriesCollection()).id;
}

export async function createStory({
  storyId,
  authorId,
  media,
  mediaType,
  caption = "",
  visibility = "public",
}) {
  if (!authorId) {
    throw new Error("AUTHOR_ID_REQUIRED");
  }

  if (!Array.isArray(media) || media.length === 0) {
    throw new Error("STORY_MEDIA_REQUIRED");
  }

  if (!["image", "video"].includes(mediaType)) {
    throw new Error("INVALID_STORY_MEDIA_TYPE");
  }

  if (!["public", "followers"].includes(visibility)) {
    throw new Error("INVALID_STORY_VISIBILITY");
  }

  const now = Date.now();
  const expiresAt = new Date(now + 24 * 60 * 60 * 1000);

  const storyData = {
    authorId,
    media,
    mediaType,
    caption: caption.trim(),
    visibility,
    createdAt: serverTimestamp(),
    expiresAt,
  };

  const storyRef = getStoryRef(storyId);

  await setDoc(
    storyRef,
    storyData,
  );

  return {
    id: storyRef.id,
    ...storyData,
  };
}

function mapStorySnapshot(snapshot) {
  return snapshot.docs.map((storyDoc) => ({
    id: storyDoc.id,
    ...storyDoc.data(),
  }));
}

export async function grantStoryShareAccess({
  storyId,
  recipientId,
  senderId,
  conversationId,
  messageId,
}) {
  if (
    !storyId ||
    !recipientId ||
    !senderId ||
    !conversationId ||
    !messageId
  ) {
    throw new Error("STORY_SHARE_ACCESS_DATA_REQUIRED");
  }

  const accessRef = doc(
    db,
    STORIES_COLLECTION,
    storyId,
    "shares",
    recipientId,
  );

  await setDoc(
    accessRef,
    {
      storyId,
      recipientId,
      senderId,
      conversationId,
      messageId,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getStoryById(storyId, viewerId) {
  if (!storyId) {
    throw new Error("STORY_ID_REQUIRED");
  }

  if (!viewerId) {
    throw new Error("VIEWER_ID_REQUIRED");
  }

  const snapshot = await getDoc(getStoryRef(storyId));

  if (!snapshot.exists()) {
    return null;
  }

  const story = {
    id: snapshot.id,
    ...snapshot.data(),
  };

  if (
    story.expiresAt &&
    typeof story.expiresAt.toDate === "function" &&
    story.expiresAt.toDate() <= new Date()
  ) {
    return null;
  }

  return story;
}


async function getActiveStoriesForAuthors(authorIds) {
  if (!authorIds.length) {
    return [];
  }

  const now = new Date();

  const results = await Promise.all(
    authorIds.map(async (authorId) => {
      const snapshot = await getDocs(
        query(
          getStoriesCollection(),
          where("authorId", "==", authorId),
          where("visibility", "==", "followers"),
          where("expiresAt", ">", now),
          orderBy("expiresAt", "asc"),
        ),
      );

      return mapStorySnapshot(snapshot);
    }),
  );

  return results.flat();
}

export async function getActiveStories(
  viewerId,
  pageSize = 50,
) {
  if (!viewerId) {
    throw new Error("VIEWER_ID_REQUIRED");
  }

  const now = new Date();

  const publicStoriesQuery = query(
    getStoriesCollection(),
    where("visibility", "==", "public"),
    where("expiresAt", ">", now),
    orderBy("expiresAt", "asc"),
    limit(pageSize),
  );

  const ownStoriesQuery = query(
    getStoriesCollection(),
    where("authorId", "==", viewerId),
    where("expiresAt", ">", now),
    orderBy("expiresAt", "asc"),
    limit(pageSize),
  );

  let publicSnapshot;
  let ownSnapshot;
  let following;

  try {
    publicSnapshot = await getDocs(publicStoriesQuery);
    console.log("[STORIES DEBUG] public Stories query: OK");
  } catch (error) {
    console.error("[STORIES DEBUG] public Stories query FAILED:", error);
    throw error;
  }

  try {
    ownSnapshot = await getDocs(ownStoriesQuery);
    console.log("[STORIES DEBUG] own Stories query: OK");
  } catch (error) {
    console.error("[STORIES DEBUG] own Stories query FAILED:", error);
    throw error;
  }

  try {
    following = await getFollowing(viewerId);
    console.log("[STORIES DEBUG] following query: OK");
  } catch (error) {
    console.error("[STORIES DEBUG] following query FAILED:", error);
    throw error;
  }

  const followingAuthorIds = following
    .map((item) => item.followingId)
    .filter(
      (followingId) =>
        followingId && followingId !== viewerId,
    );

  const [publicStories, ownStories, followingStories] =
    await Promise.all([
      Promise.resolve(
        mapStorySnapshot(publicSnapshot),
      ),
      Promise.resolve(
        mapStorySnapshot(ownSnapshot),
      ),
      getActiveStoriesForAuthors(
        followingAuthorIds,
      ),
    ]);

  const storyMap = new Map();

  [
    ...publicStories,
    ...ownStories,
    ...followingStories,
  ].forEach((story) => {
    storyMap.set(story.id, story);
  });

  const visibleStories = [];

  for (const story of storyMap.values()) {
    try {
      const canView = await canViewStory(story, viewerId);

      console.log(
        "[STORIES DEBUG] canViewStory:",
        story.id,
        canView,
      );

      if (canView) {
        visibleStories.push(story);
      }
    } catch (error) {
      console.error(
        "[STORIES DEBUG] canViewStory FAILED:",
        story.id,
        error,
      );
      throw error;
    }
  }

  return visibleStories
    .sort(
      (a, b) =>
        (b.createdAt?.toMillis?.() || 0) -
        (a.createdAt?.toMillis?.() || 0),
    )
    .slice(0, pageSize);
}

export async function getUserStories(
  authorId,
  pageSize = 50,
) {
  if (!authorId) {
    throw new Error("AUTHOR_ID_REQUIRED");
  }

  const storiesQuery = query(
    getStoriesCollection(),
    where("authorId", "==", authorId),
    where("expiresAt", ">", new Date()),
    orderBy("createdAt", "desc"),
    limit(pageSize),
  );

  const snapshot = await getDocs(storiesQuery);

  return snapshot.docs.map((storyDoc) => ({
    id: storyDoc.id,
    ...storyDoc.data(),
  }));
}

export async function recordStoryView(storyId, userId) {
  if (!storyId) {
    throw new Error("STORY_ID_REQUIRED");
  }

  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const viewRef = doc(
    db,
    STORIES_COLLECTION,
    storyId,
    "views",
    userId,
  );

  const existingView = await getDoc(viewRef);

  if (existingView.exists()) {
    return false;
  }

  await setDoc(viewRef, {
    userId,
    storyId,
    createdAt: serverTimestamp(),
  });

  return true;
}

export async function hasViewedStory(
  storyId,
  userId,
) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const viewRef = doc(
    db,
    STORIES_COLLECTION,
    storyId,
    "views",
    userId,
  );

  const snapshot = await getDocs(
    query(
      collection(
        db,
        STORIES_COLLECTION,
        storyId,
        "views",
      ),
      where("userId", "==", userId),
      limit(1),
    ),
  );

  return !snapshot.empty;
}

export async function getStoryViewCount(storyId, ownerId) {
  if (!storyId) {
    throw new Error("STORY_ID_REQUIRED");
  }

  if (!ownerId) {
    throw new Error("OWNER_ID_REQUIRED");
  }

  const viewsQuery = query(
    getStoryViewsCollection(storyId),
    orderBy("createdAt", "desc"),
  );

  const snapshot = await getDocs(viewsQuery);

  return snapshot.docs.filter(
    (viewDoc) => viewDoc.data().userId !== ownerId,
  ).length;
}

export async function getStoryViewers(storyId, ownerId) {
  if (!storyId) {
    throw new Error("STORY_ID_REQUIRED");
  }

  if (!ownerId) {
    throw new Error("OWNER_ID_REQUIRED");
  }

  const viewsQuery = query(
    getStoryViewsCollection(storyId),
    orderBy("createdAt", "desc"),
  );

  const snapshot = await getDocs(viewsQuery);

  return snapshot.docs
    .filter((viewDoc) => viewDoc.data().userId !== ownerId)
    .map((viewDoc) => ({
      id: viewDoc.id,
      ...viewDoc.data(),
    }));
}

export async function deleteStory(storyId) {
  await deleteDoc(getStoryRef(storyId));
}
