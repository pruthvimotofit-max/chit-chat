const DEFAULT_MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const DEFAULT_MAX_VIDEO_SIZE = 25 * 1024 * 1024;
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
const DEFAULT_MAX_AUDIO_SIZE = 10 * 1024 * 1024;

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

const AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/mp4a-latm",
]);

export function getMediaType(fileOrType) {
  const type =
    typeof fileOrType === "string"
      ? fileOrType
      : fileOrType?.type || "";

  if (type.startsWith("image/")) {
    return "image";
  }

  if (type.startsWith("video/")) {
    return "video";
  }

  if (type.startsWith("audio/")) {
    return "audio";
  }

  return "file";
}

export function isImageFile(file) {
  return getMediaType(file) === "image";
}

export function isVideoFile(file) {
  return getMediaType(file) === "video";
}

export function isAudioFile(file) {
  return getMediaType(file) === "audio";
}

export function isSupportedMediaFile(file) {
  if (!file) return false;

  const type = file.type || "";

  return (
    IMAGE_TYPES.has(type) ||
    VIDEO_TYPES.has(type) ||
    AUDIO_TYPES.has(type) ||
    type.startsWith("audio/")
  );
}

export function getMaxSizeForMediaType(mediaType, options = {}) {
  if (mediaType === "image") {
    return options.maxImageSize ?? DEFAULT_MAX_IMAGE_SIZE;
  }

  if (mediaType === "video") {
    return options.maxVideoSize ?? DEFAULT_MAX_VIDEO_SIZE;
  }

  if (mediaType === "audio") {
    return options.maxAudioSize ?? DEFAULT_MAX_AUDIO_SIZE;
  }

  return options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
}

export function validateMediaFile(file, options = {}) {
  if (!file) {
    return {
      valid: false,
      code: "MEDIA_FILE_REQUIRED",
      message: "Select a file first.",
    };
  }

  const mediaType = getMediaType(file);

  if (
    !options.allowImages &&
    mediaType === "image"
  ) {
    return {
      valid: false,
      code: "IMAGE_NOT_ALLOWED",
      message: "Images are not allowed here.",
    };
  }

  if (
    !options.allowVideos &&
    mediaType === "video"
  ) {
    return {
      valid: false,
      code: "VIDEO_NOT_ALLOWED",
      message: "Videos are not allowed here.",
    };
  }

  if (
    !options.allowAudio &&
    mediaType === "audio"
  ) {
    return {
      valid: false,
      code: "AUDIO_NOT_ALLOWED",
      message: "Audio is not allowed here.",
    };
  }

  if (
    options.supportedTypes &&
    Array.isArray(options.supportedTypes) &&
    !options.supportedTypes.includes(file.type)
  ) {
    return {
      valid: false,
      code: "MEDIA_TYPE_NOT_SUPPORTED",
      message: "This media format is not supported.",
    };
  }

  if (
    mediaType === "file" &&
    options.allowFiles !== true
  ) {
    return {
      valid: false,
      code: "FILE_NOT_ALLOWED",
      message: "Files are not allowed here.",
    };
  }

  if (!isSupportedMediaFile(file) && mediaType !== "file") {
    return {
      valid: false,
      code: "MEDIA_TYPE_NOT_SUPPORTED",
      message: "This media format is not supported.",
    };
  }

  const maxSize = getMaxSizeForMediaType(
    mediaType,
    options,
  );

  if (file.size > maxSize) {
    return {
      valid: false,
      code: "MEDIA_FILE_TOO_LARGE",
      message: `This ${mediaType} is too large.`,
      maxSize,
    };
  }

  return {
    valid: true,
    mediaType,
    size: file.size,
    mimeType: file.type,
    name: file.name,
  };
}

export function validateMediaFiles(
  files,
  options = {},
) {
  const selectedFiles = Array.from(files || []);

  if (!selectedFiles.length) {
    return {
      valid: false,
      errors: [
        {
          code: "MEDIA_FILE_REQUIRED",
          message: "Select at least one file.",
        },
      ],
      files: [],
    };
  }

  const results = selectedFiles.map((file) => ({
    file,
    result: validateMediaFile(file, options),
  }));

  const errors = results
    .filter(({ result }) => !result.valid)
    .map(({ file, result }) => ({
      file,
      ...result,
    }));

  return {
    valid: errors.length === 0,
    errors,
    files: results
      .filter(({ result }) => result.valid)
      .map(({ file, result }) => ({
        file,
        ...result,
      })),
  };
}

export const MEDIA_LIMITS = {
  image: DEFAULT_MAX_IMAGE_SIZE,
  video: DEFAULT_MAX_VIDEO_SIZE,
  audio: DEFAULT_MAX_AUDIO_SIZE,
  file: DEFAULT_MAX_FILE_SIZE,
};
