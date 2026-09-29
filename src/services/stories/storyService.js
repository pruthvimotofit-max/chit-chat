import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { db } from "../../config/firebase";

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

export async function createStory({
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

  const storyRef = await addDoc(
    getStoriesCollection(),
    storyData,
  );

  return {
    id: storyRef.id,
    ...storyData,
  };
}

export async function getActiveStories(pageSize = 50) {
  const storiesQuery = query(
    getStoriesCollection(),
    where("expiresAt", ">", new Date()),
    orderBy("expiresAt", "asc"),
    limit(pageSize),
  );

  const snapshot = await getDocs(storiesQuery);

  return snapshot.docs.map((storyDoc) => ({
    id: storyDoc.id,
    ...storyDoc.data(),
  }));
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

export async function recordStoryView(
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

  await setDoc(viewRef, {
    userId,
    storyId,
    createdAt: serverTimestamp(),
  });
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

export async function getStoryViewCount(storyId) {
  const snapshot = await getCountFromServer(
    getStoryViewsCollection(storyId),
  );

  return snapshot.data().count;
}

export async function deleteStory(storyId) {
  await deleteDoc(getStoryRef(storyId));
}
