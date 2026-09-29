import firebaseMediaProvider from "./providers/firebaseMediaProvider";
import cloudinaryMediaProvider from "./providers/cloudinaryMediaProvider";
import dataUrlMediaProvider from "./providers/dataUrlMediaProvider";

function createProviderNotConfiguredError() {
  const error = new Error(
    "MEDIA_PROVIDER_NOT_CONFIGURED",
  );

  error.code =
    "MEDIA_PROVIDER_NOT_CONFIGURED";

  return error;
}

const providers = {
  none: {
    name: "none",

    async upload() {
      throw createProviderNotConfiguredError();
    },

    async delete() {
      throw createProviderNotConfiguredError();
    },
  },

  firebase: firebaseMediaProvider,

  cloudinary: cloudinaryMediaProvider,

  dataUrl: dataUrlMediaProvider,
};

const providerName =
  import.meta.env.VITE_MEDIA_PROVIDER ||
  "none";

export const mediaProvider =
  providers[providerName] ||
  providers.none;

export function getMediaProviderName() {
  return mediaProvider.name;
}

export function isMediaProviderConfigured() {
  return mediaProvider.name !== "none";
}

export default mediaProvider;
