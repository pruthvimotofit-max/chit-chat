import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

function normalizeMedia(media, fallbackImage) {
  const source =
    Array.isArray(media) && media.length > 0
      ? media
      : fallbackImage
        ? [fallbackImage]
        : [];

  return source
    .map((item) => {
      if (typeof item === "string") {
        return {
          url: item,
          type: /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(item)
            ? "video"
            : "image",
        };
      }

      if (!item) return null;

      const url = item.url || item.downloadURL || item.src || "";
      if (!url) return null;

      return {
        ...item,
        url,
        type:
          item.type ||
          item.mediaType ||
          (item.resourceType === "video" ? "video" : "image"),
      };
    })
    .filter(Boolean);
}

export default function PostMediaCarousel({
  media = [],
  image = "",
  caption = "",
  className = "",
  viewerMode = false,
}) {
  const items = normalizeMedia(media, image);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [items.length]);

  if (!items.length) {
    return (
      <div className={`post-media post-media-empty ${className}`}>
        <span>No media available</span>
      </div>
    );
  }

  const current = items[index];
  const isVideo = current.type === "video";

  function previous(event) {
    event?.stopPropagation();
    setIndex((value) => (value === 0 ? items.length - 1 : value - 1));
  }

  function next(event) {
    event?.stopPropagation();
    setIndex((value) => (value === items.length - 1 ? 0 : value + 1));
  }

  return (
    <div
      className={`post-media cc-post-media-carousel ${
        viewerMode ? "cc-post-media-carousel-viewer" : ""
      } ${className}`}
      style={
        viewerMode
          ? {
              width: "100%",
              height: "100%",
              aspectRatio: "auto",
            }
          : undefined
      }
      onTouchStart={(event) => {
        event.currentTarget.dataset.touchStartX = String(
          event.touches[0]?.clientX || 0,
        );
      }}
      onTouchEnd={(event) => {
        const start = Number(event.currentTarget.dataset.touchStartX || 0);
        const end = event.changedTouches[0]?.clientX || 0;
        const distance = end - start;

        if (Math.abs(distance) < 45 || items.length < 2) return;

        if (distance > 0) {
          previous(event);
        } else {
          next(event);
        }
      }}
    >
      {isVideo ? (
        <video
          key={current.url}
          src={current.url}
          controls
          playsInline
          preload="metadata"
          aria-label={caption || "Post video"}
          style={
            viewerMode
              ? {
                  width: "auto",
                  height: "auto",
                  maxWidth: "100%",
                  maxHeight: "100%",
                  aspectRatio: "auto",
                  objectFit: "contain",
                }
              : undefined
          }
        />
      ) : (
        <img
          key={current.url}
          src={current.url}
          alt={caption || "Post"}
          loading="lazy"
          style={
            viewerMode
              ? {
                  width: "auto",
                  height: "auto",
                  maxWidth: "100%",
                  maxHeight: "100%",
                  aspectRatio: "auto",
                  objectFit: "contain",
                }
              : undefined
          }
        />
      )}

      {items.length > 1 && (
        <>
          <button
            type="button"
            className="cc-post-media-nav cc-post-media-prev"
            onClick={previous}
            aria-label="Previous media"
          >
            <ChevronLeft size={21} strokeWidth={2.5} />
          </button>

          <button
            type="button"
            className="cc-post-media-nav cc-post-media-next"
            onClick={next}
            aria-label="Next media"
          >
            <ChevronRight size={21} strokeWidth={2.5} />
          </button>

          <div
            className="cc-post-media-counter"
            aria-label={`Media ${index + 1} of ${items.length}`}
          >
            {index + 1} / {items.length}
          </div>

          <div className="cc-post-media-dots" aria-hidden="true">
            {items.map((_, itemIndex) => (
              <span
                key={itemIndex}
                className={
                  itemIndex === index ? "active" : ""
                }
              />
            ))}
          </div>
        </>
      )}

      {isVideo && items.length > 1 && (
        <span className="cc-post-media-video-badge" aria-hidden="true">
          <Play size={12} fill="currentColor" />
        </span>
      )}
    </div>
  );
}
