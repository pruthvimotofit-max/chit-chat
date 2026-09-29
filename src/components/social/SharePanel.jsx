import { useEffect, useRef } from "react";

import {
  Copy,
  Mail,
  MessageCircle,
  Send,
  X,
} from "lucide-react";

import { recordShare } from "../../services/shares/shareService";

function isMobileDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || "";

  return (
    /Android|iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.maxTouchPoints > 1 &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(max-width: 768px)").matches)
  );
}

export default function SharePanel({
  postId,
  userId,
  shareUrl,
  title = "Chit Chat",
  text = "",
  onClose,
  onShared,
}) {
  const nativeShareStarted = useRef(false);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (
      !isMobileDevice() ||
      nativeShareStarted.current ||
      typeof navigator === "undefined" ||
      typeof navigator.share !== "function"
    ) {
      return;
    }

    nativeShareStarted.current = true;

    let cancelled = false;

    async function openNativeShare() {
      try {
        await navigator.share({
          title: title || "Chit Chat",
          text: text || "",
          url: shareUrl,
        });

        if (cancelled) {
          return;
        }

        try {
          await recordShare({
            postId,
            userId,
            method: "native",
          });

          onShared?.("native");
        } catch (error) {
          console.error("Failed to record native share:", error);
        }

        onClose?.();
      } catch (error) {
        if (error?.name === "AbortError") {
          onClose?.();
          return;
        }

        console.error("Native share failed:", error);
      }
    }

    const timer = window.setTimeout(openNativeShare, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [postId, userId, shareUrl, title, text, onClose, onShared]);

  async function record(method) {
    if (!postId || !userId) {
      return;
    }

    try {
      await recordShare({
        postId,
        userId,
        method,
      });

      onShared?.(method);
    } catch (error) {
      console.error("Failed to record share:", error);
    }
  }

  async function shareToWhatsApp() {
    const message = [text, shareUrl].filter(Boolean).join("\n\n");

    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );

    await record("whatsapp");
  }

  async function shareToFacebook() {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer",
    );

    await record("facebook");
  }

  async function shareToTelegram() {
    const message = [text, shareUrl].filter(Boolean).join("\n\n");

    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(
        shareUrl,
      )}&text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );

    await record("telegram");
  }

  async function shareToX() {
    const message = [text, shareUrl].filter(Boolean).join("\n\n");

    window.open(
      `https://x.com/intent/post?text=${encodeURIComponent(
        message,
      )}&url=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer",
    );

    await record("x");
  }

  async function shareByEmail() {
    const subject = title || "Chit Chat";
    const body = [text, shareUrl].filter(Boolean).join("\n\n");

    window.location.href =
      `mailto:?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    await record("email");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      await record("copy_link");
      onClose?.();
    } catch (error) {
      console.error("Failed to copy share link:", error);
    }
  }

  async function moreOptions() {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({
          title,
          text,
          url: shareUrl,
        });

        await record("native");
        onClose?.();
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error("Native share failed:", error);
        }
      }
    }
  }

  const useNativeMobileShare =
    isMobileDevice() &&
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function";

  if (useNativeMobileShare) {
    return null;
  }

  return (
    <div className="share-panel-backdrop" onClick={onClose}>
      <section
        className="share-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Share"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="share-panel-header">
          <h2>Share</h2>

          <button
            type="button"
            className="share-panel-close"
            aria-label="Close share panel"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </div>

        <div className="share-panel-grid">
          <button
            type="button"
            className="share-option"
            onClick={shareToWhatsApp}
          >
            <span className="share-option-icon whatsapp">
              <MessageCircle size={25} />
            </span>
            <span>WhatsApp</span>
          </button>

          <button
            type="button"
            className="share-option"
            onClick={shareToFacebook}
          >
            <span className="share-option-icon facebook">
              <span className="share-facebook-letter">f</span>
            </span>
            <span>Facebook</span>
          </button>

          <button
            type="button"
            className="share-option"
            onClick={shareToTelegram}
          >
            <span className="share-option-icon telegram">
              <Send size={24} />
            </span>
            <span>Telegram</span>
          </button>

          <button
            type="button"
            className="share-option"
            onClick={shareToX}
          >
            <span className="share-option-icon x">
              <X size={23} />
            </span>
            <span>𝕏</span>
          </button>

          <button
            type="button"
            className="share-option"
            onClick={shareByEmail}
          >
            <span className="share-option-icon email">
              <Mail size={24} />
            </span>
            <span>Email</span>
          </button>

          <button
            type="button"
            className="share-option"
            onClick={copyLink}
          >
            <span className="share-option-icon copy">
              <Copy size={24} />
            </span>
            <span>Copy link</span>
          </button>

          {typeof navigator !== "undefined" &&
            typeof navigator.share === "function" && (
              <button
                type="button"
                className="share-option"
                onClick={moreOptions}
              >
                <span className="share-option-icon more">
                  <Send size={24} />
                </span>
                <span>More</span>
              </button>
            )}
        </div>
      </section>
    </div>
  );
}
