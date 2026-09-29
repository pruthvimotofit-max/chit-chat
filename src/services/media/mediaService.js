import {
  getMediaType,
  validateMediaFile,
  validateMediaFiles,
} from "./mediaValidation";
import mediaProvider, {
  getMediaProviderName,
  isMediaProviderConfigured,
} from "./mediaProvider";

export {
  getMediaType,
  validateMediaFile,
  validateMediaFiles,
};

function normalizeMediaResult(
  result,
  file,
  validation,
) {
  return {
    url: String(result?.url || ""),
    type:
      result?.mediaType ||
      validation.mediaType,
    mediaType:
      result?.mediaType ||
      validation.mediaType,
    mimeType:
      result?.mimeType ||
      file.type ||
      "",
    provider:
      result?.provider ||
      getMediaProviderName(),
    providerId:
      result?.providerId ||
      result?.publicId ||
      result?.path ||
      null,
    resourceType:
      result?.resourceType ||
      validation.mediaType,
    format:
      result?.format ||
      file.type?.split("/")[1] ||
      null,
    size:
      Number.isFinite(result?.size)
        ? result.size
        : file.size || 0,
    originalName:
      String(
        result?.originalName ||
          file.name ||
          "",
      ).slice(0, 255),
  };
}

export function createMediaPreview(file) {
  if (!file) {
    throw new Error("MEDIA_FILE_REQUIRED");
  }

  return {
    file,
    url: URL.createObjectURL(file),
    mediaType: getMediaType(file),
    mimeType: file.type || "",
    name: file.name || "",
    size: file.size || 0,

    revoke() {
      URL.revokeObjectURL(this.url);
    },
  };
}

export function revokeMediaPreview(preview) {
  if (!preview?.url) return;

  URL.revokeObjectURL(preview.url);
}

export async function uploadMedia(
  file,
  options = {},
) {
  const validation = validateMediaFile(
    file,
    options,
  );

  if (!validation.valid) {
    const error = new Error(
      validation.message,
    );

    error.code = validation.code;
    error.validation = validation;

    throw error;
  }

  if (!isMediaProviderConfigured()) {
    const error = new Error(
      "MEDIA_PROVIDER_NOT_CONFIGURED",
    );

    error.code =
      "MEDIA_PROVIDER_NOT_CONFIGURED";

    throw error;
  }

  const result =
    await mediaProvider.upload(file, {
      ...options,
      mediaType: validation.mediaType,
      mimeType: validation.mimeType,
      name: validation.name,
      size: validation.size,
    });

  return normalizeMediaResult(
    result,
    file,
    validation,
  );
}

export async function uploadMediaFiles(
  files,
  options = {},
) {
  const validation = validateMediaFiles(
    files,
    options,
  );

  if (!validation.valid) {
    const error = new Error(
      validation.errors[0]?.message ||
        "Invalid media files.",
    );

    error.code =
      validation.errors[0]?.code ||
      "MEDIA_VALIDATION_FAILED";

    error.validation = validation;

    throw error;
  }

  return Promise.all(
    validation.files.map(({ file }) =>
      uploadMedia(file, options),
    ),
  );
}

export async function deleteMedia(media) {
  if (!media) {
    throw new Error("MEDIA_REQUIRED");
  }

  if (!isMediaProviderConfigured()) {
    const error = new Error(
      "MEDIA_PROVIDER_NOT_CONFIGURED",
    );

    error.code =
      "MEDIA_PROVIDER_NOT_CONFIGURED";

    throw error;
  }

  return mediaProvider.delete(media);
}

export function getMediaUrl(media) {
  if (!media) return "";

  if (typeof media === "string") {
    return media;
  }

  return media.url || "";
}

export function getMediaProviderStatus() {
  const provider = getMediaProviderName();

  return {
    provider,
    configured: provider !== "none",
    ready: provider !== "none",
    message:
      provider === "none"
        ? "Media storage is not configured yet."
        : "",
  };
}

export {
  getMediaProviderName,
  isMediaProviderConfigured,
};
