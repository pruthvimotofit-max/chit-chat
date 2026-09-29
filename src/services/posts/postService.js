import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../../config/firebase";
import { deleteMedia } from "../media/mediaService";

const POSTS_COLLECTION = "posts";

export async function getPostById(postId) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }

  const snapshot = await getDoc(doc(db, POSTS_COLLECTION, postId));

  if (!snapshot.exists()) {
    throw new Error("POST_NOT_FOUND");
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

export async function getPosts(pageSize = 20) {
  const postsQuery = query(
    collection(db, POSTS_COLLECTION),
    where("postType", "==", "post"),
    orderBy("createdAt", "desc"),
    limit(pageSize),
  );

  const snapshot = await getDocs(postsQuery);

  return snapshot.docs.map((postDoc) => ({
    id: postDoc.id,
    ...postDoc.data(),
  }));
}

export async function getReels(pageSize = 20) {
  const reelsQuery = query(
    collection(db, POSTS_COLLECTION),
    where("postType", "==", "reel"),
    orderBy("createdAt", "desc"),
    limit(pageSize),
  );

  const snapshot = await getDocs(reelsQuery);

  return snapshot.docs.map((reelDoc) => ({
    id: reelDoc.id,
    ...reelDoc.data(),
  }));
}

export async function deletePost(postId, userId) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }

  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const postRef = doc(db, POSTS_COLLECTION, postId);
  const snapshot = await getDoc(postRef);

  if (!snapshot.exists()) {
    throw new Error("POST_NOT_FOUND");
  }

  const post = snapshot.data();

  if (post.authorId !== userId) {
    throw new Error("POST_DELETE_FORBIDDEN");
  }

  // Delete media owned by this post through the shared media layer.
  // Media cleanup is best-effort so a stale/missing media object
  // does not prevent the Firestore post from being deleted.
  const mediaItems = Array.isArray(post.media)
    ? post.media.filter(Boolean)
    : [];

  for (const media of mediaItems) {
    try {
      if (media?.path || media?.providerId) {
        await deleteMedia(media);
      }
    } catch (mediaError) {
      console.warn(
        "Post media could not be deleted:",
        mediaError,
      );
    }
  }

  await deleteDoc(postRef);

  return {
    id: postId,
    deleted: true,
  };
}

export async function createPost({
  authorId,
  caption = "",
  media = [],
  mediaType = "image",
  postType = "post",
  visibility = "public",
  location = "",
  taggedUserIds = [],
  altText = "",
  commentsEnabled = true,
  hideLikeCount = false,
  hideShareCount = false,
  collaboratorIds = [],
}) {
  if (!authorId) {
    throw new Error("AUTHOR_ID_REQUIRED");
  }

  if (!["post", "reel"].includes(postType)) {
    throw new Error("INVALID_POST_TYPE");
  }

  const normalizedTaggedUserIds = Array.isArray(taggedUserIds)
    ? [...new Set(taggedUserIds.filter(Boolean))]
    : [];

  const normalizedCollaboratorIds = Array.isArray(collaboratorIds)
    ? [...new Set(collaboratorIds.filter(Boolean))]
    : [];

  const postData = {
    authorId,
    caption: caption.trim(),
    media: Array.isArray(media)
      ? media.map((item) => ({
          url: item?.url ?? "",
          type: item?.type ?? item?.mediaType ?? "",
          mimeType: item?.mimeType ?? "",
          provider: item?.provider ?? "",
          providerId: item?.providerId ?? null,
          resourceType: item?.resourceType ?? "",
          format: item?.format ?? null,
          width: item?.width ?? null,
          height: item?.height ?? null,
          duration: item?.duration ?? null,
          size: Number.isFinite(item?.size) ? item.size : 0,
          originalName: item?.originalName ?? "",
          path: item?.path ?? null,
          publicId: item?.publicId ?? null,
        }))
      : [],
    mediaType,
    postType,
    visibility,
    location: location.trim(),

    taggedUserIds: normalizedTaggedUserIds,
    altText: altText.trim(),
    commentsEnabled: commentsEnabled !== false,
    hideLikeCount: hideLikeCount === true,
    hideShareCount: hideShareCount === true,

    collaboratorIds: normalizedCollaboratorIds,

    isPinned: false,
    pinnedAt: null,

    likesCount: 0,
    commentsCount: 0,
    sharesCount: 0,
    repostsCount: 0,
    viewsCount: 0,

    isArchived: false,
    archivedAt: null,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const postsRef = collection(db, POSTS_COLLECTION);
  const postRef = await addDoc(postsRef, postData);

  return getPostById(postRef.id);
}

export async function updatePost({
  postId,
  userId,
  caption,
  media,
  mediaType,
  postType,
  visibility,
  location,
  taggedUserIds,
  altText,
  commentsEnabled,
  hideLikeCount,
  hideShareCount,
  collaboratorIds,
}) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }

  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const postRef = doc(db, POSTS_COLLECTION, postId);
  const snapshot = await getDoc(postRef);

  if (!snapshot.exists()) {
    throw new Error("POST_NOT_FOUND");
  }

  const existingPost = snapshot.data();

  if (existingPost.authorId !== userId) {
    throw new Error("POST_UPDATE_FORBIDDEN");
  }

  const updates = {};

  if (caption !== undefined) {
    updates.caption = String(caption).trim();
  }

  if (media !== undefined) {
    updates.media = Array.isArray(media)
      ? media.map((item) => ({
          url: item?.url ?? "",
          type: item?.type ?? item?.mediaType ?? "",
          mimeType: item?.mimeType ?? "",
          provider: item?.provider ?? "",
          providerId: item?.providerId ?? null,
          resourceType: item?.resourceType ?? "",
          format: item?.format ?? null,
          width: item?.width ?? null,
          height: item?.height ?? null,
          duration: item?.duration ?? null,
          size: Number.isFinite(item?.size) ? item.size : 0,
          originalName: item?.originalName ?? "",
          path: item?.path ?? null,
          publicId: item?.publicId ?? null,
        }))
      : [];
  }

  if (mediaType !== undefined) {
    updates.mediaType = mediaType;
  }

  if (postType !== undefined) {
    if (!["post", "reel"].includes(postType)) {
      throw new Error("INVALID_POST_TYPE");
    }

    updates.postType = postType;
  }

  if (visibility !== undefined) {
    updates.visibility = visibility;
  }

  if (location !== undefined) {
    updates.location = String(location).trim();
  }

  if (taggedUserIds !== undefined) {
    updates.taggedUserIds = Array.isArray(taggedUserIds)
      ? [...new Set(taggedUserIds.filter(Boolean))]
      : [];
  }

  if (altText !== undefined) {
    updates.altText = String(altText).trim();
  }

  if (commentsEnabled !== undefined) {
    updates.commentsEnabled = commentsEnabled !== false;
  }

  if (hideLikeCount !== undefined) {
    updates.hideLikeCount = hideLikeCount === true;
  }

  if (hideShareCount !== undefined) {
    updates.hideShareCount = hideShareCount === true;
  }

  if (collaboratorIds !== undefined) {
    updates.collaboratorIds = Array.isArray(collaboratorIds)
      ? [...new Set(collaboratorIds.filter(Boolean))]
      : [];
  }

  if (!Object.keys(updates).length) {
    return getPostById(postId);
  }

  updates.updatedAt = serverTimestamp();

  await updateDoc(postRef, updates);

  return getPostById(postId);
}

export async function archivePost(postId, userId) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }

  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const postRef = doc(db, POSTS_COLLECTION, postId);
  const snapshot = await getDoc(postRef);

  if (!snapshot.exists()) {
    throw new Error("POST_NOT_FOUND");
  }

  const post = snapshot.data();

  if (post.authorId !== userId) {
    throw new Error("POST_ARCHIVE_FORBIDDEN");
  }

  await updateDoc(postRef, {
    isArchived: true,
    archivedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return getPostById(postId);
}

export async function unarchivePost(postId, userId) {
  if (!postId) {
    throw new Error("POST_ID_REQUIRED");
  }

  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const postRef = doc(db, POSTS_COLLECTION, postId);
  const snapshot = await getDoc(postRef);

  if (!snapshot.exists()) {
    throw new Error("POST_NOT_FOUND");
  }

  const post = snapshot.data();

  if (post.authorId !== userId) {
    throw new Error("POST_ARCHIVE_FORBIDDEN");
  }

  await updateDoc(postRef, {
    isArchived: false,
    archivedAt: null,
    updatedAt: serverTimestamp(),
  });

  return getPostById(postId);
}

export async function getArchivedPosts(userId) {
  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const archivedQuery = query(
    collection(db, POSTS_COLLECTION),
    where("authorId", "==", userId),
  );

  const snapshot = await getDocs(archivedQuery);

  return snapshot.docs
    .map((postDoc) => ({
      id: postDoc.id,
      ...postDoc.data(),
    }))
    .filter((post) => post.isArchived === true)
    .sort((a, b) => {
      const aTime = a.archivedAt?.toMillis?.() || 0;
      const bTime = b.archivedAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
}

export async function createReel({
  authorId,
  caption = "",
  media = [],
  visibility = "public",
}) {
  return createPost({
    authorId,
    caption,
    media,
    mediaType: "video",
    postType: "reel",
    visibility,
    location: "",
  });
}
