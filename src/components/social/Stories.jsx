import { ChevronLeft, ChevronRight, Eye, Heart, MessageCircle, Plus, Send, User, X, MoreHorizontal, VolumeX, UserPlus, UserMinus, Flag } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import {
  getActiveStories,
  getStoryById,
  getStoryViewCount,
  getStoryViewers,
  hasViewedStory,
  recordStoryView,
} from "../../services/stories/storyService";
import {
  getStoryReactionCount,
  hasStoryReaction,
  replyToStory,
  shareStoryToUser,
  toggleStoryReaction,
} from "../../services/stories/storyInteractionService";
import {
  getFollowers,
  getFollowing,
} from "../../services/follows/followService";
import { resolveMediaUrl } from "../../services/media/mediaService";
import { getUserById } from "../../services/users/userService";

const IMAGE_DURATION = 5000;

function Stories() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile } = useAuth();

  const [stories, setStories] = useState([]);

  const [viewedStoryIds, setViewedStoryIds] = useState(
    () => new Set(),
  );
  const [authors, setAuthors] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedAuthorId, setSelectedAuthorId] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

    const [selectedMediaUrl, setSelectedMediaUrl] = useState("");
  const mediaUrlCacheRef = useRef(new Map());
  const [storyViewCount, setStoryViewCount] = useState(0);
  const [storyViewers, setStoryViewers] = useState([]);
  const [showViewers, setShowViewers] = useState(false);
  const [showStoryMenu, setShowStoryMenu] = useState(false);
  const [isFollowingStoryAuthor, setIsFollowingStoryAuthor] = useState(false);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [storyReactionCount, setStoryReactionCount] = useState(0);
  const [storyReacted, setStoryReacted] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [showSharePicker, setShowSharePicker] = useState(false);
  const [shareTargets, setShareTargets] = useState([]);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSendingId, setShareSendingId] = useState("");
  const [shareError, setShareError] = useState("");
useEffect(() => {
    let cancelled = false;

    async function loadStories() {
      setLoading(true);
      try {
        const requestedStoryId = searchParams.get("storyId");
        const activeStories = await getActiveStories(user.uid);

        if (cancelled) return;

        let nextStories = activeStories;

        if (
          requestedStoryId &&
          !activeStories.some((story) => story.id === requestedStoryId)
        ) {
          try {
            const sharedStory = await getStoryById(
              requestedStoryId,
              user.uid,
            );

            if (sharedStory) {
              nextStories = [...activeStories, sharedStory];
            }
          } catch (error) {
            console.warn(
              "Could not load requested shared Story:",
              error,
            );
          }
        }

        if (cancelled) return;

        setStories(nextStories);

      // Restore previously viewed Story rings from Firestore.
      const previouslyViewed = await Promise.all(
        nextStories
          .filter((story) => story.id && story.authorId !== user.uid)
          .map(async (story) => {
            try {
              return (await hasViewedStory(story.id, user.uid))
                ? story.id
                : null;
            } catch (error) {
              console.warn("Could not restore Story view state:", story.id, error);
              return null;
            }
          }),
      );

      if (!cancelled) {
        setViewedStoryIds(new Set(previouslyViewed.filter(Boolean)));
      }

        const authorIds = [
          ...new Set(
            nextStories
              .map((story) => story.authorId)
              .filter(Boolean),
          ),
        ];

        const profiles = await Promise.all(
          authorIds.map(async (authorId) => {
            try {
              const author = await getUserById(authorId);
              return [authorId, author];
            } catch (error) {
              console.warn(
                "Could not load Story author:",
                authorId,
                error,
              );
              return [authorId, null];
            }
          }),
        );

        if (!cancelled) {
          setAuthors(Object.fromEntries(profiles));
        }
      } catch (error) {
        console.error("Failed to load Stories:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadStories();

    return () => {
      cancelled = true;
    };
  }, []);

  const groupedStories = useMemo(() => {
    const groups = new Map();

    stories.forEach((story) => {
      if (!story.authorId) return;

      if (!groups.has(story.authorId)) {
        groups.set(story.authorId, []);
      }

      groups.get(story.authorId).push(story);
    });

    return Array.from(groups.entries()).map(
      ([authorId, authorStories]) => ({
        authorId,
        stories: [...authorStories].sort(
          (a, b) =>
            (a.createdAt?.toMillis?.() || 0) -
            (b.createdAt?.toMillis?.() || 0),
        ),
      }),
    );
  }, [stories]);

  const ownStories = useMemo(
    () =>
      groupedStories.find(
        (group) => group.authorId === user?.uid,
      ),
    [groupedStories, user?.uid],
  );

  const selectedGroup = useMemo(
    () =>
      groupedStories.find(
        (group) => group.authorId === selectedAuthorId,
      ),
    [groupedStories, selectedAuthorId],
  );

  const selectedStory =
    selectedGroup?.stories[selectedIndex] || null;

  useEffect(() => {
    const requestedStoryId = searchParams.get("storyId");

    if (requestedStoryId) {
      console.log("[STORY OPEN DEBUG]", {
        requestedStoryId,
        selectedAuthorId,
        selectedIndex,
        storiesCount: stories.length,
        groupedStories: groupedStories.map((group) => ({
          authorId: group.authorId,
          storyIds: group.stories.map((story) => story.id),
        })),
        selectedGroupFound: Boolean(selectedGroup),
        selectedStoryId: selectedStory?.id || null,
      });
    }
  }, [
    groupedStories,
    searchParams,
    selectedAuthorId,
    selectedIndex,
    selectedGroup,
    selectedStory,
    stories.length,
  ]);

  function openStory(authorId) {
    const group = groupedStories.find(
      (item) => item.authorId === authorId,
    );

    if (!group?.stories?.length) return;

    const firstUnviewedIndex = group.stories.findIndex(
      (story) => !viewedStoryIds.has(story.id),
    );

    const startIndex =
      firstUnviewedIndex >= 0
        ? firstUnviewedIndex
        : group.stories.length - 1;

    setSelectedAuthorId(authorId);
    setSelectedIndex(Math.max(0, startIndex));
  }

  function closeViewer() {
    setSelectedAuthorId(null);
    setSelectedIndex(0);
  }

  useEffect(() => {
    const storyId = searchParams.get("storyId");

    if (!storyId || !user?.uid) {
      return;
    }

    let cancelled = false;

    async function openRequestedStory() {
      try {
        let requestedStory = stories.find(
          (story) => story.id === storyId,
        );

        if (!requestedStory) {
          requestedStory = await getStoryById(
            storyId,
            user.uid,
          );
        }

        if (cancelled || !requestedStory) {
          return;
        }

        const authorStories = [...stories, requestedStory]
          .filter(
            (story) =>
              story.authorId === requestedStory.authorId,
          )
          .filter(
            (story, index, collection) =>
              collection.findIndex(
                (item) => item.id === story.id,
              ) === index,
          )
          .sort(
            (a, b) =>
              (a.createdAt?.toMillis?.() || 0) -
              (b.createdAt?.toMillis?.() || 0),
          );

        const storyIndex = authorStories.findIndex(
          (story) => story.id === storyId,
        );

        if (storyIndex < 0) {
          return;
        }

        if (!stories.some((story) => story.id === requestedStory.id)) {
          setStories((currentStories) => [
            ...currentStories,
            requestedStory,
          ]);
        }

        setSelectedAuthorId(requestedStory.authorId);
        setSelectedIndex(storyIndex);

        setSearchParams(
          (current) => {
            const next = new URLSearchParams(current);
            next.delete("storyId");
            return next;
          },
          { replace: true },
        );
      } catch (error) {
        console.warn(
          "Could not open requested shared Story:",
          error,
        );
      }
    }

    openRequestedStory();

    return () => {
      cancelled = true;
    };
  }, [
    searchParams,
    setSearchParams,
    stories,
    user?.uid,
  ]);

  function showPrevious() {
    if (!selectedGroup) return;

    if (selectedIndex > 0) {
      setSelectedIndex((index) => index - 1);
    }
  }

  function showNext() {
    if (!selectedGroup) return;

    if (selectedIndex < selectedGroup.stories.length - 1) {
      setSelectedIndex((index) => index + 1);
    } else {
      closeViewer();
    }
  }
  useEffect(() => {
    let cancelled = false;

    async function resolveStoryUrl(story) {
      if (!story?.id) {
        return "";
      }

      const cachedUrl = mediaUrlCacheRef.current.get(story.id);

      if (cachedUrl) {
        return cachedUrl;
      }

      const media = story.media?.[0];

      if (!media) {
        return "";
      }

      const url = await resolveMediaUrl(media);

      if (url) {
        mediaUrlCacheRef.current.set(story.id, url);
      }

      return url;
    }

    async function resolveSelectedMedia() {
      if (!selectedStory) {
        setSelectedMediaUrl("");
        return;
      }

      try {
        const url = await resolveStoryUrl(selectedStory);

        if (!cancelled) {
          setSelectedMediaUrl(url);
        }

        const nextStory =
          selectedGroup?.stories[selectedIndex + 1];

        if (!nextStory) {
          return;
        }

        const nextUrl = await resolveStoryUrl(nextStory);

        if (
          nextUrl &&
          nextStory.mediaType !== "video" &&
          typeof Image !== "undefined"
        ) {
          const image = new Image();
          image.src = nextUrl;
        }
      } catch (error) {
        if (!cancelled) {
          setSelectedMediaUrl("");
        }

        console.warn(
          "Could not resolve Story media:",
          error,
        );
      }
    }

    resolveSelectedMedia();

    return () => {
      cancelled = true;
    };
  }, [selectedStory, selectedGroup, selectedIndex]);



  useEffect(() => {
    setReplyText("");
    setReplySending(false);
    setReplyError("");
    setShowSharePicker(false);
    setShareTargets([]);
    setShareLoading(false);
    setShareSendingId("");
    setShareError("");
    setShowStoryMenu(false);
    setShowViewers(false);
  }, [selectedStory?.id]);

  useEffect(() => {
    if (!selectedStory || !user?.uid) return;

    // Opening your own Story must not count yourself as a viewer.
    if (selectedStory.authorId === user.uid) return;

    recordStoryView(selectedStory.id, user.uid)
      .then(() => {
        setViewedStoryIds((current) => {
          const next = new Set(current);
          next.add(selectedStory.id);
          return next;
        });
      })
      .catch((error) => {
        console.warn("Could not record Story view:", error);
      });
  }, [selectedStory, user?.uid]);

  useEffect(() => {
    let cancelled = false;

    async function loadStoryViewCount() {
      if (
        !selectedStory ||
        !user?.uid ||
        selectedStory.authorId !== user.uid
      ) {
        setStoryViewCount(0);
        return;
      }

      try {
        const count = await getStoryViewCount(selectedStory.id, selectedStory.authorId);

        if (!cancelled) {
          setStoryViewCount(count);
        }
      } catch (error) {
        console.warn("Could not load Story view count:", error);

        if (!cancelled) {
          setStoryViewCount(0);
        }
      }
    }

    loadStoryViewCount();

    return () => {
      cancelled = true;
    };
  }, [selectedStory, user?.uid]);

  useEffect(() => {
    let cancelled = false;

    async function loadStoryReactionState() {
      if (!selectedStory || !user?.uid) {
        setStoryReactionCount(0);
        setStoryReacted(false);
        return;
      }

      try {
        const [count, reacted] = await Promise.all([
          getStoryReactionCount(selectedStory.id),
          selectedStory.authorId === user.uid
            ? Promise.resolve(false)
            : hasStoryReaction(
                selectedStory.id,
                user.uid,
              ),
        ]);

        if (!cancelled) {
          setStoryReactionCount(count);
          setStoryReacted(reacted);
        }
      } catch (error) {
        console.warn(
          "Could not load Story reaction state:",
          error,
        );

        if (!cancelled) {
          setStoryReactionCount(0);
          setStoryReacted(false);
        }
      }
    }

    loadStoryReactionState();

    return () => {
      cancelled = true;
    };
  }, [selectedStory, user?.uid]);

  async function handleStoryReaction() {
    if (
      !selectedStory ||
      !user?.uid ||
      selectedStory.authorId === user.uid
    ) {
      return;
    }

    const previousReacted = storyReacted;
    const previousCount = storyReactionCount;
    const nextReacted = !previousReacted;

    setStoryReacted(nextReacted);
    setStoryReactionCount(
      Math.max(
        0,
        previousCount + (nextReacted ? 1 : -1),
      ),
    );

    try {
      const reacted = await toggleStoryReaction({
        storyId: selectedStory.id,
        userId: user.uid,
        authorId: selectedStory.authorId,
      });

      setStoryReacted(reacted);

      const count = await getStoryReactionCount(
        selectedStory.id,
      );

      setStoryReactionCount(count);
    } catch (error) {
      console.warn(
        "Could not update Story reaction:",
        error,
      );

      setStoryReacted(previousReacted);
      setStoryReactionCount(previousCount);
    }
  }

  async function handleStoryReply(event) {
    event?.preventDefault?.();

    if (
      !selectedStory ||
      !user?.uid ||
      selectedStory.authorId === user.uid ||
      !replyText.trim() ||
      replySending
    ) {
      return;
    }

    setReplySending(true);
    setReplyError("");

    try {
      await replyToStory({
        storyId: selectedStory.id,
        authorId: selectedStory.authorId,
        senderId: user.uid,
        text: replyText,
      });

      setReplyText("");
    } catch (error) {
      console.warn("Could not reply to Story:", error);
      setReplyError("Couldn't send reply.");
    } finally {
      setReplySending(false);
    }
  }

  async function openStorySharePicker() {
    if (!user?.uid || shareLoading) return;

    setShowSharePicker(true);
    setShareLoading(true);
    setShareError("");

    try {
      const [followers, following] = await Promise.all([
        getFollowers(user.uid),
        getFollowing(user.uid),
      ]);

      const ids = [
        ...new Set([
          ...followers.map((item) => item.followerId),
          ...following.map((item) => item.followingId),
        ]),
      ].filter(
        (id) => id && id !== user.uid,
      );

      const profiles = await Promise.all(
        ids.map(async (id) => {
          try {
            const viewer = await getUserById(id);

            return {
              id,
              ...viewer,
            };
          } catch {
            return null;
          }
        }),
      );

      setShareTargets(
        profiles
          .filter(Boolean)
          .filter(
            (target) =>
              target.id !== user.uid &&
              target.uid !== user.uid &&
              target.username !== profile?.username,
          )
          .sort((a, b) =>
            (
              a.displayName ||
              a.username ||
              ""
            ).localeCompare(
              b.displayName ||
              b.username ||
              "",
            ),
          ),
      );
    } catch (error) {
      console.warn(
        "Could not load Story share targets:",
        error,
      );
      setShareTargets([]);
      setShareError("Couldn't load people to send to.");
    } finally {
      setShareLoading(false);
    }
  }

  async function handleStoryShare(target) {
    if (
      !selectedStory ||
      !user?.uid ||
      !target?.id ||
      shareSendingId
    ) {
      return;
    }

    setShareSendingId(target.id);
    setShareError("");

    try {
      console.log("[STORY SHARE DEBUG]", {
        selectedStoryId: selectedStory?.id,
        selectedAuthorId: selectedStory?.authorId,
        selectedIndex,
        selectedStoryCreatedAt: selectedStory?.createdAt,
        selectedMediaUrl,
        selectedStoryMedia: selectedStory?.media,
      });

      const media = selectedStory.media?.[0];

      await shareStoryToUser({
        storyId: selectedStory.id,
        authorId: selectedStory.authorId,
        senderId: user.uid,
        recipientId: target.id,
        mediaUrl: selectedMediaUrl,
        mediaType:
          media?.mimeType ||
          (selectedStory.mediaType === "video"
            ? "video/mp4"
            : "image/jpeg"),
        mediaSize: media?.size,
      });

      setShowSharePicker(false);
    } catch (error) {
      console.warn(
        "Could not share Story:",
        error,
      );
      setShareError("Couldn't send this Story.");
    } finally {
      setShareSendingId("");
    }
  }

  async function openStoryViewers() {
    if (
      !selectedStory ||
      !user?.uid ||
      selectedStory.authorId !== user.uid
    ) {
      return;
    }

    setShowViewers(true);
    setLoadingViewers(true);

    try {
      const views = await getStoryViewers(selectedStory.id, selectedStory.authorId);

      const profiles = await Promise.all(
        views.map(async (view) => {
          try {
            const viewer = await getUserById(view.userId);
            return {
              ...view,
              viewer,
            };
          } catch (error) {
            console.warn(
              "Could not load Story viewer:",
              view.userId,
              error,
            );

            return {
              ...view,
              viewer: null,
            };
          }
        }),
      );

      setStoryViewers(profiles);
      setStoryViewCount(profiles.length);
    } catch (error) {
      console.warn("Could not load Story viewers:", error);
      setStoryViewers([]);
    } finally {
      setLoadingViewers(false);
    }
  }

  function formatViewedAt(timestamp) {
    const date = timestamp?.toDate?.();

    if (!date) {
      return "Recently";
    }

    const seconds = Math.max(
      0,
      Math.floor((Date.now() - date.getTime()) / 1000),
    );

    if (seconds < 60) {
      return "Just now";
    }

    const minutes = Math.floor(seconds / 60);

    if (minutes < 60) {
      return `${minutes}m ago`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours < 24) {
      return `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);

    return `${days}d ago`;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadStoryFollowState() {
      if (
        !selectedStory ||
        !user?.uid ||
        selectedStory.authorId === user.uid
      ) {
        if (!cancelled) {
          setIsFollowingStoryAuthor(false);
        }
        return;
      }

      try {
        const { isFollowing } = await import(
          "../../services/follows/followService"
        );

        const following = await isFollowing(
          user.uid,
          selectedStory.authorId,
        );

        if (!cancelled) {
          setIsFollowingStoryAuthor(Boolean(following));
        }
      } catch (error) {
        console.warn(
          "Could not load Story follow state:",
          error,
        );

        if (!cancelled) {
          setIsFollowingStoryAuthor(false);
        }
      }
    }

    loadStoryFollowState();

    return () => {
      cancelled = true;
    };
  }, [selectedStory, user?.uid]);

  useEffect(() => {
    if (!selectedStory || selectedStory.mediaType === "video") {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      showNext();
    }, IMAGE_DURATION);

    return () => window.clearTimeout(timer);
  }, [selectedStory, selectedIndex]);

  const selectedAuthor =
    selectedGroup?.authorId === user?.uid
      ? profile
      : authors[selectedGroup?.authorId];

  const selectedAuthorName =
    selectedAuthor?.displayName ||
    selectedAuthor?.username ||
    "User";

  const ownInitial =
    profile?.displayName?.charAt(0)?.toUpperCase() ||
    profile?.username?.charAt(0)?.toUpperCase() ||
    "U";

  return (
    <>
      <section
        className="cc-stories"
        aria-label="Stories"
      >
        <div className="cc-stories-list">
          <button
            type="button"
            className={`cc-story-item is-own ${
              ownStories ? "has-story" : "is-empty"
            }`}
            onClick={() => {
              if (ownStories) {
                openStory(user.uid);
              } else {
                navigate("/create?type=story");
              }
            }}
          >
            <span
              className={`cc-story-avatar-wrap ${
                ownStories ? "has-story" : "is-empty"
              }`}
            >
              <span className="cc-story-avatar">
                {profile?.photoURL ? (
                  <img
                    src={profile.photoURL}
                    alt=""
                  />
                ) : (
                  ownInitial
                )}
              </span>

              {!ownStories && (
                <span
                  className="cc-story-add"
                  aria-hidden="true"
                >
                  <Plus
                    size={14}
                    strokeWidth={3}
                  />
                </span>
              )}
            </span>

            <span className="cc-story-name">
              {ownStories ? "Your story" : "Your story"}
            </span>
          </button>

          {loading && (
            <div className="cc-story-loading">
              Loading...
            </div>
          )}

          {!loading &&
            groupedStories
              .filter(
                (group) => group.authorId !== user?.uid,
              )
              .map((group) => {
                const author = authors[group.authorId];

                const name =
                  author?.displayName ||
                  author?.username ||
                  "User";

                const initial =
                  name.charAt(0).toUpperCase() || "U";

                return (
                  <button
                    key={group.authorId}
                    type="button"
                    className="cc-story-item has-story"
                    onClick={() =>
                      openStory(group.authorId)
                    }
                  >
                    <span
                      className={`cc-story-avatar-wrap has-story ${
                        group.stories.length > 0 &&
                        group.stories.every((story) =>
                          viewedStoryIds.has(story.id),
                        )
                          ? "is-viewed"
                          : ""
                      }`}
                    >
                      <span className="cc-story-avatar">
                        {author?.photoURL ? (
                          <img
                            src={author.photoURL}
                            alt=""
                          />
                        ) : (
                          initial
                        )}
                      </span>
                    </span>

                    <span className="cc-story-name">
                      {name}
                    </span>
                  </button>
                );
              })}
        </div>
      </section>

      {selectedStory && selectedGroup && (
        <div
          className="cc-story-viewer-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Story viewer"
          onClick={closeViewer}
        >
          <div
            className={`cc-story-viewer ${
              showViewers ? "is-viewers-open" : ""
            }`}
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="cc-story-viewer-progress">
              {selectedGroup.stories.map((story, index) => (
                <div
                  key={story.id}
                  className="cc-story-progress-segment"
                >
                  {index < selectedIndex && (
                    <span className="cc-story-progress-fill completed" />
                  )}

                  {index === selectedIndex && (
                    <span
                      key={story.id}
                      className="cc-story-progress-fill active"
                    />
                  )}
                </div>
              ))}
            </div>

            <header className="cc-story-viewer-header">
              <div className="cc-story-viewer-user">
                <div className="cc-story-viewer-avatar">
                  {selectedAuthor?.photoURL ? (
                    <img
                      src={selectedAuthor.photoURL}
                      alt=""
                    />
                  ) : (
                    selectedAuthorName
                      .charAt(0)
                      .toUpperCase()
                  )}
                </div>

                <span>{selectedAuthorName}</span>
              </div>

              {selectedStory.authorId !== user?.uid && (
                <div className="cc-story-more-wrap">
                  <button
                    type="button"
                    className="cc-story-more-button"
                    onClick={() =>
                      setShowStoryMenu((current) => !current)
                    }
                    aria-label="Story options"
                    aria-expanded={showStoryMenu}
                  >
                    <MoreHorizontal
                      size={24}
                      strokeWidth={2.3}
                    />
                  </button>

                  {showStoryMenu && (
                    <div className="cc-story-more-menu">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const followService = await import(
                              "../../services/follows/followService"
                            );

                            if (isFollowingStoryAuthor) {
                              await followService.unfollowUser(
                                user.uid,
                                selectedStory.authorId,
                              );
                              setIsFollowingStoryAuthor(false);
                            } else {
                              await followService.followUser(
                                user.uid,
                                selectedStory.authorId,
                              );
                              setIsFollowingStoryAuthor(true);
                            }

                            setShowStoryMenu(false);
                          } catch (error) {
                            console.warn(
                              "Could not update Story follow:",
                              error,
                            );
                          }
                        }}
                      >
                        {isFollowingStoryAuthor ? (
                          <>
                            <UserMinus size={18} />
                            <span>Unfollow</span>
                          </>
                        ) : (
                          <>
                            <UserPlus size={18} />
                            <span>Follow</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          localStorage.setItem(
                            `cc-muted-story-author-${selectedStory.authorId}`,
                            "true",
                          );
                          setShowStoryMenu(false);
                          closeViewer();
                        }}
                      >
                        <VolumeX size={18} />
                        <span>Mute</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowStoryMenu(false);
                          window.alert(
                            "Report this Story from the moderation flow.",
                          );
                        }}
                      >
                        <Flag size={18} />
                        <span>Report</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                className="cc-story-viewer-close"
                onClick={closeViewer}
                aria-label="Close Story"
              >
                <X size={22} />
              </button>
            </header>

            <div className="cc-story-viewer-media">
              {selectedStory.mediaType === "video" ? (
                <video
                  key={selectedStory.id}
                  src={selectedMediaUrl || undefined}
                  autoPlay
                  playsInline
                  onEnded={showNext}
                />
              ) : (
                <img
                  key={selectedStory.id}
                  src={selectedMediaUrl || undefined}
                  alt=""
                />
              )}
            </div>

            {selectedStory.caption && (
              <p className="cc-story-viewer-caption">
                {selectedStory.caption}
              </p>
            )}

            {selectedStory.authorId === user?.uid && (
              <button
                type="button"
                className="cc-story-viewer-views-button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  openStoryViewers();
                }}
                aria-label={`Story views: ${storyViewCount}`}
                title={`Story views: ${storyViewCount}`}
              >
                <Eye size={19} strokeWidth={2.2} />
                <span>{storyViewCount}</span>
              </button>
            )}

            <div className="cc-story-interaction-bar">
              {selectedStory.authorId !== user?.uid && (
                <>
                  <button
                    type="button"
                    className={`cc-story-interaction-button ${
                      storyReacted ? "is-active" : ""
                    }`}
                    onClick={handleStoryReaction}
                    aria-label={
                      storyReacted
                        ? "Remove Story reaction"
                        : "React to Story"
                    }
                  >
                    <Heart
                      size={21}
                      strokeWidth={2.2}
                      fill={
                        storyReacted
                          ? "currentColor"
                          : "none"
                      }
                    />
                    <span>{storyReactionCount}</span>
                  </button>

                  <form
                    className="cc-story-reply-form"
                    onSubmit={handleStoryReply}
                  >
                    <input
                      value={replyText}
                      onChange={(event) => {
                        setReplyText(event.target.value);
                        setReplyError("");
                      }}
                      maxLength={1000}
                      placeholder="Reply to Story…"
                      aria-label="Reply to Story"
                    />
                    <button
                      type="submit"
                      disabled={
                        replySending ||
                        !replyText.trim()
                      }
                      aria-label="Send Story reply"
                    >
                      <MessageCircle
                        size={20}
                        strokeWidth={2.2}
                      />
                    </button>
                  </form>
                </>
              )}

              <button
                type="button"
                className="cc-story-interaction-button"
                onClick={openStorySharePicker}
                aria-label="Send Story"
              >
                <Send
                  size={21}
                  strokeWidth={2.2}
                />
                <span>Send</span>
              </button>
            </div>

            {replyError && (
              <div className="cc-story-interaction-error">
                {replyError}
              </div>
            )}

            {showSharePicker && (
              <div
                className="cc-story-share-backdrop"
                onClick={() =>
                  setShowSharePicker(false)
                }
              >
                <section
                  className="cc-story-share-sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Send Story"
                  onClick={(event) =>
                    event.stopPropagation()
                  }
                >
                  <header className="cc-story-share-header">
                    <div>
                      <strong>Send Story</strong>
                      <span>
                        Choose someone to send this Story to
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setShowSharePicker(false)
                      }
                      aria-label="Close Story sharing"
                    >
                      <X size={21} />
                    </button>
                  </header>

                  <div className="cc-story-share-list">
                    {shareLoading ? (
                      <div className="cc-story-share-empty">
                        Loading people…
                      </div>
                    ) : shareTargets.length === 0 ? (
                      <div className="cc-story-share-empty">
                        Follow someone or have followers to send
                        Stories.
                      </div>
                    ) : (
                      shareTargets.map((target) => {
                        const name =
                          target.displayName ||
                          target.username ||
                          "User";

                        const initial =
                          name
                            .charAt(0)
                            .toUpperCase() || "U";

                        return (
                          <button
                            type="button"
                            key={target.id}
                            className="cc-story-share-row"
                            onClick={() =>
                              handleStoryShare(target)
                            }
                            disabled={
                              Boolean(shareSendingId)
                            }
                          >
                            <span className="cc-story-share-avatar">
                              {target.photoURL ? (
                                <img
                                  src={target.photoURL}
                                  alt=""
                                />
                              ) : (
                                initial
                              )}
                            </span>

                            <span className="cc-story-share-info">
                              <strong>{name}</strong>
                              {target.username && (
                                <span>
                                  @{target.username}
                                </span>
                              )}
                            </span>

                            <span className="cc-story-share-send">
                              {shareSendingId ===
                              target.id ? (
                                "Sending…"
                              ) : (
                                <Send
                                  size={18}
                                  strokeWidth={2.2}
                                />
                              )}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>

                  {shareError && (
                    <div className="cc-story-interaction-error">
                      {shareError}
                    </div>
                  )}
                </section>
              </div>
            )}

            {showViewers &&
              selectedStory.authorId === user?.uid && (
                <div
                  className="cc-story-viewers-sheet-backdrop"
                  onClick={() => setShowViewers(false)}
                >
                  <section
                    className="cc-story-viewers-sheet"
                    onClick={(event) => event.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Story viewers"
                  >
                    <div className="cc-story-viewers-sheet-handle" />

                    <header className="cc-story-viewers-sheet-header">
                      <div>
                        <strong>Story views</strong>
                        <span>
                          {storyViewCount}{" "}
                          {storyViewCount === 1
                            ? "viewer"
                            : "viewers"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowViewers(false)}
                        aria-label="Close viewers"
                      >
                        <X size={21} />
                      </button>
                    </header>

                    <div className="cc-story-viewers-list">
                      {loadingViewers ? (
                        <div className="cc-story-viewers-empty">
                          Loading viewers…
                        </div>
                      ) : storyViewers.length === 0 ? (
                        <div className="cc-story-viewers-empty">
                          No viewers yet
                        </div>
                      ) : (
                        storyViewers.map((view) => {
                          const viewer = view.viewer;
                          const viewerName =
                            viewer?.displayName ||
                            viewer?.username ||
                            "User";

                          const viewerInitial =
                            viewerName.charAt(0).toUpperCase();

                          return (
                            <div
                              key={view.id}
                              className="cc-story-viewer-row"
                            >
                              <div className="cc-story-viewer-row-avatar">
                                {viewer?.photoURL ? (
                                  <img
                                    src={viewer.photoURL}
                                    alt=""
                                  />
                                ) : (
                                  viewerInitial
                                )}
                              </div>

                              <div className="cc-story-viewer-row-info">
                                <strong>{viewerName}</strong>

                                {viewer?.username &&
                                  viewer.username !==
                                    viewer.displayName && (
                                    <span>
                                      @{viewer.username}
                                    </span>
                                  )}
                              </div>

                              <time>
                                {formatViewedAt(
                                  view.createdAt,
                                )}
                              </time>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>
                </div>
              )}

            <button
              type="button"
              className="cc-story-viewer-tap previous"
              onClick={showPrevious}
              aria-label="Previous Story"
            >
              <ChevronLeft size={30} />
            </button>

            <button
              type="button"
              className="cc-story-viewer-tap next"
              onClick={showNext}
              aria-label="Next Story"
            >
              <ChevronRight size={30} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default Stories;
