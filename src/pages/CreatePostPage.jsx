import {
  ArrowLeft,
  Check,
  ChevronDown,
  ImagePlus,
  MapPin,
  Plus,
  Settings2,
  Tag,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../features/auth/AuthProvider";
import { createPost } from "../services/posts/postService";
import { createStory } from "../services/stories/storyService";
import {
  getMediaProviderStatus,
  uploadMedia,
} from "../services/media/mediaService";

const MAX_FILES = 10;

function CreatePostPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const requestedType = searchParams.get("type");

  const initialType =
    requestedType === "story"
      ? "story"
      : requestedType === "reel"
        ? "reel"
        : requestedType === "video"
          ? "video"
          : "post";

  const [contentType, setContentType] = useState(initialType);
  const [files, setFiles] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mediaAspect, setMediaAspect] = useState("original");
  const [step, setStep] = useState("select");
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [tagPeople, setTagPeople] = useState("");
  const [altText, setAltText] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [serverError, setServerError] = useState("");
  const [publishing, setPublishing] = useState(false);

  const fileInputRef = useRef(null);

  const previews = useMemo(
    () =>
      files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
        isVideo: file.type.startsWith("video/"),
      })),
    [files],
  );

  useEffect(() => {
    return () => {
      previews.forEach((preview) =>
        URL.revokeObjectURL(preview.url),
      );
    };
  }, [previews]);

  function handleFiles(selectedFiles) {
    const selected = Array.from(selectedFiles || []);

    if (!selected.length) return;

    const validFiles = selected.filter((file) => {
      if (
        contentType === "reel" ||
        contentType === "video"
      ) {
        return file.type.startsWith("video/");
      }

      if (contentType === "story") {
        return (
          file.type.startsWith("image/") ||
          file.type.startsWith("video/")
        );
      }

      return (
        file.type.startsWith("image/") ||
        file.type.startsWith("video/")
      );
    });

    if (
      contentType === "reel" ||
      contentType === "video" ||
      contentType === "story"
    ) {
      setFiles(validFiles.slice(0, 1));
    } else {
      setFiles((current) =>
        [...current, ...validFiles].slice(0, MAX_FILES),
      );
    }

    setActiveIndex(0);
    setMediaAspect("original");
    setStep("preview");
    setServerError("");
  }

  function handleFileInput(event) {
    handleFiles(event.target.files);
    event.target.value = "";
  }

  function removeFile(index) {
    setFiles((current) =>
      current.filter((_, fileIndex) => fileIndex !== index),
    );

    setActiveIndex((current) =>
      Math.max(0, Math.min(current, files.length - 2)),
    );
  }

  function resetCreate() {
    setFiles([]);
    setActiveIndex(0);
    setMediaAspect("original");
    setStep("select");
    setCaption("");
    setLocation("");
    setTagPeople("");
    setAltText("");
    setVisibility("public");
    setShowAdvanced(false);
    setServerError("");
  }

  function handleCancel() {
    const hasChanges =
      files.length ||
      caption.trim() ||
      location.trim() ||
      tagPeople.trim();

    if (hasChanges) {
      const confirmed = window.confirm(
        "Discard this post?",
      );

      if (!confirmed) return;
    }

    navigate(contentType === "reel" ? "/reels" : "/");
  }

  async function handlePublish() {
    setServerError("");

    if (!user) {
      setServerError("You must be logged in to create a post.");
      return;
    }

    if (!files.length) {
      setServerError("Select media before sharing.");
      setStep("select");
      return;
    }

    setPublishing(true);

    try {
      if (contentType === "story") {
        const storyFile = files[0];

        if (!storyFile) {
          setServerError(
            "Select media before sharing.",
          );
          return;
        }

        const isImage =
          storyFile.type.startsWith("image/");

        const isVideo =
          storyFile.type.startsWith("video/");

        if (!isImage && !isVideo) {
          setServerError(
            "Stories support image and video files.",
          );
          return;
        }

        const providerStatus =
          getMediaProviderStatus();

        if (!providerStatus.ready) {
          setServerError(
            providerStatus.message ||
              "Media storage is not configured yet.",
          );
          return;
        }

        let uploadFile = storyFile;

        if (isImage) {
          uploadFile = await new Promise(
            (resolve, reject) => {
              const reader = new FileReader();

              reader.onload = () => {
                const image = new Image();

                image.onload = () => {
                  const maxDimension = 1600;

                  const scale = Math.min(
                    1,
                    maxDimension /
                      Math.max(
                        image.width,
                        image.height,
                      ),
                  );

                  const canvas =
                    document.createElement(
                      "canvas",
                    );

                  canvas.width = Math.max(
                    1,
                    Math.round(
                      image.width * scale,
                    ),
                  );

                  canvas.height = Math.max(
                    1,
                    Math.round(
                      image.height * scale,
                    ),
                  );

                  const context =
                    canvas.getContext("2d");

                  if (!context) {
                    reject(
                      new Error(
                        "IMAGE_CANVAS_FAILED",
                      ),
                    );
                    return;
                  }

                  context.drawImage(
                    image,
                    0,
                    0,
                    canvas.width,
                    canvas.height,
                  );

                  canvas.toBlob(
                    (blob) => {
                      if (!blob) {
                        reject(
                          new Error(
                            "IMAGE_COMPRESSION_FAILED",
                          ),
                        );
                        return;
                      }

                      const compressedFile =
                        new File(
                          [blob],
                          storyFile.name.replace(
                            /\.[^/.]+$/,
                            ".jpg",
                          ),
                          {
                            type: "image/jpeg",
                            lastModified:
                              Date.now(),
                          },
                        );

                      resolve(
                        compressedFile,
                      );
                    },
                    "image/jpeg",
                    0.78,
                  );
                };

                image.onerror = () => {
                  reject(
                    new Error(
                      "IMAGE_LOAD_FAILED",
                    ),
                  );
                };

                image.src = reader.result;
              };

              reader.onerror = () => {
                reject(
                  new Error("IMAGE_READ_FAILED"),
                );
              };

              reader.readAsDataURL(storyFile);
            },
          );
        }

        const uploadedMedia =
          await uploadMedia(uploadFile, {
            purpose: "story",
            userId: user.uid,
            allowImages: true,
            allowVideos: true,
            allowFiles: false,
            maxImageSize:
              10 * 1024 * 1024,
            maxVideoSize:
              25 * 1024 * 1024,
          });

        if (!uploadedMedia?.url) {
          throw new Error(
            "MEDIA_UPLOAD_FAILED",
          );
        }

        const story = await createStory({
          authorId: user.uid,
          media: [uploadedMedia],
          mediaType: isVideo
            ? "video"
            : "image",
          caption,
          visibility,
        });

        if (!story?.id) {
          throw new Error(
            "STORY_CREATE_FAILED",
          );
        }

        navigate("/");
        return;
      }

      if (contentType !== "post") {
        setServerError(
          contentType === "video"
            ? "Long-video publishing will be enabled when Firebase Storage is connected."
            : "Reel publishing will be enabled when Firebase Storage is connected.",
        );
        return;
      }

      const imageFiles = files.filter((file) =>
        file.type.startsWith("image/"),
      );

      if (imageFiles.length !== files.length) {
        setServerError(
          "Photo posts are currently supported. Video posts will be enabled with the real media provider.",
        );
        return;
      }

      const providerStatus =
        getMediaProviderStatus();

      if (!providerStatus.ready) {
        setServerError(
          providerStatus.message ||
            "Media storage is not configured yet.",
        );
        return;
      }

      const media = await Promise.all(
        imageFiles.map((file) =>
          uploadMedia(file, {
            purpose: "post",
            userId: user.uid,
            allowImages: true,
            allowVideos: false,
            allowFiles: false,
            maxImageSize:
              10 * 1024 * 1024,
          }),
        ),
      );

      const post = await createPost({
        authorId: user.uid,
        caption,
        media,
        mediaType: "image",
        postType: "post",
        visibility,
        location,
      });

      if (!post?.id) {
        throw new Error("POST_CREATE_FAILED");
      }

      navigate("/");
    } catch (error) {
      console.error("Publish failed:", error);

      setServerError(
        error?.message === "STORY_CREATE_FAILED"
          ? "Could not create the Story. Please try again."
          : "Something went wrong while publishing. Please try again.",
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <main className="create-social-page">
      <div className="create-social-overlay">
        <section className="create-social-modal">
          <header className="create-modal-header">
            {step !== "select" ? (
              <button
                type="button"
                className="create-header-icon"
                onClick={() => setStep("select")}
                aria-label="Back"
              >
                <ArrowLeft size={20} />
              </button>
            ) : (
              <span className="create-header-spacer" />
            )}

            <h1>
              {step === "select"
                ? "Create new post"
                : step === "preview"
                  ? "Edit"
                  : "New post"}
            </h1>

            {step === "preview" ? (
              <button
                type="button"
                className="create-next-button"
                onClick={() => setStep("details")}
              >
                Next
              </button>
            ) : step === "details" ? (
              <button
                type="button"
                className="create-next-button"
                onClick={handlePublish}
                disabled={publishing}
              >
                {publishing
                  ? "Posting..."
                  : contentType === "reel"
                    ? "Share"
                    : "Post"}
              </button>
            ) : (
              <button
                type="button"
                className="create-header-close"
                onClick={handleCancel}
                aria-label="Close"
              >
                <X size={21} />
              </button>
            )}
          </header>

          <div className="create-modal-body">
            {step === "select" && (
              <section className="create-select-stage">
                <div className="create-upload-icon">
                  <ImagePlus size={48} strokeWidth={1.5} />
                </div>

                <h2>
                  {contentType === "reel"
                    ? "Share a reel"
                    : contentType === "video"
                      ? "Share a video"
                      : "Create a new post"}
                </h2>

                <p>
                  {contentType === "reel"
                    ? "Upload a vertical video to create your Reel."
                    : contentType === "video"
                      ? "Upload a long-form video for your feed."
                      : "Upload photos or videos from your device."}
                </p>

                <div className="create-type-switch">
                  <button
                    type="button"
                    className={
                      contentType === "post"
                        ? "active"
                        : ""
                    }
                    onClick={() => {
                      setContentType("post");
                      setFiles([]);
                    }}
                  >
                    <ImagePlus size={17} />
                    Post
                  </button>

                  <button
                    type="button"
                    className={
                      contentType === "video"
                        ? "active"
                        : ""
                    }
                    onClick={() => {
                      setContentType("video");
                      setFiles([]);
                    }}
                  >
                    <Upload size={17} />
                    Video
                  </button>

                  <button
                    type="button"
                    className={
                      contentType === "reel"
                        ? "active"
                        : ""
                    }
                    onClick={() => {
                      setContentType("reel");
                      setFiles([]);
                    }}
                  >
                    <Upload size={17} />
                    Reel
                  </button>

                  <button
                    type="button"
                    className={
                      contentType === "story"
                        ? "active"
                        : ""
                    }
                    onClick={() => {
                      setContentType("story");
                      setFiles([]);
                      setServerError("");
                    }}
                  >
                    <ImagePlus size={17} />
                    Story
                  </button>
                </div>

                <button
                  type="button"
                  className="create-select-button"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                >
                  Select from computer
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept={
                    contentType === "reel" ||
                    contentType === "video"
                      ? "video/*"
                      : "image/*,video/*"
                  }
                  multiple={
                    contentType !== "reel" &&
                    contentType !== "video" &&
                    contentType !== "story"
                  }
                  onChange={handleFileInput}
                />

                <span className="create-media-hint">
                  {contentType === "reel"
                    ? "One vertical video"
                    : contentType === "video"
                      ? "One long-form video"
                      : `Up to ${MAX_FILES} photos or videos`}
                </span>

                {serverError && (
                  <div
                    className="create-server-error"
                    role="alert"
                  >
                    {serverError}
                  </div>
                )}
              </section>
            )}

            {step === "preview" && files[activeIndex] && (
              <section className="create-preview-stage">
                <div className="create-preview-toolbar">
                  <button
                    type="button"
                    className={
                      mediaAspect === "original"
                        ? "create-tool-button active"
                        : "create-tool-button"
                    }
                    onClick={() => setMediaAspect("original")}
                  >
                    Original
                  </button>

                  <button
                    type="button"
                    className={
                      mediaAspect === "1:1"
                        ? "create-tool-button active"
                        : "create-tool-button"
                    }
                    onClick={() => setMediaAspect("1:1")}
                  >
                    1:1
                  </button>

                  <button
                    type="button"
                    className={
                      mediaAspect === "4:5"
                        ? "create-tool-button active"
                        : "create-tool-button"
                    }
                    onClick={() => setMediaAspect("4:5")}
                  >
                    4:5
                  </button>

                  <button
                    type="button"
                    className={
                      mediaAspect === "16:9"
                        ? "create-tool-button active"
                        : "create-tool-button"
                    }
                    onClick={() => setMediaAspect("16:9")}
                  >
                    16:9
                  </button>
                </div>

                <div
                  className={
                    mediaAspect === "original"
                      ? "create-preview-canvas create-preview-canvas-original"
                      : "create-preview-canvas"
                  }
                  style={
                    mediaAspect === "original"
                      ? undefined
                      : { aspectRatio: mediaAspect.replace(":", " / ") }
                  }
                >
                  {previews[activeIndex].isVideo ? (
                    <video
                      src={previews[activeIndex].url}
                      controls
                      muted
                      playsInline
                      style={
                        mediaAspect === "original"
                          ? undefined
                          : {
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }
                      }
                    />
                  ) : (
                    <img
                      src={previews[activeIndex].url}
                      alt=""
                      style={
                        mediaAspect === "original"
                          ? undefined
                          : {
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }
                      }
                    />
                  )}
                </div>

                <div className="create-preview-bottom">
                  <div className="create-preview-count">
                    {files.length}{" "}
                    {files.length === 1
                      ? "item"
                      : "items"}
                  </div>

                  <button
                    type="button"
                    className="create-add-media"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                  >
                    <Plus size={18} />
                    Add media
                  </button>
                </div>

                <div className="create-thumbnails">
                  {previews.map((preview, index) => (
                    <div
                      key={`${preview.file.name}-${index}`}
                      className={`create-thumbnail ${
                        activeIndex === index
                          ? "active"
                          : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setActiveIndex(index)
                        }
                      >
                        {preview.isVideo ? (
                          <video
                            src={preview.url}
                            muted
                            playsInline
                          />
                        ) : (
                          <img
                            src={preview.url}
                            alt=""
                          />
                        )}
                      </button>

                      <button
                        type="button"
                        className="create-remove-thumbnail"
                        onClick={() =>
                          removeFile(index)
                        }
                        aria-label="Remove media"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  accept={
                    contentType === "reel" ||
                    contentType === "video"
                      ? "video/*"
                      : "image/*,video/*"
                  }
                  multiple={
                    contentType !== "reel" &&
                    contentType !== "video" &&
                    contentType !== "story"
                  }
                  onChange={handleFileInput}
                />
              </section>
            )}

            {step === "details" && (
              <section className="create-details-stage">
                <div className="create-details-preview">
                  {previews[activeIndex]?.isVideo ? (
                    <video
                      src={previews[activeIndex].url}
                      muted
                      playsInline
                      controls
                    />
                  ) : (
                    <img
                      src={previews[activeIndex]?.url}
                      alt=""
                    />
                  )}
                </div>

                <div className="create-details-form">
                  <div className="create-author-row">
                    <div className="create-author-avatar">
                      {(user?.displayName ||
                        user?.email ||
                        "U")
                        .slice(0, 1)
                        .toUpperCase()}
                    </div>

                    <strong>
                      {user?.displayName ||
                        user?.email ||
                        "You"}
                    </strong>
                  </div>

                  <textarea
                    value={caption}
                    onChange={(event) =>
                      setCaption(event.target.value)
                    }
                    placeholder="Write a caption..."
                    maxLength={2200}
                  />

                  <div className="create-caption-count">
                    {caption.length} / 2,200
                  </div>

                  <div className="create-detail-row">
                    <MapPin size={20} />
                    <input
                      value={location}
                      onChange={(event) =>
                        setLocation(event.target.value)
                      }
                      placeholder="Add location"
                    />
                  </div>

                  <div className="create-detail-row">
                    <Tag size={20} />
                    <input
                      value={tagPeople}
                      onChange={(event) =>
                        setTagPeople(event.target.value)
                      }
                      placeholder="Tag people"
                    />
                  </div>

                  <button
                    type="button"
                    className="create-setting-row"
                    onClick={() =>
                      setShowAdvanced(
                        (current) => !current,
                      )
                    }
                  >
                    <div>
                      <Settings2 size={20} />
                      <span>
                        Advanced settings
                      </span>
                    </div>

                    <ChevronDown
                      size={19}
                      className={
                        showAdvanced
                          ? "rotate"
                          : ""
                      }
                    />
                  </button>

                  {showAdvanced && (
                    <div className="create-advanced-panel">
                      <label>
                        Visibility
                        <select
                          value={visibility}
                          onChange={(event) =>
                            setVisibility(
                              event.target.value,
                            )
                          }
                        >
                          <option value="public">
                            Public
                          </option>
                          <option value="followers">
                            Followers
                          </option>
                          <option value="private">
                            Only me
                          </option>
                        </select>
                      </label>

                      <label>
                        Alt text
                        <input
                          value={altText}
                          onChange={(event) =>
                            setAltText(
                              event.target.value,
                            )
                          }
                          placeholder="Describe your photo for accessibility"
                        />
                      </label>
                    </div>
                  )}

                  {serverError && (
                    <div
                      className="create-server-error"
                      role="alert"
                    >
                      {serverError}
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default CreatePostPage;
