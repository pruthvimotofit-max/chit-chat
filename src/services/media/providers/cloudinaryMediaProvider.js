function createCloudinaryConfigError(
  code,
) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function getCloudName() {
  return import.meta.env
    .VITE_CLOUDINARY_CLOUD_NAME || "";
}

function getUploadPreset() {
  return import.meta.env
    .VITE_CLOUDINARY_UPLOAD_PRESET || "";
}

export const cloudinaryMediaProvider = {
  name: "cloudinary",

  async upload(file, options = {}) {
    if (!file) {
      throw new Error("MEDIA_FILE_REQUIRED");
    }

    const cloudName = getCloudName();
    const uploadPreset =
      getUploadPreset();

    if (!cloudName) {
      throw createCloudinaryConfigError(
        "CLOUDINARY_CLOUD_NAME_MISSING",
      );
    }

    if (!uploadPreset) {
      throw createCloudinaryConfigError(
        "CLOUDINARY_UPLOAD_PRESET_MISSING",
      );
    }

    const formData = new FormData();

    formData.append("file", file);
    formData.append(
      "upload_preset",
      uploadPreset,
    );

    const endpoint =
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

    const response = await fetch(
      endpoint,
      {
        method: "POST",
        body: formData,
      },
    );

    let payload = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const error = new Error(
        payload?.error?.message ||
          "Cloudinary upload failed.",
      );

      error.code =
        payload?.error?.http_code ||
        "CLOUDINARY_UPLOAD_FAILED";

      throw error;
    }

    return {
      url:
        payload?.secure_url ||
        payload?.url ||
        "",
      provider: "cloudinary",
      providerId:
        payload?.public_id || null,
      publicId:
        payload?.public_id || null,
      resourceType:
        payload?.resource_type ||
        options.mediaType ||
        "file",
      mediaType:
        options.mediaType ||
        payload?.resource_type ||
        "file",
      mimeType:
        file.type || "",
      format:
        payload?.format || null,
      width:
        payload?.width ?? null,
      height:
        payload?.height ?? null,
      duration:
        payload?.duration ?? null,
      size:
        payload?.bytes ||
        file.size ||
        0,
      originalName:
        file.name || "",
      metadata: {
        assetId:
          payload?.asset_id || null,
        version:
          payload?.version || null,
        folder:
          payload?.folder || null,
      },
    };
  },

  async delete() {
    const error = new Error(
      "CLOUDINARY_CLIENT_DELETE_NOT_SUPPORTED",
    );

    error.code =
      "CLOUDINARY_CLIENT_DELETE_NOT_SUPPORTED";

    throw error;
  },
};

export default cloudinaryMediaProvider;
