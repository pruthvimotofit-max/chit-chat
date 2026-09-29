import {
  deleteObject,
  getDownloadURL,
  getMetadata,
  ref,
  uploadBytes,
} from "firebase/storage";

import { storage } from "../../../config/firebase";

function createStoragePath(file, options = {}) {
  const mediaType = options.mediaType || "file";
  const purpose = options.purpose || "general";
  const userId = options.userId || "unknown";
  const ownerId =
    options.ownerId ||
    options.authorId ||
    userId;

  const uniqueId =
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

  const safeName = (file.name || "media")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 180);

  return `media/${purpose}/${mediaType}/${ownerId}/${uniqueId}_${safeName}`;
}

export const firebaseMediaProvider = {
  name: "firebase",

  async upload(file, options = {}) {
    if (!file) {
      throw new Error("MEDIA_FILE_REQUIRED");
    }

    const path =
      options.path ||
      createStoragePath(file, options);

    const storageRef = ref(storage, path);

    const snapshot = await uploadBytes(
      storageRef,
      file,
      {
        contentType: file.type,
        customMetadata: {
          originalName:
            file.name?.slice(0, 255) || "",
          uploadedBy:
            options.userId ||
            options.ownerId ||
            "",
          purpose:
            options.purpose || "general",
        },
      },
    );

    const [url, metadata] =
      await Promise.all([
        getDownloadURL(snapshot.ref),
        getMetadata(snapshot.ref),
      ]);

    return {
      url,
      provider: "firebase",
      providerId: snapshot.ref.fullPath,
      path: snapshot.ref.fullPath,
      resourceType:
        options.mediaType || "file",
      mediaType:
        options.mediaType || "file",
      mimeType:
        metadata.contentType ||
        file.type ||
        "",
      format:
        metadata.contentType?.split("/")[1] ||
        null,
      size:
        metadata.size ||
        file.size ||
        0,
      originalName:
        file.name || "",
      metadata: {
        bucket: metadata.bucket || null,
        generation:
          metadata.generation || null,
        timeCreated:
          metadata.timeCreated || null,
      },
    };
  },

  async delete(media) {
    const path =
      typeof media === "string"
        ? media
        : media?.path ||
          media?.providerId;

    if (!path) {
      throw new Error(
        "MEDIA_PROVIDER_ID_REQUIRED",
      );
    }

    await deleteObject(
      ref(storage, path),
    );

    return true;
  },
};

export default firebaseMediaProvider;
