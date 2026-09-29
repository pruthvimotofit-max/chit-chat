function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(
          new Error("MEDIA_DATA_URL_FAILED"),
        );
        return;
      }

      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(
        new Error("MEDIA_READ_FAILED"),
      );
    };

    reader.readAsDataURL(file);
  });
}

export const dataUrlMediaProvider = {
  name: "dataUrl",

  async upload(file, options = {}) {
    if (!file) {
      throw new Error("MEDIA_FILE_REQUIRED");
    }

    const mediaType =
      options.mediaType || "file";

    if (mediaType !== "image") {
      const error = new Error(
        "DATA_URL_PROVIDER_IMAGE_ONLY",
      );

      error.code =
        "DATA_URL_PROVIDER_IMAGE_ONLY";

      throw error;
    }

    const url =
      await readFileAsDataUrl(file);

    return {
      url,
      provider: "dataUrl",
      providerId: null,
      resourceType: "image",
      mediaType: "image",
      mimeType: file.type || "",
      format:
        file.type?.split("/")[1] ||
        null,
      width: null,
      height: null,
      duration: null,
      size: file.size || 0,
      originalName: file.name || "",
      path: null,
      publicId: null,
      metadata: {
        temporary: true,
      },
    };
  },

  async delete() {
    const error = new Error(
      "DATA_URL_PROVIDER_DELETE_NOT_SUPPORTED",
    );

    error.code =
      "DATA_URL_PROVIDER_DELETE_NOT_SUPPORTED";

    throw error;
  },
};

export default dataUrlMediaProvider;
