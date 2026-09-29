import {
  getMediaType,
  uploadMedia,
  deleteMedia,
  validateMediaFile,
} from "../media/mediaService";

const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;

const ALLOWED_TYPES = [
  /^image\//,
  /^video\//,
  /^text\//,
  /^application\/pdf$/,
  /^application\/msword$/,
  /^application\/vnd\.openxmlformats-officedocument\./,
];

function isAllowedType(type) {
  if (!type) {
    return false;
  }

  return ALLOWED_TYPES.some((pattern) =>
    pattern.test(type),
  );
}

function validateAttachment(file) {
  if (!file) {
    throw new Error("ATTACHMENT_REQUIRED");
  }

  if (!file.name) {
    throw new Error("ATTACHMENT_NAME_REQUIRED");
  }

  if (!file.type) {
    throw new Error("ATTACHMENT_TYPE_REQUIRED");
  }

  if (!file.size || file.size <= 0) {
    throw new Error("ATTACHMENT_EMPTY");
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new Error("ATTACHMENT_TOO_LARGE");
  }

  if (!isAllowedType(file.type)) {
    throw new Error("ATTACHMENT_TYPE_NOT_ALLOWED");
  }

  const mediaType = getMediaType(file);

  const validation = validateMediaFile(file, {
    allowImages: mediaType === "image",
    allowVideos: mediaType === "video",
    allowFiles: mediaType === "file",
    maxImageSize: MAX_ATTACHMENT_SIZE,
    maxVideoSize: MAX_ATTACHMENT_SIZE,
    maxFileSize: MAX_ATTACHMENT_SIZE,
  });

  if (!validation.valid) {
    const error = new Error(
      validation.code || "ATTACHMENT_INVALID",
    );

    error.code = validation.code;

    throw error;
  }

  return validation;
}

export async function uploadMessageAttachment({
  conversationId,
  userId,
  file,
}) {
  if (!conversationId) {
    throw new Error("CONVERSATION_ID_REQUIRED");
  }

  if (!userId) {
    throw new Error("USER_ID_REQUIRED");
  }

  const validation = validateAttachment(file);

  const result = await uploadMedia(file, {
    purpose: "message-attachment",
    conversationId,
    userId,
    allowImages: true,
    allowVideos: true,
    allowFiles: true,
    maxImageSize: MAX_ATTACHMENT_SIZE,
    maxVideoSize: MAX_ATTACHMENT_SIZE,
    maxFileSize: MAX_ATTACHMENT_SIZE,
  });

  return {
    url: result.url,
    path: result.path || result.publicId || null,
    name: file.name.slice(0, 255),
    type: file.type,
    size: file.size,
    mediaType: validation.mediaType,
  };
}

export async function deleteMessageAttachment(
  media,
) {
  if (!media) {
    throw new Error("ATTACHMENT_REQUIRED");
  }

  return deleteMedia(media);
}

export function getMaxMessageAttachmentSize() {
  return MAX_ATTACHMENT_SIZE;
}

export function isAllowedMessageAttachmentType(type) {
  return isAllowedType(type);
}
