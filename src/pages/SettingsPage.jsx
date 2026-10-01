import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  Bell,
  BellRing,
  Bookmark,
  Camera,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileText,
  Info,
  Languages,
  Lock,
  MessageCircle,
  Mic,
  Moon,
  Shield,
  ShieldCheck,
  ScanEye,
  SlidersHorizontal,
  Smartphone,
  UserCheck,
  UserPlus,
  Users,
  Video,
  Volume2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthProvider";
import { updateUserProfile, getUserById } from "../services/users/userService";
import {
  changeUserPassword,
  logoutUser,
} from "../services/auth/authService";
import { getSavedPosts } from "../services/saves/saveService";
import {
  getArchivedPosts,
  unarchivePost,
} from "../services/posts/postService";

const STORAGE_KEY = "chit-chat-settings";

const defaultSettings = {
  notifications: true,
  sound: true,
  privateAccount: false,
  hideLikeCounts: false,
  messageRequests: true,
  commentRequests: true,
  mentions: true,
  tags: true,
  highQualityMedia: true,
  autoplayVideos: true,
  dataSaver: false,
  darkMode: false,
  language: "English",
};

const sections = [
  {
    title: "Your account",
    items: [
      { id: "security", label: "Password & security", description: "Protect your account and login", icon: Shield },
      { id: "account", label: "Account information", description: "View your account details and controls", icon: Users },
    ],
  },
  {
    title: "Privacy & safety",
    items: [
      { id: "privacy", label: "Account privacy", description: "Control who can see your content", icon: Lock },
      { id: "blocked", label: "Blocked accounts", description: "Manage accounts you have blocked", icon: Eye },
      { id: "restricted", label: "Restricted accounts", description: "Limit interactions from selected people", icon: UserCheck },
      { id: "hidden", label: "Hidden words", description: "Filter unwanted words and comments", icon: SlidersHorizontal },
      { id: "comments", label: "Comments", description: "Choose who can comment", icon: MessageCircle },
      { id: "tags", label: "Tags & mentions", description: "Control tags and mentions", icon: UserPlus },
      { id: "sharing", label: "Sharing & reuse", description: "Control how your content can be shared", icon: Download },
    ],
  },
  {
    title: "Notifications",
    items: [
      { id: "notifications", label: "Notifications", description: "Choose what you want to receive", icon: Bell },
    ],
  },
  {
    title: "Messages & connections",
    items: [
      { id: "messages", label: "Messages & replies", description: "Message requests and replies", icon: MessageCircle },
      { id: "followers", label: "Follow & invite friends", description: "Manage follow and invitation options", icon: UserPlus },
    ],
  },
  {
    title: "Your activity",
    items: [
      { id: "saved", label: "Saved", description: "Posts and videos you saved", icon: Bookmark },
      { id: "archive", label: "Archive", description: "Manage archived content", icon: Archive },
      { id: "activity", label: "Your activity", description: "Review your activity on Chit Chat", icon: Activity },
      { id: "time", label: "Time management", description: "Manage time spent in the app", icon: Clock3 },
    ],
  },
  {
    title: "App",
    items: [
      { id: "media", label: "Media quality", description: "Uploads, playback and data usage", icon: Video },
      { id: "permissions", label: "Device permissions", description: "Camera, microphone and notifications", icon: Smartphone },
      { id: "language", label: "Language", description: "Choose your app language", icon: Languages },
      { id: "accessibility", label: "Accessibility", description: "Make Chit Chat easier to use", icon: SlidersHorizontal },
      { id: "sound", label: "Sound", description: "Control app sounds", icon: Volume2 },
      { id: "appearance", label: "Appearance", description: "Choose light or dark appearance", icon: Moon },
    ],
  },
  {
    title: "Help & about",
    items: [
      { id: "help", label: "Help", description: "Get answers and troubleshoot problems", icon: CircleHelp },
      { id: "report", label: "Report a problem", description: "Tell us about an issue", icon: FileText },
      { id: "status", label: "Account status", description: "Check restrictions and account health", icon: Shield },
      { id: "about", label: "About Chit Chat", description: "Version, policies and information", icon: Info },
    ],
  },
];

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved
      ? { ...defaultSettings, ...JSON.parse(saved) }
      : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

function SettingsPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [settings, setSettings] = useState(loadSettings);
  const [activeItem, setActiveItem] = useState(null);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [privacyMessage, setPrivacyMessage] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;

    try {
      setLoggingOut(true);
      await logoutUser();
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
      setLoggingOut(false);
      window.alert("Unable to log out right now. Please try again.");
    }
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (profile?.isPrivate !== undefined) {
      setSettings((current) => ({
        ...current,
        privateAccount: Boolean(profile.isPrivate),
      }));
    }
  }, [profile?.isPrivate]);

  const activeDefinition = useMemo(
    () =>
      sections
        .flatMap((section) => section.items)
        .find((item) => item.id === activeItem),
    [activeItem],
  );

  function updateSetting(key, value) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function togglePrivateAccount(value) {
    updateSetting("privateAccount", value);
    setPrivacyMessage("");
    setSavingPrivacy(true);

    try {
      await updateUserProfile(profile.uid, {
        isPrivate: value,
      });
      setPrivacyMessage(
        value
          ? "Your account is now private."
          : "Your account is now public.",
      );
    } catch {
      updateSetting("privateAccount", !value);
      setPrivacyMessage("Could not update account privacy.");
    } finally {
      setSavingPrivacy(false);
    }
  }

  function renderDetail() {
    if (!activeDefinition) return null;

    const id = activeDefinition.id;

    if (id === "privacy") {
      return (
        <DetailPanel
          title="Account privacy"
          onClose={() => setActiveItem(null)}
        >
          <SettingToggle
            label="Private account"
            description="Only people you approve can follow you and see your private content."
            checked={settings.privateAccount}
            disabled={savingPrivacy}
            onChange={togglePrivateAccount}
          />

          {privacyMessage && (
            <p className="cc-settings-message">{privacyMessage}</p>
          )}
        </DetailPanel>
      );
    }

    if (id === "notifications") {
      return (
        <DetailPanel
          title="Notifications"
          onClose={() => setActiveItem(null)}
        >
          <SettingToggle
            label="Push notifications"
            description="Receive alerts for likes, comments, follows and messages."
            checked={settings.notifications}
            onChange={(value) => updateSetting("notifications", value)}
          />
        </DetailPanel>
      );
    }

    if (id === "messages") {
      return (
        <DetailPanel
          title="Messages & replies"
          onClose={() => setActiveItem(null)}
        >
          <SettingToggle
            label="Message requests"
            description="Allow people you do not follow to send message requests."
            checked={settings.messageRequests}
            onChange={(value) => updateSetting("messageRequests", value)}
          />

          <SettingToggle
            label="Comment requests"
            description="Allow replies and interactions from people outside your network."
            checked={settings.commentRequests}
            onChange={(value) => updateSetting("commentRequests", value)}
          />
        </DetailPanel>
      );
    }

    if (id === "tags") {
      return (
        <DetailPanel
          title="Tags & mentions"
          onClose={() => setActiveItem(null)}
        >
          <SettingToggle
            label="Allow mentions"
            description="Let people mention you in posts, captions and comments."
            checked={settings.mentions}
            onChange={(value) => updateSetting("mentions", value)}
          />

          <SettingToggle
            label="Allow tags"
            description="Let people tag your profile in content."
            checked={settings.tags}
            onChange={(value) => updateSetting("tags", value)}
          />
        </DetailPanel>
      );
    }

    if (id === "media") {
      return (
        <DetailPanel
          title="Media quality"
          onClose={() => setActiveItem(null)}
        >
          <SettingToggle
            label="High quality uploads"
            description="Prefer higher quality when uploading photos and videos."
            checked={settings.highQualityMedia}
            onChange={(value) => updateSetting("highQualityMedia", value)}
          />

          <SettingToggle
            label="Autoplay videos"
            description="Automatically play videos when they become visible."
            checked={settings.autoplayVideos}
            onChange={(value) => updateSetting("autoplayVideos", value)}
          />

          <SettingToggle
            label="Data saver"
            description="Reduce media usage when mobile data is limited."
            checked={settings.dataSaver}
            onChange={(value) => updateSetting("dataSaver", value)}
          />
        </DetailPanel>
      );
    }

    if (id === "sound") {
      return (
        <DetailPanel
          title="Sound"
          onClose={() => setActiveItem(null)}
        >
          <SettingToggle
            label="App sounds"
            description="Enable sounds for interactions and notifications."
            checked={settings.sound}
            onChange={(value) => updateSetting("sound", value)}
          />
        </DetailPanel>
      );
    }

    if (id === "appearance") {
      return (
        <DetailPanel
          title="Appearance"
          onClose={() => setActiveItem(null)}
        >
          <SettingToggle
            label="Dark appearance"
            description="Use a darker interface throughout Chit Chat."
            checked={settings.darkMode}
            onChange={(value) => updateSetting("darkMode", value)}
          />
        </DetailPanel>
      );
    }

    if (id === "language") {
      return (
        <DetailPanel
          title="Language"
          onClose={() => setActiveItem(null)}
        >
          <button
            type="button"
            className="cc-settings-choice"
            onClick={() => updateSetting("language", "English")}
          >
            <span>English</span>
            {settings.language === "English" && <span>✓</span>}
          </button>
          <button
            type="button"
            className="cc-settings-choice"
            onClick={() => updateSetting("language", "Kannada")}
          >
            <span>ಕನ್ನಡ</span>
            {settings.language === "Kannada" && <span>✓</span>}
          </button>
          <button
            type="button"
            className="cc-settings-choice"
            onClick={() => updateSetting("language", "Telugu")}
          >
            <span>తెలుగు</span>
            {settings.language === "Telugu" && <span>✓</span>}
          </button>
          <button
            type="button"
            className="cc-settings-choice"
            onClick={() => updateSetting("language", "Hindi")}
          >
            <span>हिन्दी</span>
            {settings.language === "Hindi" && <span>✓</span>}
          </button>
        </DetailPanel>
      );
    }

    if (id === "saved") {
      return (
        <DetailPanel title="Saved" onClose={() => setActiveItem(null)}>
          <SavedContent
            userId={user?.uid}
            onOpenPost={(postId) => navigate(`/post/${postId}`)}
          />
        </DetailPanel>
      );
    }

    if (id === "archive") {
      return (
        <DetailPanel title="Archive" onClose={() => setActiveItem(null)}>
          <ArchivedContent
            userId={user?.uid}
            onOpenPost={(postId) => navigate(`/post/${postId}`)}
          />
        </DetailPanel>
      );
    }

    if (id === "activity") {
      return (
        <DetailPanel title="Your activity" onClose={() => setActiveItem(null)}>
          <EmptySetting
            icon={Activity}
            title="Activity history"
            text="Your likes, comments, follows and other activity will be shown here."
          />
        </DetailPanel>
      );
    }

    if (id === "time") {
      return (
        <DetailPanel
          title="Time management"
          onClose={() => setActiveItem(null)}
        >
          <div className="cc-settings-feature-card">
            <Clock3 size={28} />
            <strong>Time spent</strong>
            <p>
              Time-management controls will help you understand and manage how
              long you spend using Chit Chat.
            </p>
          </div>
        </DetailPanel>
      );
    }

    if (id === "account") {
      return (
        <DetailPanel
          title="Account information"
          onClose={() => setActiveItem(null)}
        >
          <div className="cc-account-info-panel">
            <div className="cc-account-info-intro">
              <div className="cc-account-info-intro-icon">
                <Users size={22} strokeWidth={1.8} />
              </div>

              <div>
                <strong>Your account details</strong>
                <p>
                  Information associated with your Chit Chat account.
                </p>
              </div>
            </div>

            <div className="cc-account-info-list">
              <div className="cc-account-info-row">
                <div className="cc-account-info-icon">
                  <Users size={19} strokeWidth={1.8} />
                </div>

                <div className="cc-account-info-copy">
                  <span>Username</span>
                  <strong>
                    @{profile?.username || "user"}
                  </strong>
                </div>
              </div>

              <div className="cc-account-info-row">
                <div className="cc-account-info-icon">
                  <Info size={19} strokeWidth={1.8} />
                </div>

                <div className="cc-account-info-copy">
                  <span>Email address</span>
                  <strong>
                    {user?.email || "Not available"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="cc-account-info-note">
              <Info size={16} strokeWidth={1.8} />
              <span>
                Your account information is private and is only used to manage
                your Chit Chat account.
              </span>
            </div>
          </div>
        </DetailPanel>
      );
    }

    if (id === "security") {
      return (
        <DetailPanel
          title="Password & security"
          onClose={() => setActiveItem(null)}
        >
          <ChangePasswordPanel />
        </DetailPanel>
      );
    }

    if (id === "blocked" || id === "restricted") {
      return (
        <DetailPanel
          title={activeDefinition.label}
          onClose={() => setActiveItem(null)}
        >
          <EmptySetting
            icon={activeDefinition.icon}
            title={activeDefinition.label}
            text="Accounts managed through this control will appear here."
          />
        </DetailPanel>
      );
    }

    if (id === "hidden" || id === "comments" || id === "sharing") {
      return (
        <DetailPanel
          title={activeDefinition.label}
          onClose={() => setActiveItem(null)}
        >
          <EmptySetting
            icon={activeDefinition.icon}
            title={activeDefinition.label}
            text="Detailed controls for this feature will be managed from this section."
          />
        </DetailPanel>
      );
    }

    if (id === "permissions") {
      return (
        <DetailPanel
          title="Device permissions"
          onClose={() => setActiveItem(null)}
        >
          <PermissionRow label="Camera" text="Used when creating photos and videos." />
          <PermissionRow label="Microphone" text="Used when recording video and voice messages." />
          <PermissionRow label="Notifications" text="Used for alerts and activity updates." />
        </DetailPanel>
      );
    }

    if (id === "accessibility") {
      return (
        <DetailPanel
          title="Accessibility"
          onClose={() => setActiveItem(null)}
        >
          <EmptySetting
            icon={SlidersHorizontal}
            title="Accessibility controls"
            text="Text size, motion and accessibility preferences will be managed here."
          />
        </DetailPanel>
      );
    }

    if (id === "followers" || id === "activity-feed") {
      return (
        <DetailPanel
          title={activeDefinition.label}
          onClose={() => setActiveItem(null)}
        >
          <EmptySetting
            icon={activeDefinition.icon}
            title={activeDefinition.label}
            text="Your interaction preferences will be managed here."
          />
        </DetailPanel>
      );
    }

    if (id === "help") {
      return (
        <DetailPanel title="Help" onClose={() => setActiveItem(null)}>
          <EmptySetting
            icon={CircleHelp}
            title="Chit Chat Help"
            text="Find answers about your account, posts, messages, privacy and safety."
          />
        </DetailPanel>
      );
    }

    if (id === "report") {
      return (
        <DetailPanel
          title="Report a problem"
          onClose={() => setActiveItem(null)}
        >
          <div className="cc-settings-feature-card">
            <FileText size={28} />
            <strong>Tell us what went wrong</strong>
            <p>
              Reporting tools will let you send an issue directly to the Chit
              Chat support system.
            </p>
            <button type="button" onClick={() => setActiveItem(null)}>
              Continue
              <ChevronRight size={18} />
            </button>
          </div>
        </DetailPanel>
      );
    }

    if (id === "status") {
      return (
        <DetailPanel
          title="Account status"
          onClose={() => setActiveItem(null)}
        >
          <div className="cc-status-good">
            <Shield size={28} />
            <div>
              <strong>Your account is in good standing</strong>
              <p>No current restrictions are shown.</p>
            </div>
          </div>
        </DetailPanel>
      );
    }

    if (id === "about") {
      return (
        <DetailPanel
          title="About Chit Chat"
          onClose={() => setActiveItem(null)}
        >
          <div className="cc-about-card">
            <div className="cc-about-logo">CC</div>
            <strong>Chit Chat</strong>
            <span>Share. Connect. Chat.</span>
            <small>Version 1.0</small>
          </div>
        </DetailPanel>
      );
    }

    return null;
  }

  return (
    <main className="cc-settings-page">
      <div className="cc-settings-header">
        <button
          type="button"
          className="cc-settings-back"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <X size={21} />
        </button>

        <div>
          <span className="cc-settings-eyebrow">Chit Chat</span>
          <h1>Settings & activity</h1>
        </div>
      </div>

      <div className="cc-settings-intro">
        <strong>Manage your Chit Chat experience</strong>
        <p>
          Privacy, notifications, account controls and everything in between.
        </p>
      </div>

      <div className="cc-settings-sections">
        {sections.map((section) => (
          <section className="cc-settings-section" key={section.title}>
            <h2>{section.title}</h2>

            <div className="cc-settings-card">
              {section.items.map((item) => {
                const Icon = item.icon;

                let value = null;

                if (item.id === "privacy") {
                  value = settings.privateAccount ? "Private" : "Public";
                }

                if (item.id === "notifications") {
                  value = settings.notifications ? "On" : "Off";
                }

                if (item.id === "language") {
                  value = settings.language;
                }

                return (
                  <button
                    type="button"
                    className="cc-settings-row"
                    key={item.id}
                    onClick={() => setActiveItem(item.id)}
                  >
                    <span className="cc-settings-icon">
                      <Icon size={20} strokeWidth={1.9} />
                    </span>

                    <span className="cc-settings-row-copy">
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>

                    {value && (
                      <span className="cc-settings-value">{value}</span>
                    )}

                    <ChevronRight
                      className="cc-settings-chevron"
                      size={19}
                    />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>


      <div className="cc-settings-logout">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          <span className="cc-settings-logout-icon">
            <X size={20} />
          </span>
          <span>{loggingOut ? "Logging out..." : "Log out"}</span>
        </button>
      </div>

      {activeItem && (
        <div
          className="cc-settings-overlay"
          onClick={() => setActiveItem(null)}
        >
          <div
            className="cc-settings-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            {renderDetail()}
          </div>
        </div>
      )}
    </main>
  );
}

function ArchivedContent({ userId, onOpenPost }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unarchivingId, setUnarchivingId] = useState("");


  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!userId) {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setError("");

        const archivedPosts = await getArchivedPosts(userId);

        const enriched = await Promise.all(
          archivedPosts.map(async (post) => {
            if (!post.authorId) {
              return {
                ...post,
                author: null,
              };
            }

            try {
              const author = await getUserById(post.authorId);

              return {
                ...post,
                author,
              };
            } catch (authorError) {
              console.error(
                `Failed to load archived content author ${post.authorId}:`,
                authorError,
              );

              return {
                ...post,
                author: null,
              };
            }
          }),
        );

        if (!cancelled) {
          setItems(enriched);
        }
      } catch (loadError) {
        console.error("Failed to load archived content:", loadError);

        if (!cancelled) {
          setItems([]);
          setError(
            loadError?.code
              ? `${loadError.code}: ${loadError.message || "Unknown Firebase error"}`
              : loadError?.message || "Couldn't load your archived content.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleUnarchive(postId) {
    if (!userId || !postId || unarchivingId) {
      return;
    }

    try {
      setUnarchivingId(postId);
      await unarchivePost(postId, userId);
      setItems((current) => current.filter((item) => item.id !== postId));
    } catch (unarchiveError) {
      console.error("Failed to unarchive post:", unarchiveError);
      setError(
        unarchiveError?.message || "Couldn't unarchive this post. Please try again.",
      );
    } finally {
      setUnarchivingId("");
    }
  }

  if (loading) {
    return (
      <div className="cc-saved-state">
        <Archive size={26} />
        <strong>Loading archived content...</strong>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cc-saved-state">
        <Archive size={26} />
        <strong>{error}</strong>
        <p>Please try opening Archive again.</p>
      </div>
    );
  }

  if (!items.length) {
    return (
      <EmptySetting
        icon={Archive}
        title="Your archive"
        text="Posts and videos you archive will appear here."
      />
    );
  }

  return (
    <div className="cc-saved-content">
      <div className="cc-saved-grid">
        {items.map((item) => {
          const firstMedia = Array.isArray(item.media)
            ? item.media[0]
            : null;

          const mediaUrl =
            firstMedia?.url ||
            item.image ||
            item.mediaUrl ||
            "";

          const isVideo =
            item.postType === "reel" ||
            item.mediaType === "video" ||
            firstMedia?.type === "video" ||
            firstMedia?.mediaType === "video";

          const username =
            item.author?.username ||
            item.author?.displayName ||
            "Unknown user";

          return (
            <div
              key={item.id}
              className="cc-saved-card"
            >
              <button
                type="button"
                className="cc-saved-card-open"
                onClick={() => onOpenPost(item.id)}
                aria-label={`Open archived content by ${username}`}
              >
                <div className="cc-saved-media">
                  {mediaUrl ? (
                    isVideo ? (
                      <video
                        src={mediaUrl}
                        muted
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={mediaUrl}
                        alt=""
                        loading="lazy"
                      />
                    )
                  ) : (
                    <div className="cc-saved-no-media">
                      <Archive size={28} />
                    </div>
                  )}

                  {isVideo && (
                    <span className="cc-saved-video-badge">
                      <Video size={15} />
                    </span>
                  )}
                </div>

                <div className="cc-saved-card-info">
                  <strong>@{username}</strong>
                  {item.caption && <p>{item.caption}</p>}
                </div>
              </button>

              <button
                type="button"
                className="cc-archive-unarchive"
                onClick={() => handleUnarchive(item.id)}
                disabled={unarchivingId === item.id}
              >
                {unarchivingId === item.id ? "Unarchiving..." : "Unarchive"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SavedContent({ userId, onOpenPost }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSavedContent() {
      if (!userId) {
        setItems([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const savedPosts = await getSavedPosts(userId);

        const enriched = await Promise.all(
          savedPosts.map(async (post) => {
            if (!post.authorId) {
              return {
                ...post,
                author: null,
              };
            }

            try {
              const author = await getUserById(post.authorId);

              return {
                ...post,
                author,
              };
            } catch (authorError) {
              console.error(
                `Failed to load saved content author ${post.authorId}:`,
                authorError,
              );

              return {
                ...post,
                author: null,
              };
            }
          }),
        );

        if (!cancelled) {
          setItems(enriched);
        }
      } catch (loadError) {
        console.error("Failed to load saved content:", loadError);

        if (!cancelled) {
          setItems([]);
          setError(
            loadError?.code
              ? `${loadError.code}: ${loadError.message || "Unknown Firebase error"}`
              : loadError?.message || "Couldn't load your saved content.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadSavedContent();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className="cc-saved-state">
        <Bookmark size={26} />
        <strong>Loading saved content...</strong>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cc-saved-state">
        <Bookmark size={26} />
        <strong>{error}</strong>
        <p>Please try opening Saved again.</p>
      </div>
    );
  }

  if (!items.length) {
    return (
      <EmptySetting
        icon={Bookmark}
        title="Your saved content"
        text="Posts and videos you save will appear here."
      />
    );
  }

  return (
    <div className="cc-saved-content">
      <div className="cc-saved-grid">
        {items.map((item) => {
          const firstMedia = Array.isArray(item.media)
            ? item.media[0]
            : null;

          const mediaUrl =
            firstMedia?.url ||
            item.image ||
            item.mediaUrl ||
            "";

          const isVideo =
            item.postType === "reel" ||
            item.mediaType === "video" ||
            firstMedia?.type === "video" ||
            firstMedia?.mediaType === "video";

          const username =
            item.author?.username ||
            item.author?.displayName ||
            "Unknown user";

          return (
            <button
              key={item.id}
              type="button"
              className="cc-saved-card"
              onClick={() => onOpenPost(item.id)}
              aria-label={`Open saved content by ${username}`}
            >
              <div className="cc-saved-media">
                {mediaUrl ? (
                  isVideo ? (
                    <video
                      src={mediaUrl}
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img
                      src={mediaUrl}
                      alt=""
                      loading="lazy"
                    />
                  )
                ) : (
                  <div className="cc-saved-no-media">
                    <Bookmark size={28} />
                  </div>
                )}

                {isVideo && (
                  <span className="cc-saved-video-badge">
                    <Video size={15} />
                  </span>
                )}
              </div>

              <div className="cc-saved-card-info">
                <strong>@{username}</strong>

                {item.caption && (
                  <p>{item.caption}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetailPanel({ title, onClose, children }) {
  return (
    <>
      <div className="cc-detail-header">
        <button type="button" onClick={onClose} aria-label="Close">
          <X size={21} />
        </button>
        <h2>{title}</h2>
        <span />
      </div>

      <div className="cc-detail-body">{children}</div>
    </>
  );
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}) {
  return (
    <div className="cc-toggle-row">
      <div>
        <strong>{label}</strong>
        <p>{description}</p>
      </div>

      <button
        type="button"
        className={`cc-toggle ${checked ? "is-on" : ""}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        aria-label={label}
        aria-pressed={checked}
      >
        <span />
      </button>
    </div>
  );
}

function PermissionRow({ label, text }) {
  const Icon =
    label === "Camera"
      ? Camera
      : label === "Microphone"
        ? Mic
        : BellRing;

  return (
    <div className="cc-permission-row">
      <span className="cc-detail-icon cc-permission-icon">
        <Icon size={20} strokeWidth={1.9} />
      </span>

      <div className="cc-permission-copy">
        <strong>{label}</strong>
        <p>{text}</p>
      </div>

      <span className="cc-permission-status">Managed by device</span>
    </div>
  );
}

function ChangePasswordPanel() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!currentPassword) {
      setError("Enter your current password.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Your new password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError(
        "Your new password must be different from your current password.",
      );
      return;
    }

    try {
      setSaving(true);

      await changeUserPassword(currentPassword, newPassword);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Your password has been changed successfully.");
    } catch (changeError) {
      console.error("Failed to change password:", changeError);

      if (
        changeError?.code === "auth/invalid-credential" ||
        changeError?.code === "auth/wrong-password" ||
        changeError?.code === "auth/invalid-login-credentials"
      ) {
        setError("Your current password is incorrect.");
      } else if (changeError?.code === "auth/weak-password") {
        setError("Your new password is too weak.");
      } else if (changeError?.code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a while and try again.");
      } else if (changeError?.message === "USER_NOT_AUTHENTICATED") {
        setError("Your session has expired. Please log in again.");
      } else if (
        changeError?.message === "PASSWORD_CHANGE_NOT_AVAILABLE"
      ) {
        setError("Password changes are not available for this account.");
      } else {
        setError(
          changeError?.message ||
            "Couldn't change your password. Please try again.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  function PasswordField({
    label,
    value,
    onChange,
    visible,
    onToggle,
    autoComplete,
  }) {
    return (
      <label className="cc-password-field">
        <span>{label}</span>

        <div className="cc-password-input-wrap">
          <input
            type={visible ? "text" : "password"}
            value={value}
            onChange={onChange}
            autoComplete={autoComplete}
            disabled={saving}
          />

          <button
            type="button"
            className="cc-password-visibility"
            onClick={onToggle}
            aria-label={visible ? `Hide ${label}` : `Show ${label}`}
            disabled={saving}
          >
            {visible ? <EyeOff size={18} /> : <ScanEye size={18} />}
          </button>
        </div>
      </label>
    );
  }

  return (
    <div className="cc-password-panel">
      <div className="cc-password-intro">
        <div className="cc-password-icon">
          <ShieldCheck size={24} />
        </div>

        <div>
          <strong>Change your password</strong>
          <p>
            Use a strong password that you don't use anywhere else.
          </p>
        </div>
      </div>

      <form className="cc-password-form" onSubmit={handleSubmit}>
        <PasswordField
          label="Current password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          visible={showCurrent}
          onToggle={() => setShowCurrent((value) => !value)}
          autoComplete="current-password"
        />

        <PasswordField
          label="New password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          visible={showNew}
          onToggle={() => setShowNew((value) => !value)}
          autoComplete="new-password"
        />

        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          visible={showConfirm}
          onToggle={() => setShowConfirm((value) => !value)}
          autoComplete="new-password"
        />

        <div className="cc-password-hint">
          Your password must be at least 6 characters.
        </div>

        {error && (
          <div className="cc-password-feedback cc-password-feedback-error">
            {error}
          </div>
        )}

        {success && (
          <div className="cc-password-feedback cc-password-feedback-success">
            {success}
          </div>
        )}

        <button
          type="submit"
          className="cc-password-submit"
          disabled={
            saving ||
            !currentPassword ||
            newPassword.length < 6 ||
            !confirmPassword ||
            newPassword !== confirmPassword
          }
        >
          {saving ? "Changing password..." : "Change password"}
        </button>
      </form>
    </div>
  );
}

function EmptySetting({ icon: Icon, title, text }) {
  return (
    <div className="cc-empty-setting">
      <div className="cc-empty-setting-icon">
        <Icon size={27} />
      </div>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export default SettingsPage;
