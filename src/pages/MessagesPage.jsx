import {
  ArrowLeft,
  Ban,
  Bookmark,
  Check,
  Flag,
  Image,
  MapPin,
  MessageCircle,
  Mic,
  Paperclip,
  PenLine,
  Phone,
  Search,
  Send,
  SmilePlus,
  MoreHorizontal,
  Sparkles,
  Sticker,
  Trash2,
  Undo2,
  UserPlus,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  deleteMessageAttachment,
  uploadMessageAttachment,
} from "../services/messages/messageAttachmentService";

import { useAuth } from "../features/auth/AuthProvider";
import {
  deleteMessage,
  getOrCreateConversation,
  hideConversationForUser,
  restoreConversationForUser,
  markConversationRead,
  sendMessage,
  setMessageReaction,
  subscribeToConversations,
  subscribeToMessages,
  subscribeToReadState,
  unsendMessage,
} from "../services/messages/messageService";
import {
  blockUser,
  reportUser,
} from "../services/messages/messageModerationService";
import { grantStoryShareAccess } from "../services/stories/storyService";
import ChitChatEmojiPicker from "../components/common/ChitChatEmojiPicker";
import { getSavedPosts } from "../services/saves/saveService";
import {
  getUserById,
  searchUsersByUsername,
} from "../services/users/userService";
import {
  addCallCandidate,
  createCall,
  setCallAnswer,
  subscribeToCall,
  subscribeToCallCandidates,
  subscribeToIncomingCalls,
  updateCallStatus,
} from "../services/calls/callService";
import {
  addLocalStreamTracks,
  addRemoteCallCandidate,
  closeCallPeerConnection,
  createCallAnswer,
  createCallOffer,
  createCallPeerConnection,
  getCallMedia,
  setCallTrackEnabled,
  setRemoteCallDescription,
  stopCallMedia,
} from "../services/calls/webrtcService";

function MessagesPage() {
  const { user, profile } = useAuth();
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [conversationProfiles, setConversationProfiles] = useState({});
  const [activeConversationId, setActiveConversationId] =
    useState(conversationId || null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [userResults, setUserResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [otherUserReadState, setOtherUserReadState] = useState(null);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState(null);
  const [swipedMessageId, setSwipedMessageId] = useState(null);
  const [swipedConversationId, setSwipedConversationId] = useState(null);
  const [deletedConversation, setDeletedConversation] = useState(null);
  const [restoringConversation, setRestoringConversation] = useState(false);
  const [conversationMenuOpen, setConversationMenuOpen] = useState(false);
  const [composerToolsOpen, setComposerToolsOpen] = useState(false);
  const [composerEmojiOpen, setComposerEmojiOpen] = useState(false);
const [composerSavedOpen, setComposerSavedOpen] = useState(false);
const [savedPosts, setSavedPosts] = useState([]);
const [savedPostsLoading, setSavedPostsLoading] = useState(false);
const [savedPostsError, setSavedPostsError] = useState("");
const [selectedSavedPosts, setSelectedSavedPosts] = useState([]);
const [sharingLocation, setSharingLocation] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceRecordingSeconds, setVoiceRecordingSeconds] = useState(0);

  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callStatus, setCallStatus] = useState("idle");
  const [callError, setCallError] = useState("");
  const [localCallStream, setLocalCallStream] = useState(null);
  const [remoteCallStream, setRemoteCallStream] = useState(null);
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [isCallCameraOff, setIsCallCameraOff] = useState(false);

  const messagesEndRef = useRef(null);
  const messageSwipeRef = useRef(null);
  const conversationSwipeRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const voiceRecorderRef = useRef(null);
  const voiceStreamRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const voiceTimerRef = useRef(null);

  const callPeerConnectionRef = useRef(null);
  const callLocalStreamRef = useRef(null);
  const callRemoteStreamRef = useRef(null);
  const callCandidateQueueRef = useRef([]);
  const localCallVideoRef = useRef(null);
  const remoteCallVideoRef = useRef(null);
  const callUnsubscribersRef = useRef([]);

  useEffect(() => {
    if (!user?.uid) {
      setConversations([]);
      return undefined;
    }

    return subscribeToConversations(
      user.uid,
      setConversations,
    );
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setIncomingCall(null);
      return undefined;
    }

    return subscribeToIncomingCalls(
      user.uid,
      (calls) => {
        setIncomingCall(calls[0] || null);
      },
    );
  }, [user?.uid]);


  useEffect(() => {
    setActiveConversationId(conversationId || null);
  }, [conversationId]);

  useEffect(() => {
    if (!user?.uid) {
      setConversationProfiles({});
      return undefined;
    }

    let cancelled = false;

    async function loadConversationProfiles() {
      const otherUserIds = [
        ...new Set(
          conversations
            .map((conversation) =>
              conversation.participantIds?.find(
                (id) => id !== user.uid,
              ),
            )
            .filter(Boolean),
        ),
      ];

      if (!otherUserIds.length) {
        setConversationProfiles({});
        return;
      }

      const results = await Promise.all(
        otherUserIds.map(async (userId) => {
          try {
            const result = await getUserById(userId);
            return [userId, result];
          } catch (error) {
            console.error(
              `Failed to load conversation user ${userId}:`,
              error,
            );
            return [userId, null];
          }
        }),
      );

      if (!cancelled) {
        setConversationProfiles(
          Object.fromEntries(results),
        );
      }
    }

    loadConversationProfiles();

    return () => {
      cancelled = true;
    };
  }, [conversations, user?.uid]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return undefined;
    }

    return subscribeToMessages(
      activeConversationId,
      user.uid,
      setMessages,
    );
  }, [activeConversationId, user?.uid]);

  useEffect(() => {
    if (!activeConversationId || !user?.uid) {
      setOtherUserReadState(null);
      return undefined;
    }

    const activeConversationForReadState =
      conversations.find(
        (conversation) =>
          conversation.id === activeConversationId,
      );

    const otherUserId =
      activeConversationForReadState?.participantIds?.find(
        (id) => id !== user.uid,
      );

    if (!otherUserId) {
      setOtherUserReadState(null);
      return undefined;
    }

    return subscribeToReadState(
      activeConversationId,
      otherUserId,
      setOtherUserReadState,
    );
  }, [
    activeConversationId,
    conversations,
    user?.uid,
  ]);

  useEffect(() => {
    if (!messages.length) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);


  useEffect(() => {
    if (!activeConversationId || !user?.uid) {
      return undefined;
    }

    let cancelled = false;

    async function markActiveConversationRead() {
      try {
        await markConversationRead(
          activeConversationId,
          user.uid,
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Failed to mark conversation as read:",
            error,
          );
        }
      }
    }

    markActiveConversationRead();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId, user?.uid]);


  async function openSharedStory(message) {
  const storyId = getSharedStoryId(message);

  console.log("[SHARED STORY CLICK DEBUG]", {
    messageId: message?.id,
    messageStoryId: message?.storyId,
    resolvedStoryId: storyId,
    senderId: message?.senderId,
    attachmentUrl: message?.attachmentUrl,
    attachmentName: message?.attachmentName,
  });

  if (!storyId || !user?.uid) {
    return;
  }

  try {
    if (message.senderId !== user.uid) {
      await grantStoryShareAccess({
        storyId,
        recipientId: user.uid,
        senderId: message.senderId,
        conversationId: activeConversationId,
        messageId: message.id,
      });
    }

    navigate(
      `/?storyId=${encodeURIComponent(storyId)}`,
    );
  } catch (error) {
    console.error(
      "Could not grant shared Story access:",
      error,
    );
  }
}

function getSharedStoryId(message) {
  if (message?.storyId) {
    return message.storyId;
  }

  const attachmentUrl = message?.attachmentUrl || "";
  if (!attachmentUrl) {
    return "";
  }

  try {
    const decodedUrl = decodeURIComponent(attachmentUrl);
    const match = decodedUrl.match(
      /(?:^|\/)media\/story\/(?:image|video)\/([^/?#]+)(?:\/|$)/,
    );
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function formatMessageTime(timestamp) {
    if (!timestamp) {
      return "";
    }

    const date =
      typeof timestamp?.toDate === "function"
        ? timestamp.toDate()
        : timestamp instanceof Date
          ? timestamp
          : null;

    if (!date || Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function isMessageSeen(message) {
    if (
      !message?.senderId ||
      message.senderId !== user?.uid
    ) {
      return false;
    }

    const lastReadAt =
      otherUserReadState?.lastReadAt;

    if (!lastReadAt || !message.createdAt) {
      return false;
    }

    const readMillis =
      typeof lastReadAt?.toMillis === "function"
        ? lastReadAt.toMillis()
        : 0;

    const messageMillis =
      typeof message.createdAt?.toMillis === "function"
        ? message.createdAt.toMillis()
        : 0;

    return (
      readMillis > 0 &&
      messageMillis > 0 &&
      readMillis >= messageMillis
    );
  }

  function handleConversationPointerDown(event, conversationId) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    conversationSwipeRef.current = { conversationId, startX: event.clientX, startY: event.clientY };
  }

  function handleConversationPointerUp(event, conversationId) {
    const swipe = conversationSwipeRef.current;
    conversationSwipeRef.current = null;
    if (!swipe || swipe.conversationId !== conversationId) return;
    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    if (deltaX < -48) setSwipedConversationId(conversationId);
    else if (deltaX > 40) setSwipedConversationId(null);
  }

  async function handleDeleteConversation(conversation) {
    const otherUserId = conversation.participantIds?.find((id) => id !== user?.uid);
    const otherUser = conversationProfiles[otherUserId] || null;
    const name = otherUser?.displayName || otherUser?.username || "this conversation";
    if (!window.confirm(`Delete your conversation with ${name}? It will disappear from your Messages list, but the other person's copy will remain.`)) {
      setSwipedConversationId(null);
      return;
    }
    try {
      await hideConversationForUser(conversation.id, user.uid);
      setSwipedConversationId(null);
      setDeletedConversation({
        id: conversation.id,
        name,
      });
      if (activeConversationId === conversation.id) {
        setActiveConversationId(null);
        navigate("/messages");
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      window.alert("Couldn't delete this conversation. Please try again.");
    }
  }

  async function handleUndoDeleteConversation() {
    if (!deletedConversation || restoringConversation || !user?.uid) return;
    setRestoringConversation(true);
    try {
      await restoreConversationForUser(deletedConversation.id, user.uid);
      setDeletedConversation(null);
    } catch (error) {
      console.error("Failed to restore conversation:", error);
      window.alert("Couldn't restore this conversation. Please try again.");
    } finally {
      setRestoringConversation(false);
    }
  }

  const filteredConversations = useMemo(() => {
    const value = search.trim().toLowerCase();

    const visibleConversations = conversations.filter(
      (conversation) => !conversation.hiddenFor?.includes(user?.uid),
    );
    if (!value || showNewMessage) return visibleConversations;
    return visibleConversations.filter((conversation) => {
      const otherUserId =
        conversation.participantIds?.find(
          (id) => id !== user?.uid,
        );

      const otherUser =
        conversationProfiles[otherUserId] || null;

      const lastMessage =
        conversation.lastMessage?.toLowerCase() || "";

      const username =
        otherUser?.username?.toLowerCase() || "";

      const displayName =
        otherUser?.displayName?.toLowerCase() || "";

      return (
        lastMessage.includes(value) ||
        username.includes(value) ||
        displayName.includes(value)
      );
    });
  }, [
    conversations,
    conversationProfiles,
    search,
    showNewMessage,
    user?.uid,
  ]);

  async function startVoiceRecording() {
    if (
      !user?.uid ||
      !activeConversationId ||
      sending ||
      isRecordingVoice
    ) {
      return;
    }

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      console.error(
        "Voice recording is not supported in this browser.",
      );
      return;
    }

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      const supportedMimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ];

      const mimeType =
        supportedMimeTypes.find((type) =>
          MediaRecorder.isTypeSupported(type),
        ) || "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      voiceStreamRef.current = stream;
      voiceRecorderRef.current = recorder;
      voiceChunksRef.current = [];
      setVoiceRecordingSeconds(0);
      setIsRecordingVoice(true);

      voiceTimerRef.current = window.setInterval(() => {
        setVoiceRecordingSeconds(
          (current) => current + 1,
        );
      }, 1000);

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          voiceChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error(
          "Voice recorder error:",
          event.error,
        );
      };

      recorder.onstop = async () => {
        const chunks = voiceChunksRef.current;

        const actualMimeType =
          recorder.mimeType ||
          mimeType ||
          "audio/webm";

        const extension = actualMimeType.includes("mp4")
          ? "m4a"
          : "webm";

        const blob = new Blob(chunks, {
          type: actualMimeType,
        });

        if (!blob.size) {
          console.error("Voice recording was empty.");
          return;
        }

        const voiceFile = new File(
          [blob],
          `voice-message-${Date.now()}.${extension}`,
          {
            type: actualMimeType,
          },
        );

        let uploadedAttachment = null;

        try {
          setSending(true);

          uploadedAttachment =
            await uploadMessageAttachment({
              conversationId: activeConversationId,
              userId: user.uid,
              file: voiceFile,
            });

          await sendMessage({
            conversationId: activeConversationId,
            senderId: user.uid,
            text: "",
            attachment: uploadedAttachment,
          });
        } catch (error) {
          console.error(
            "Failed to send voice message:",
            error,
          );

          if (uploadedAttachment) {
            try {
              await deleteMessageAttachment(
                uploadedAttachment,
              );
            } catch (cleanupError) {
              console.error(
                "Failed to clean up voice attachment:",
                cleanupError,
              );
            }
          }
        } finally {
          setSending(false);
          voiceChunksRef.current = [];
          voiceRecorderRef.current = null;
        }
      };

      recorder.start();
    } catch (error) {
      console.error(
        "Failed to start voice recording:",
        error,
      );

      voiceStreamRef.current?.getTracks().forEach(
        (track) => track.stop(),
      );

      voiceStreamRef.current = null;
      voiceRecorderRef.current = null;
      voiceChunksRef.current = [];

      if (voiceTimerRef.current) {
        window.clearInterval(voiceTimerRef.current);
        voiceTimerRef.current = null;
      }

      setIsRecordingVoice(false);
      setVoiceRecordingSeconds(0);
    }
  }

  function stopVoiceRecording() {
    const recorder = voiceRecorderRef.current;

    if (!recorder) {
      return;
    }

    if (
      recorder.state === "recording" ||
      recorder.state === "paused"
    ) {
      recorder.stop();
    }

    voiceStreamRef.current?.getTracks().forEach(
      (track) => track.stop(),
    );

    voiceStreamRef.current = null;

    if (voiceTimerRef.current) {
      window.clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }

    setIsRecordingVoice(false);
    setVoiceRecordingSeconds(0);
  }

  function toggleVoiceRecording() {
    if (isRecordingVoice) {
      stopVoiceRecording();
      return;
    }

    void startVoiceRecording();
  }

  async function handleSendMessage(event) {
    event.preventDefault();

    if (
      !user?.uid ||
      !activeConversationId ||
      (!text.trim() && !selectedFile) ||
      sending
    ) {
      return;
    }

    let uploadedAttachment = null;

    try {
      setSending(true);

      if (selectedFile) {
        uploadedAttachment = await uploadMessageAttachment({
          conversationId: activeConversationId,
          userId: user.uid,
          file: selectedFile,
        });
      }

      await sendMessage({
        conversationId: activeConversationId,
        senderId: user.uid,
        text: text.trim(),
        attachment: uploadedAttachment,
      });

      setText("");
      setSelectedFile(null);

      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Failed to send message:", error);

      if (uploadedAttachment) {
        try {
          await deleteMessageAttachment(uploadedAttachment);
        } catch (cleanupError) {
          console.error(
            "Failed to clean up uploaded message attachment:",
            cleanupError,
          );
        }
      }
    } finally {
      setSending(false);
    }
  }

  
async function openSavedComposer() {
    setComposerEmojiOpen(false);
    setSavedPostsError("");
    setSelectedSavedPosts([]);
    setComposerSavedOpen(true);

    if (savedPosts.length > 0 || savedPostsLoading) {
      return;
    }

    if (!user?.uid) {
      setSavedPostsError("You need to be signed in to use Saved.");
      return;
    }

    try {
      setSavedPostsLoading(true);
      const posts = await getSavedPosts(user.uid);
      setSavedPosts(posts);
    } catch (error) {
      console.error("Failed to load saved posts:", error);
      setSavedPostsError("Couldn't load your saved posts.");
    } finally {
      setSavedPostsLoading(false);
    }
  }

  function toggleSavedPostSelection(post) {
    if (!post?.id || sending) {
      return;
    }

    setSelectedSavedPosts((current) => {
      const alreadySelected = current.some(
        (item) => item.id === post.id,
      );

      if (alreadySelected) {
        return current.filter((item) => item.id !== post.id);
      }

      return [...current, post];
    });
  }

  async function handleSendSavedPosts() {
    if (
      !user?.uid ||
      !activeConversationId ||
      selectedSavedPosts.length === 0 ||
      sending
    ) {
      return;
    }

    try {
      setSending(true);
      setSavedPostsError("");

      for (const post of selectedSavedPosts) {
        const firstMedia = Array.isArray(post.media)
          ? post.media.find(
              (item) =>
                item?.url ||
                item?.downloadURL ||
                item?.src,
            )
          : null;

        const mediaUrl =
          firstMedia?.url ||
          firstMedia?.downloadURL ||
          firstMedia?.src ||
          post.image ||
          "";

        const mediaType =
          firstMedia?.type ||
          firstMedia?.mediaType ||
          (firstMedia?.resourceType === "video"
            ? "video"
            : "image");

        await sendMessage({
          conversationId: activeConversationId,
          senderId: user.uid,
          text: "",
          sharedContent: {
            type: "post",
            id: post.id,
            ...(mediaUrl ? { mediaUrl } : {}),
            ...(mediaType ? { mediaType } : {}),
            ...(post.authorId ? { authorId: post.authorId } : {}),
            ...(post.caption ? { caption: post.caption } : {}),
          },
        });
      }

      setSelectedSavedPosts([]);
      setComposerSavedOpen(false);
      setComposerToolsOpen(false);
    } catch (error) {
      console.error("Failed to share saved posts:", error);
      setSavedPostsError(
        "Couldn't share the selected posts. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }

  async function handleShareLocation() {
    if (
      !user?.uid ||
      !activeConversationId ||
      sending ||
      sharingLocation
    ) {
      return;
    }

    if (!navigator.geolocation) {
      window.alert(
        "Location sharing is not supported by this browser.",
      );
      return;
    }

    setSharingLocation(true);
    setSavedPostsError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        try {
          await sendMessage({
            conversationId: activeConversationId,
            senderId: user.uid,
            text: "",
            sharedContent: {
              type: "location",
              id: "current-location",
              latitude,
              longitude,
            },
          });

          setComposerToolsOpen(false);
        } catch (error) {
          console.error(
            "Failed to share location:",
            error,
          );

          window.alert(
            "Couldn't share your location. Please try again.",
          );
        } finally {
          setSharingLocation(false);
        }
      },
      (error) => {
        console.error(
          "Location permission/error:",
          error,
        );

        if (error.code === 1) {
          window.alert(
            "Location permission was denied. Please allow location access and try again.",
          );
        } else {
          window.alert(
            "Couldn't get your current location. Please try again.",
          );
        }

        setSharingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      },
    );
  }

  function handleAttachmentChange(event) {
    const file = event.target.files?.[0] || null;

    if (!file) {
      return;
    }

    setSelectedFile(file);
  }

  function clearSelectedFile() {
    setSelectedFile(null);

    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  }

  async function handleMessageReaction(message, reaction) {
    if (!user?.uid || !activeConversationId || !message?.id) {
      return;
    }

    const currentReaction =
      message.reactions?.[user.uid] || "";

    try {
      await setMessageReaction({
        conversationId: activeConversationId,
        messageId: message.id,
        userId: user.uid,
        reaction:
          currentReaction === reaction ? "" : reaction,
      });

      setReactionPickerMessageId(null);
    } catch (error) {
      console.error(
        "Failed to update message reaction:",
        error,
      );
    }
  }


  async function handleReportUser() {
    const reportedUserId =
      activeConversation?.participantIds?.find(
        (id) => id !== user?.uid,
      );

    if (
      !user?.uid ||
      !reportedUserId ||
      reportedUserId === user.uid ||
      !activeConversationId
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Report this user to Chit Chat moderation?",
    );

    if (!confirmed) {
      return;
    }

    try {
      await reportUser({
        reporterId: user.uid,
        reportedUserId,
        conversationId: activeConversationId,
        reason: "inappropriate",
      });

      setConversationMenuOpen(false);
      window.alert(
        "Thanks. Your report has been submitted.",
      );
    } catch (error) {
      console.error(
        "Failed to report user:",
        error,
      );
      window.alert(
        "Could not submit the report. Please try again.",
      );
    }
  }

  async function handleBlockActiveUser() {
    const blockedUserId =
      activeConversation?.participantIds?.find(
        (id) => id !== user?.uid,
      );

    if (
      !user?.uid ||
      !blockedUserId ||
      blockedUserId === user.uid
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Block this user? They will no longer be able to message you.",
    );

    if (!confirmed) {
      return;
    }

    try {
      await blockUser(
        user.uid,
        blockedUserId,
      );

      setConversationMenuOpen(false);
      window.alert(
        "User blocked successfully.",
      );
    } catch (error) {
      console.error(
        "Failed to block user:",
        error,
      );
      window.alert(
        "Could not block this user. Please try again.",
      );
    }
  }

  function handleMessageSwipeStart(event, message) {
    if (
      event.target?.closest?.(".message-swipe-action") ||
      message?.senderId !== user?.uid ||
      message?.isDeleted === true
    ) {
      return;
    }

    const point =
      event.pointerType !== undefined
        ? event
        : event.touches?.[0];

    if (!point) {
      return;
    }

    if (event.pointerType !== undefined && event.button !== 0) {
      return;
    }

    if (
      event.currentTarget?.setPointerCapture &&
      event.pointerId !== undefined
    ) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort.
      }
    }

    messageSwipeRef.current = {
      messageId: message.id,
      startX: point.clientX,
      startY: point.clientY,
      currentOffset: swipedMessageId === message.id ? -112 : 0,
      tracking: true,
    };
  }

  function handleMessageSwipeMove(event, message) {
    const swipe = messageSwipeRef.current;

    if (
      !swipe?.tracking ||
      swipe.messageId !== message.id
    ) {
      return;
    }

    const point =
      event.pointerType !== undefined
        ? event
        : event.touches?.[0];

    if (!point) {
      return;
    }

    const deltaX = point.clientX - swipe.startX;
    const deltaY = point.clientY - swipe.startY;

    if (Math.abs(deltaY) > Math.abs(deltaX) + 8) {
      swipe.tracking = false;
      return;
    }

    if (deltaX < 0) {
      event.preventDefault();

      const offset = Math.max(
        -112,
        Math.min(0, deltaX),
      );

      swipe.currentOffset = offset;

      const content = event.currentTarget.querySelector(
        ".message-swipe-content",
      );

      if (content) {
        content.style.transform = `translateX(${offset}px)`;
      }
    }
  }

  function handleMessageSwipeEnd(message) {
    const swipe = messageSwipeRef.current;

    if (
      !swipe ||
      swipe.messageId !== message.id
    ) {
      return;
    }

    const content = document.querySelector(
      `[data-message-swipe-id="${message.id}"] .message-swipe-content`,
    );

    if (swipe.currentOffset <= -56) {
      setSwipedMessageId(message.id);

      if (content) {
        content.style.transform = "translateX(-112px)";
      }
    } else {
      setSwipedMessageId(null);

      if (content) {
        content.style.transform = "translateX(0)";
      }
    }

    messageSwipeRef.current = null;
  }

  function handleCloseMessageSwipe() {
    setSwipedMessageId(null);
  }

  async function handleDeleteMessage(message) {
    if (
      !user?.uid ||
      !activeConversationId ||
      !message?.id ||
      message.senderId !== user.uid
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this message? This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteMessage(
        activeConversationId,
        message.id,
        user.uid,
      );

      setReactionPickerMessageId(null);
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  }

  async function handleUnsendMessage(message) {
    if (
      !user?.uid ||
      !activeConversationId ||
      !message?.id ||
      message.senderId !== user.uid
    ) {
      return;
    }

    const confirmed = window.confirm(
      "Unsend this message for everyone?",
    );

    if (!confirmed) {
      return;
    }

    try {
      await unsendMessage(
        activeConversationId,
        message.id,
        user.uid,
      );

      setReactionPickerMessageId(null);
    } catch (error) {
      console.error(
        "Failed to unsend message:",
        error,
      );
    }
  }

  async function handleUserSearch(value) {
    setSearch(value);

    const trimmed = value.trim();

    if (!trimmed) {
      setUserResults([]);
      return;
    }

    try {
      setSearchingUsers(true);
      const results = await searchUsersByUsername(trimmed);

      setUserResults(
        results.filter((result) => result.id !== user?.uid),
      );
    } catch (error) {
      console.error("User search failed:", error);
      setUserResults([]);
    } finally {
      setSearchingUsers(false);
    }
  }

  async function handleStartConversation(otherUser) {
    if (!user?.uid || !otherUser?.id) {
      return;
    }

    try {
      const conversation =
        await getOrCreateConversation(
          user.uid,
          otherUser.id,
        );

      setActiveConversationId(conversation.id);
      navigate(`/messages/${conversation.id}`);
      setShowNewMessage(false);
      setSearch("");
      setUserResults([]);
    } catch (error) {
      console.error(
        "Failed to create conversation:",
        error,
      );
    }
  }

  function clearCallSubscriptions() {
    callUnsubscribersRef.current.forEach((unsubscribe) => {
      try {
        unsubscribe?.();
      } catch (error) {
        console.error(
          "Failed to unsubscribe from call:",
          error,
        );
      }
    });

    callUnsubscribersRef.current = [];
  }

  function cleanupActiveCall() {
    clearCallSubscriptions();

    stopCallMedia(callLocalStreamRef.current);
    closeCallPeerConnection(
      callPeerConnectionRef.current,
    );

    callLocalStreamRef.current = null;
    callRemoteStreamRef.current = null;
    callPeerConnectionRef.current = null;
    callCandidateQueueRef.current = [];

    setLocalCallStream(null);
    setRemoteCallStream(null);
    setActiveCall(null);
    setCallStatus("idle");
    setIsCallMuted(false);
    setIsCallCameraOff(false);
  }

  async function flushCallCandidateQueue() {
    const peerConnection =
      callPeerConnectionRef.current;

    if (!peerConnection?.remoteDescription) {
      return;
    }

    const queuedCandidates =
      callCandidateQueueRef.current;

    callCandidateQueueRef.current = [];

    for (const candidate of queuedCandidates) {
      try {
        await addRemoteCallCandidate(
          peerConnection,
          candidate,
        );
      } catch (error) {
        console.error(
          "Failed to add queued ICE candidate:",
          error,
        );
      }
    }
  }

  function subscribeToActiveCall(callId) {
    if (!callId) {
      return;
    }

    const unsubscribe = subscribeToCall(
      callId,
      async (call) => {
        if (!call) {
          cleanupActiveCall();
          return;
        }

        setActiveCall(call);

        if (
          call.status === "ended" ||
          call.status === "declined" ||
          call.status === "missed"
        ) {
          cleanupActiveCall();
          return;
        }

        if (
          call.answer &&
          call.callerId === user?.uid &&
          callPeerConnectionRef.current &&
          !callPeerConnectionRef.current
            .currentRemoteDescription
        ) {
          try {
            await setRemoteCallDescription(
              callPeerConnectionRef.current,
              call.answer,
            );

            await flushCallCandidateQueue();
          } catch (error) {
            console.error(
              "Failed to apply call answer:",
              error,
            );

            setCallError(
              "Could not connect the call.",
            );
          }
        }

        if (call.status === "active") {
          setCallStatus("connected");
        } else if (call.status === "ringing") {
          setCallStatus(
            call.callerId === user?.uid
              ? "calling"
              : "ringing",
          );
        }
      },
    );

    callUnsubscribersRef.current.push(
      unsubscribe,
    );
  }

  function subscribeToRemoteCandidates(
    callId,
    role,
  ) {
    const unsubscribe =
      subscribeToCallCandidates(
        callId,
        role,
        async (candidates) => {
          const peerConnection =
            callPeerConnectionRef.current;

          if (!peerConnection) {
            return;
          }

          for (const candidate of candidates) {
            if (!peerConnection.remoteDescription) {
              callCandidateQueueRef.current.push(
                candidate,
              );
              continue;
            }

            try {
              await addRemoteCallCandidate(
                peerConnection,
                candidate,
              );
            } catch (error) {
              console.error(
                "Failed to add ICE candidate:",
                error,
              );
            }
          }
        },
      );

    callUnsubscribersRef.current.push(
      unsubscribe,
    );
  }

  async function startCall(callType) {
    if (
      !user?.uid ||
      !activeConversationId ||
      !activeConversation
    ) {
      return;
    }

    if (
      callType !== "audio" &&
      callType !== "video"
    ) {
      return;
    }

    if (
      callStatus !== "idle" ||
      incomingCall ||
      callPeerConnectionRef.current
    ) {
      return;
    }

    const otherUserId =
      activeConversation.participantIds?.find(
        (id) => id !== user.uid,
      );

    if (!otherUserId) {
      setCallError(
        "The other participant could not be found.",
      );
      return;
    }

    try {
      setCallError("");
      setCallStatus("starting");

      const localStream =
        await getCallMedia(callType);

      callLocalStreamRef.current = localStream;
      setLocalCallStream(localStream);

      const peerConnection =
        createCallPeerConnection({
          onIceCandidate: async (candidate) => {
            const peerConnection =
              callPeerConnectionRef.current;

            if (!peerConnection) {
              return;
            }

            const currentCallId =
              peerConnection.__chitChatCallId;

            if (!currentCallId) {
              peerConnection.__chitChatPendingCandidates =
                peerConnection.__chitChatPendingCandidates ||
                [];

              peerConnection.__chitChatPendingCandidates.push(
                candidate,
              );

              return;
            }

            try {
              await addCallCandidate(
                currentCallId,
                "offer",
                candidate,
              );
            } catch (error) {
              console.error(
                "Failed to send caller ICE candidate:",
                error,
              );
            }
          },
          onTrack: (stream) => {
            callRemoteStreamRef.current =
              stream;
            setRemoteCallStream(stream);
          },
          onConnectionStateChange: (state) => {
            if (state === "connected") {
              setCallStatus("connected");
            }

            if (
              state === "failed" ||
              state === "disconnected" ||
              state === "closed"
            ) {
              setCallStatus("ended");
            }
          },
        });

      callPeerConnectionRef.current =
        peerConnection;

      addLocalStreamTracks(
        peerConnection,
        localStream,
      );

      const offer =
        await createCallOffer(
          peerConnection,
        );

      const callId = await createCall({
        conversationId: activeConversationId,
        callerId: user.uid,
        calleeId: otherUserId,
        type: callType,
        offer,
      });

      peerConnection.__chitChatCallId =
        callId;

      const pendingCandidates =
        peerConnection.__chitChatPendingCandidates ||
        [];

      peerConnection.__chitChatPendingCandidates =
        [];

      for (const candidate of pendingCandidates) {
        try {
          await addCallCandidate(
            callId,
            "offer",
            candidate,
          );
        } catch (error) {
          console.error(
            "Failed to send pending caller ICE candidate:",
            error,
          );
        }
      }

      setActiveCall({
        id: callId,
        conversationId:
          activeConversationId,
        callerId: user.uid,
        calleeId: otherUserId,
        type: callType,
        status: "ringing",
        offer,
      });

      setCallStatus("calling");

      subscribeToActiveCall(callId);
      subscribeToRemoteCandidates(
        callId,
        "answer",
      );
    } catch (error) {
      console.error(
        "Failed to start call:",
        error,
      );

      let message =
        "Could not start the call.";

      if (error?.name === "NotAllowedError") {
        message =
          callType === "video"
            ? "Camera or microphone permission was denied. Allow access for localhost and try again."
            : "Microphone permission was denied. Allow microphone access for localhost and try again.";
      } else if (error?.name === "NotFoundError") {
        message =
          callType === "video"
            ? "No camera or microphone was found."
            : "No microphone was found.";
      } else if (error?.name === "NotReadableError") {
        message =
          callType === "video"
            ? "The camera or microphone is already being used by another app."
            : "The microphone is already being used by another app.";
      } else if (error?.name === "SecurityError") {
        message =
          "The browser blocked access to the microphone or camera.";
      } else if (
        error?.code === "permission-denied" ||
        error?.code === "PERMISSION_DENIED"
      ) {
        message =
          "Firebase permission was denied while starting the call.";
      } else if (error?.message) {
        message = error.message;
      }

      setCallError(message);

      cleanupActiveCall();
    }
  }

  async function acceptIncomingCall() {
    const call = incomingCall;

    if (
      !call?.id ||
      !user?.uid ||
      call.calleeId !== user.uid
    ) {
      return;
    }

    if (callPeerConnectionRef.current) {
      return;
    }

    try {
      setCallError("");
      setCallStatus("connecting");
      setIncomingCall(null);

      const localStream =
        await getCallMedia(call.type);

      callLocalStreamRef.current = localStream;
      setLocalCallStream(localStream);

      const peerConnection =
        createCallPeerConnection({
          onIceCandidate: async (candidate) => {
            try {
              await addCallCandidate(
                call.id,
                "answer",
                candidate,
              );
            } catch (error) {
              console.error(
                "Failed to send callee ICE candidate:",
                error,
              );
            }
          },
          onTrack: (stream) => {
            callRemoteStreamRef.current =
              stream;
            setRemoteCallStream(stream);
          },
          onConnectionStateChange: (state) => {
            if (state === "connected") {
              setCallStatus("connected");
            }

            if (
              state === "failed" ||
              state === "disconnected" ||
              state === "closed"
            ) {
              setCallStatus("ended");
            }
          },
        });

      callPeerConnectionRef.current =
        peerConnection;

      addLocalStreamTracks(
        peerConnection,
        localStream,
      );

      await setRemoteCallDescription(
        peerConnection,
        call.offer,
      );

      await flushCallCandidateQueue();

      subscribeToActiveCall(call.id);
      subscribeToRemoteCandidates(
        call.id,
        "offer",
      );

      const answer =
        await createCallAnswer(
          peerConnection,
        );

      await setCallAnswer(
        call.id,
        answer,
      );

      setActiveCall({
        ...call,
        answer,
        status: "active",
      });

      setCallStatus("connecting");
    } catch (error) {
      console.error(
        "Failed to accept call:",
        error,
      );

      setCallError(
        "Could not connect the call. Please check microphone/camera permissions.",
      );

      try {
        await updateCallStatus(
          call.id,
          "ended",
        );
      } catch (statusError) {
        console.error(
          "Failed to end failed call:",
          statusError,
        );
      }

      cleanupActiveCall();
    }
  }

  async function declineIncomingCall() {
    const call = incomingCall;

    if (!call?.id) {
      return;
    }

    try {
      await updateCallStatus(
        call.id,
        "declined",
      );
    } catch (error) {
      console.error(
        "Failed to decline call:",
        error,
      );
    } finally {
      setIncomingCall(null);
    }
  }

  async function endActiveCall() {
    const callId = activeCall?.id;

    if (callId) {
      try {
        await updateCallStatus(
          callId,
          "ended",
        );
      } catch (error) {
        console.error(
          "Failed to end call:",
          error,
        );
      }
    }

    cleanupActiveCall();
  }

  function toggleCallMute() {
    const nextMuted = !isCallMuted;

    setCallTrackEnabled(
      callLocalStreamRef.current,
      "audio",
      !nextMuted,
    );

    setIsCallMuted(nextMuted);
  }

  function toggleCallCamera() {
    const nextCameraOff =
      !isCallCameraOff;

    setCallTrackEnabled(
      callLocalStreamRef.current,
      "video",
      !nextCameraOff,
    );

    setIsCallCameraOff(nextCameraOff);
  }

  useEffect(() => {
    if (localCallVideoRef.current) {
      localCallVideoRef.current.srcObject =
        localCallStream || null;
    }

    if (remoteCallVideoRef.current) {
      remoteCallVideoRef.current.srcObject =
        remoteCallStream || null;
    }
  }, [localCallStream, remoteCallStream]);

  useEffect(() => {
    return () => {
      clearCallSubscriptions();

      stopCallMedia(
        callLocalStreamRef.current,
      );

      closeCallPeerConnection(
        callPeerConnectionRef.current,
      );

      callLocalStreamRef.current = null;
      callRemoteStreamRef.current = null;
      callPeerConnectionRef.current = null;
    };
  }, []);

  const activeConversation =
    conversations.find(
      (conversation) =>
        conversation.id === activeConversationId,
    );

  return (
    <main className="messages-page">
      {deletedConversation && (
        <div className="cc-conversation-undo-toast" role="status" aria-live="polite">
          <span>Conversation with {deletedConversation.name} deleted</span>
          <button
            type="button"
            onClick={() => void handleUndoDeleteConversation()}
            disabled={restoringConversation}
          >
            {restoringConversation ? "Restoring…" : "Undo"}
          </button>
          <button
            type="button"
            className="cc-conversation-undo-dismiss"
            aria-label="Dismiss notification"
            onClick={() => setDeletedConversation(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <section className={`messages-shell ${activeConversationId ? "chat-open" : ""}`}>
        <aside className="messages-sidebar">
          <div className="messages-sidebar-header">
            <div>
              <h1>Messages</h1>
              <span>
                {profile?.username || user?.email}
              </span>
            </div>

        

        

        
          </div>

          <div className="messages-search">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => {
                const value = event.target.value;

                if (showNewMessage) {
                  handleUserSearch(value);
                } else {
                  setSearch(value);
                }
              }}
              placeholder={
                showNewMessage
                  ? "Search people..."
                  : "Search conversations"
              }
              aria-label={
                showNewMessage
                  ? "Search people"
                  : "Search conversations"
              }
            />
            {showNewMessage && search && (
              <button
                type="button"
                className="messages-search-clear"
                onClick={() => {
                  setSearch("");
                  setUserResults([]);
                }}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {showNewMessage && (
            <div className="messages-new-message-panel">
              <div className="messages-new-message-title">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewMessage(false);
                    setSearch("");
                    setUserResults([]);
                  }}
                  aria-label="Close new message"
                >
                  <ArrowLeft size={18} />
                </button>

                <strong>New message</strong>
              </div>

              {searchingUsers ? (
                <div className="messages-user-state">
                  Searching...
                </div>
              ) : search.trim() && userResults.length === 0 ? (
                <div className="messages-user-state">
                  No users found.
                </div>
              ) : (
                <div className="messages-user-results">
                  {userResults.map((result) => (
                    <button
                      type="button"
                      key={result.id}
                      className="messages-user-result"
                      onClick={() =>
                        handleStartConversation(result)
                      }
                    >
                      <div className="message-avatar">
                        {result.photoURL ? (
                          <img
                            src={result.photoURL}
                            alt=""
                          />
                        ) : (
                          result.username
                            ?.slice(0, 1)
                            .toUpperCase()
                        )}
                      </div>

                      <div>
                        <strong>
                          {result.username}
                        </strong>
                        <span>
                          {result.displayName}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="messages-conversations">
            {filteredConversations.length === 0 ? (
              <div className="messages-no-conversations">
                <MessageCircle size={30} />
                <strong>No messages yet</strong>
                <span>
                  Start a conversation to see it here.
                </span>
              </div>
            ) : (
              filteredConversations.map(
                (conversation) => {
                  const otherUserId =
                    conversation.participantIds?.find(
                      (id) => id !== user?.uid,
                    );

                  const otherUser =
                    conversationProfiles[otherUserId] || null;
                  const unreadCount = Number(
                    conversation.unreadCounts?.[user?.uid] || 0,
                  );

                  return (
                    <div
                      key={conversation.id}
                      className={`message-conversation-swipe-shell ${swipedConversationId === conversation.id ? "is-swiped" : ""}`}
                      onPointerDown={(event) => handleConversationPointerDown(event, conversation.id)}
                      onPointerUp={(event) => handleConversationPointerUp(event, conversation.id)}
                      onPointerCancel={() => { conversationSwipeRef.current = null; }}
                    >
                      <button type="button" className="message-conversation-delete" onClick={() => void handleDeleteConversation(conversation)} aria-label="Delete conversation" title="Delete conversation">
                        <Trash2 size={19} strokeWidth={2.2} />
                        <span>Delete</span>
                      </button>
                    <button
                      type="button"
                      className={`message-conversation ${
                        activeConversationId ===
                        conversation.id
                          ? "active"
                          : ""
                      }`}
                      onClick={() => {
                        if (swipedConversationId === conversation.id) { setSwipedConversationId(null); return; }
                        setActiveConversationId(conversation.id);
                        navigate(`/messages/${conversation.id}`);
                      }}
                    >
                      <div className="message-avatar">
                        {otherUser?.photoURL ? (
                          <img
                            src={otherUser.photoURL}
                            alt=""
                          />
                        ) : (
                          otherUser?.displayName
                            ?.slice(0, 1)
                            .toUpperCase() ||
                          otherUser?.username
                            ?.slice(0, 1)
                            .toUpperCase() ||
                          "?"
                        )}
                      </div>

                      <div className="message-conversation-info">
                        <strong>
                          {otherUser?.displayName ||
                            otherUser?.username ||
                            otherUserId ||
                            "User"}
                        </strong>
                        <span>
                          {conversation.lastMessage ||
                            "Start chatting"}
                        </span>
                      </div>
                      {unreadCount > 0 && (
                        <span
                          className="message-unread-badge"
                          aria-label={`${unreadCount} unread messages`}
                        >
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </button>
                    </div>
                  );
                },
              )
            )}
          </div>
        </aside>

        <section className="messages-chat">
          {!activeConversation ? (
            <div className="messages-welcome">
              <div className="messages-welcome-icon">
                <MessageCircle size={34} />
              </div>

              <h2>Your messages</h2>

              <p>
                Send private messages to people on
                Chit Chat.
              </p>

              <button
                type="button"
                onClick={() => {
                  setShowNewMessage(true);
                }}
              >
                Send message
              </button>
            </div>
          ) : (
            <>
              <header className="messages-chat-header">
                <button
                  type="button"
                  className="messages-mobile-back"
                  onClick={() => navigate("/messages")}
                  aria-label="Back to messages"
                >
                  <ArrowLeft size={20} />
                </button>
                {(() => {
                  const activeOtherUserId =
                    activeConversation.participantIds?.find(
                      (id) => id !== user?.uid,
                    );

                  const activeOtherUser =
                    conversationProfiles[activeOtherUserId] || null;

                  return (
                    <>
                      <div className="message-avatar">
                        {activeOtherUser?.photoURL ? (
                          <img
                            src={activeOtherUser.photoURL}
                            alt=""
                          />
                        ) : (
                          activeOtherUser?.displayName
                            ?.slice(0, 1)
                            .toUpperCase() ||
                          activeOtherUser?.username
                            ?.slice(0, 1)
                            .toUpperCase() ||
                          "?"
                        )}
                      </div>

                      <div>
                        <strong>
                          {activeOtherUser?.displayName ||
                            activeOtherUser?.username ||
                            activeOtherUserId ||
                            "User"}
                        </strong>

                        <span>
                          {activeOtherUser?.username
                            ? `@${activeOtherUser.username}`
                            : "Chit Chat user"}
                        </span>
                      </div>
                    </>
                  );
                })()}
                <div className="messages-call-actions">
                  <button
                    type="button"
                    className="messages-call-action"
                    onClick={() => void startCall("audio")}
                    disabled={
                      callStatus !== "idle" ||
                      Boolean(incomingCall)
                    }
                    aria-label="Start voice call"
                    title="Voice call"
                  >
                    <Phone size={19} />
                  </button>

                  <button
                    type="button"
                    className="messages-call-action"
                    onClick={() => void startCall("video")}
                    disabled={
                      callStatus !== "idle" ||
                      Boolean(incomingCall)
                    }
                    aria-label="Start video call"
                    title="Video call"
                  >
                    <Video size={20} />
                  </button>

                  <div className="messages-conversation-menu">
                    <button
                      type="button"
                      className="messages-call-action messages-conversation-menu-trigger"
                      onClick={() => {
                        setConversationMenuOpen(
                          (current) => !current,
                        );
                      }}
                      aria-label="Conversation options"
                      title="Conversation options"
                      aria-expanded={conversationMenuOpen}
                      aria-haspopup="menu"
                    >
                      <MoreHorizontal size={20} />
                    </button>

                    {conversationMenuOpen && (
                      <div
                        className="messages-conversation-menu-panel"
                        role="menu"
                      >
                        <button
                          type="button"
                          className="messages-conversation-menu-item"
                          onClick={() => {
                            void handleReportUser();
                          }}
                          role="menuitem"
                        >
                          <Flag size={17} />
                          <span>Report user</span>
                        </button>

                        <button
                          type="button"
                          className="messages-conversation-menu-item danger"
                          onClick={() => {
                            void handleBlockActiveUser();
                          }}
                          role="menuitem"
                        >
                          <Ban size={17} />
                          <span>Block user</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </header>

              <div className="messages-call-layer">
                {incomingCall && (
                  <div className="messages-incoming-call">
                    <div className="messages-incoming-call-avatar">
                      {conversationProfiles[
                        incomingCall.callerId
                      ]?.photoURL ? (
                        <img
                          src={
                            conversationProfiles[
                              incomingCall.callerId
                            ].photoURL
                          }
                          alt=""
                        />
                      ) : (
                        (
                          conversationProfiles[
                            incomingCall.callerId
                          ]?.displayName ||
                          conversationProfiles[
                            incomingCall.callerId
                          ]?.username ||
                          "?"
                        )
                          .slice(0, 1)
                          .toUpperCase()
                      )}
                    </div>

                    <div className="messages-incoming-call-copy">
                      <span>Incoming {incomingCall.type === "video" ? "video" : "voice"} call</span>
                      <strong>
                        {conversationProfiles[
                          incomingCall.callerId
                        ]?.displayName ||
                          conversationProfiles[
                            incomingCall.callerId
                          ]?.username ||
                          "Chit Chat user"}
                      </strong>
                    </div>

                    <div className="messages-incoming-call-actions">
                      <button
                        type="button"
                        className="messages-call-control messages-call-control-danger"
                        onClick={() =>
                          void declineIncomingCall()
                        }
                        aria-label="Decline call"
                        title="Decline"
                      >
                        <X size={19} />
                      </button>

                      <button
                        type="button"
                        className="messages-call-control messages-call-control-accept"
                        onClick={() =>
                          void acceptIncomingCall()
                        }
                        aria-label="Accept call"
                        title="Accept"
                      >
                        {incomingCall.type === "video" ? (
                          <Video size={19} />
                        ) : (
                          <Phone size={19} />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {activeCall && callStatus !== "idle" && (
                  <div
                    className={`messages-active-call ${
                      activeCall.type === "video"
                        ? "video"
                        : "audio"
                    }`}
                  >
                    {activeCall.type === "video" ? (
                      <div className="messages-call-video-stage">
                        <video
                          ref={remoteCallVideoRef}
                          className="messages-call-remote-video"
                          autoPlay
                          playsInline
                        />

                        {!remoteCallStream && (
                          <div className="messages-call-video-placeholder">
                            <div className="messages-call-avatar-large">
                              {(
                                conversationProfiles[
                                  activeCall.callerId === user?.uid
                                    ? activeCall.calleeId
                                    : activeCall.callerId
                                ]?.displayName ||
                                conversationProfiles[
                                  activeCall.callerId === user?.uid
                                    ? activeCall.calleeId
                                    : activeCall.callerId
                                ]?.username ||
                                "?"
                              )
                                .slice(0, 1)
                                .toUpperCase()}
                            </div>
                            <strong>
                              {callStatus === "calling"
                                ? "Calling…"
                                : callStatus === "ringing"
                                  ? "Connecting…"
                                  : "Connecting…"}
                            </strong>
                          </div>
                        )}

                        <video
                          ref={localCallVideoRef}
                          className="messages-call-local-video"
                          autoPlay
                          muted
                          playsInline
                        />
                      </div>
                    ) : (
                      <div className="messages-call-audio-stage">
                        <div className="messages-call-avatar-large">
                          {(
                            conversationProfiles[
                              activeCall.callerId === user?.uid
                                ? activeCall.calleeId
                                : activeCall.callerId
                            ]?.displayName ||
                            conversationProfiles[
                              activeCall.callerId === user?.uid
                                ? activeCall.calleeId
                                : activeCall.callerId
                            ]?.username ||
                            "?"
                          )
                            .slice(0, 1)
                            .toUpperCase()}
                        </div>

                        <strong>
                          {conversationProfiles[
                            activeCall.callerId === user?.uid
                              ? activeCall.calleeId
                              : activeCall.callerId
                          ]?.displayName ||
                            conversationProfiles[
                              activeCall.callerId === user?.uid
                                ? activeCall.calleeId
                                : activeCall.callerId
                            ]?.username ||
                            "Chit Chat user"}
                        </strong>

                        <span>
                          {callStatus === "calling"
                            ? "Calling…"
                            : callStatus === "connecting"
                              ? "Connecting…"
                              : callStatus === "connected"
                                ? "Connected"
                                : "Call"}
                        </span>
                      </div>
                    )}

                    <div className="messages-active-call-controls">
                      <button
                        type="button"
                        className={`messages-call-control ${
                          isCallMuted
                            ? "messages-call-control-active"
                            : ""
                        }`}
                        onClick={toggleCallMute}
                        aria-label={
                          isCallMuted
                            ? "Unmute microphone"
                            : "Mute microphone"
                        }
                        title={
                          isCallMuted
                            ? "Unmute"
                            : "Mute"
                        }
                      >
                        <Mic size={19} />
                      </button>

                      {activeCall.type === "video" && (
                        <button
                          type="button"
                          className={`messages-call-control ${
                            isCallCameraOff
                              ? "messages-call-control-active"
                              : ""
                          }`}
                          onClick={toggleCallCamera}
                          aria-label={
                            isCallCameraOff
                              ? "Turn camera on"
                              : "Turn camera off"
                          }
                          title={
                            isCallCameraOff
                              ? "Camera on"
                              : "Camera off"
                          }
                        >
                          <Video size={19} />
                        </button>
                      )}

                      <button
                        type="button"
                        className="messages-call-control messages-call-control-danger"
                        onClick={() =>
                          void endActiveCall()
                        }
                        aria-label="End call"
                        title="End call"
                      >
                        <Phone size={19} />
                      </button>
                    </div>
                  </div>
                )}

                {callError && (
                  <div className="messages-call-error">
                    {callError}
                  </div>
                )}
              </div>

              <div className="messages-list">
                {messages.length === 0 ? (
                  <div className="messages-empty-chat">
                    No messages yet. Say hello 👋
                  </div>
                ) : (
                  messages.map((message) => {
                    const mine =
                      message.senderId === user?.uid;

                    return (
                      <div
                        key={message.id}
                        className={`message-row ${
                          mine ? "mine" : "theirs"
                        }`}
                      >
                        <div
                          className="message-swipe-shell"
                          data-message-swipe-id={message.id}
                          onPointerDown={(event) =>
                            handleMessageSwipeStart(
                              event,
                              message,
                            )
                          }
                          onPointerMove={(event) =>
                            handleMessageSwipeMove(
                              event,
                              message,
                            )
                          }
                          onPointerUp={() =>
                            handleMessageSwipeEnd(message)
                          }
                          onPointerCancel={() =>
                            handleMessageSwipeEnd(message)
                          }
                        >
                          {mine && (
                            <div
                              className={`message-swipe-actions ${
                                swipedMessageId === message.id
                                  ? "visible"
                                  : ""
                              }`}
                            >
                              <button
                                type="button"
                                className="message-swipe-action message-swipe-action-unsend"
                                onClick={async () => {
                                  await handleUnsendMessage(message);
                                  handleCloseMessageSwipe();
                                }}
                                tabIndex={
                                  swipedMessageId === message.id ? 0 : -1
                                }
                                aria-label="Unsend message for everyone"
                                title="Unsend for everyone"
                              >
                                <Undo2 size={17} />
                                <span>Unsend</span>
                              </button>
                            </div>
                          )}

                          <div
                            className="message-swipe-content"
                            style={{
                              transform:
                                swipedMessageId === message.id
                                  ? "translateX(-112px)"
                                  : "translateX(0)",
                            }}
                          >
                            <div
                          className={`message-bubble ${
                            message.isDeleted ? "message-bubble-unsent" : ""
                          }`}
                        >
                          {message.isDeleted ? (
                            <div className="message-unsent-state">
                              <Undo2 size={17} />
                              <span>Message unsent</span>
                            </div>
                          ) : (
                            <>
                          {message.sharedContent?.type === "location" && (
                            <div className="message-shared-location">
                              <div className="message-shared-location-icon">
                                <MapPin size={22} />
                              </div>

                              <div className="message-shared-location-content">
                                <strong>Location</strong>
                                <span>
                                  Shared their current location
                                </span>

                                <a
                                  href={`https://www.google.com/maps?q=${encodeURIComponent(
                                    `${message.sharedContent.latitude},${message.sharedContent.longitude}`,
                                  )}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="message-shared-location-link"
                                >
                                  Open in Maps
                                </a>
                              </div>
                            </div>
                          )}

                          {message.sharedContent?.type === "post" && (
                            <div className="message-shared-content">
                              <div className="message-shared-content-label">
                                <Bookmark size={14} />
                                <span>Shared post</span>
                              </div>

                              {message.sharedContent.mediaUrl ? (
                                message.sharedContent.mediaType === "video" ? (
                                  <video
                                    src={message.sharedContent.mediaUrl}
                                    muted
                                    controls
                                    playsInline
                                    preload="metadata"
                                    className="message-shared-content-media"
                                  />
                                ) : (
                                  <img
                                    src={message.sharedContent.mediaUrl}
                                    alt={
                                      message.sharedContent.caption ||
                                      "Shared post"
                                    }
                                    className="message-shared-content-media"
                                  />
                                )
                              ) : (
                                <div className="message-shared-content-empty">
                                  <Bookmark size={22} />
                                  <span>Shared post</span>
                                </div>
                              )}

                              {message.sharedContent.caption && (
                                <div className="message-shared-content-caption">
                                  {message.sharedContent.caption}
                                </div>
                              )}
                            </div>
                          )}

                          {message.attachmentUrl && (
                            <div className="message-attachment">
                              {getSharedStoryId(message) ? (
                                <button
                                  type="button"
                                  className="message-story-attachment"
                                  onClick={() => {
                                    void openSharedStory(message);
                                  }}
                                  aria-label="Open shared story"
                                >
                                  {message.messageType === "video" ? (
                                    <video
                                      src={message.attachmentUrl}
                                      muted
                                      playsInline
                                      preload="metadata"
                                      className="message-attachment-video"
                                    />
                                  ) : (
                                    <img
                                      src={message.attachmentUrl}
                                      alt="Shared story"
                                      className="message-attachment-image"
                                    />
                                  )}
                                  <span className="message-story-attachment-label">
                                    Shared a story with you.
                                  </span>
                                </button>
                              ) : message.messageType === "image" ? (
                                <a
                                  href={message.attachmentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="message-attachment-image-link"
                                >
                                  <img
                                    src={message.attachmentUrl}
                                    alt={message.attachmentName || "Image"}
                                    className="message-attachment-image"
                                  />
                                </a>
                              ) : message.messageType === "video" ? (
                                <video
                                  src={message.attachmentUrl}
                                  controls
                                  preload="metadata"
                                  className="message-attachment-video"
                                />
                              ) : message.messageType === "audio" ? (
                                <audio
                                  src={message.attachmentUrl}
                                  controls
                                  preload="metadata"
                                />
                              ) : (
                                <a
                                  href={message.attachmentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="message-attachment-file"
                                >
                                  <span className="message-attachment-file-icon">
                                    📎
                                  </span>
                                  <span className="message-attachment-file-name">
                                    {message.attachmentName || "Attached file"}
                                  </span>
                                </a>
                              )}
                            </div>
                          )}

                          {message.text && (
                            <div className="message-text">
                              {message.text}
                            </div>
                          )}
                            </>
                          )}
                        </div>

                        {!message.isDeleted &&
                          Object.keys(message.reactions || {}).length > 0 && (
                          <div className="message-reactions">
                            {[
                              ...new Set(
                                Object.values(message.reactions || {}),
                              ),
                            ].map((reaction) => (
                              <button
                                key={reaction}
                                type="button"
                                className={`message-reaction ${
                                  message.reactions?.[user?.uid] === reaction
                                    ? "active"
                                    : ""
                                }`}
                                onClick={() =>
                                  handleMessageReaction(
                                    message,
                                    reaction,
                                  )
                                }
                                aria-label={`React with ${reaction}`}
                              >
                                <span>{reaction}</span>
                                <span>
                                  {
                                    Object.values(
                                      message.reactions || {},
                                    ).filter(
                                      (value) => value === reaction,
                                    ).length
                                  }
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                        {!message.isDeleted && (
                          <div className="message-reaction-tools">
                            {reactionPickerMessageId === message.id && (
                            <div
                              className={`message-reaction-picker ${
                                mine ? "mine" : "theirs"
                              }`}
                            >
                              <ChitChatEmojiPicker
                                width={340}
                                height={380}
                                onEmojiClick={(emojiData) => {
                                  handleMessageReaction(
                                    message,
                                    emojiData.emoji,
                                  );
                                }}
                              />
                            </div>
                          )}

                          <button
                            type="button"
                            className="message-reaction-trigger"
                            onClick={() =>
                              setReactionPickerMessageId(
                                (current) =>
                                  current === message.id
                                    ? null
                                    : message.id,
                              )
                            }
                            aria-label="Add reaction"
                            title="Add reaction"
                          >
                            <SmilePlus size={15} />
                          </button>
                          </div>
                        )}

                            <div className="message-meta">
                              {formatMessageTime(message.createdAt)}
                              {mine && isMessageSeen(message)
                                ? " · Seen"
                                : ""}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
</div>

              <form
                className="messages-composer"
                onSubmit={handleSendMessage}
              >
                <input
                  ref={attachmentInputRef}
                  type="file"
                  hidden
                  onChange={handleAttachmentChange}
                  accept="image/*,video/*,text/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.*"
                />

                <button
                  type="button"
                  className={`messages-attachment-button ${
                    composerToolsOpen ? "active" : ""
                  }`}
                  onClick={() => {
                    setComposerToolsOpen((current) => !current);
                    setComposerEmojiOpen(false);
                        setComposerSavedOpen(false);
                }}
                  disabled={sending}
                  aria-label="Open message tools"
                  title="Message tools"
                >
                  <Paperclip size={20} />
                </button>

                {composerToolsOpen && (
                  <div className="messages-composer-tools">
                    {composerSavedOpen ? (
        <div className="messages-composer-saved-panel">
          <div className="messages-composer-emoji-header">
            <button
              type="button"
              onClick={() => {
                setSelectedSavedPosts([]);
                setComposerSavedOpen(false);
              }}
              aria-label="Back to message tools"
            >
              <ArrowLeft size={18} />
            </button>

            <strong>Saved</strong>
          </div>

          {savedPostsLoading ? (
            <div className="messages-composer-saved-state">
              Loading saved posts...
            </div>
          ) : savedPostsError ? (
            <div className="messages-composer-saved-state error">
              <span>{savedPostsError}</span>

              <button
                type="button"
                onClick={openSavedComposer}
              >
                Try again
              </button>
            </div>
          ) : savedPosts.length === 0 ? (
            <div className="messages-composer-saved-state">
              <Bookmark size={26} />

              <strong>No saved posts yet</strong>

              <span>
                Save a post first and it will appear here.
              </span>
            </div>
          ) : (
            <>
              <div className="messages-composer-saved-grid">
                {savedPosts.map((post) => {
                  const firstMedia = Array.isArray(post.media)
                    ? post.media.find(
                        (item) =>
                          item?.url ||
                          item?.downloadURL ||
                          item?.src,
                      )
                    : null;

                  const mediaUrl =
                    firstMedia?.url ||
                    firstMedia?.downloadURL ||
                    firstMedia?.src ||
                    post.image ||
                    "";

                  const mediaType =
                    firstMedia?.type ||
                    firstMedia?.mediaType ||
                    (firstMedia?.resourceType === "video"
                      ? "video"
                      : "image");

                  const isSelected =
                    selectedSavedPosts.some(
                      (item) => item.id === post.id,
                    );

                  return (
                    <button
                      type="button"
                      key={post.id}
                      className={`messages-composer-saved-item ${
                        isSelected ? "selected" : ""
                      }`}
                      onClick={() =>
                        toggleSavedPostSelection(post)
                      }
                      disabled={sending}
                      title={
                        isSelected
                          ? "Remove from selection"
                          : "Select saved post"
                      }
                    >
                      <span className="messages-composer-saved-media">
                        {mediaUrl ? (
                          mediaType === "video" ? (
                            <video
                              src={mediaUrl}
                              muted
                              playsInline
                              preload="metadata"
                            />
                          ) : (
                            <img
                              src={mediaUrl}
                              alt={
                                post.caption ||
                                "Saved post"
                              }
                              loading="lazy"
                            />
                          )
                        ) : (
                          <span className="messages-composer-saved-no-media">
                            <Bookmark size={22} />
                          </span>
                        )}
                      </span>

                      {post.caption && (
                        <span className="messages-composer-saved-caption">
                          {post.caption}
                        </span>
                      )}

                      {isSelected && (
                        <span
                          className="messages-composer-saved-check"
                          aria-label="Selected"
                        >
                          <Check
                            size={14}
                            strokeWidth={3}
                          />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedSavedPosts.length > 0 && (
                <div className="messages-composer-saved-actions">
                  <span className="messages-composer-saved-selected-count">
                    {selectedSavedPosts.length} selected
                  </span>

                  <button
                    type="button"
                    className="messages-composer-saved-cancel"
                    onClick={() =>
                      setSelectedSavedPosts([])
                    }
                    disabled={sending}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="messages-composer-saved-send"
                    onClick={handleSendSavedPosts}
                    disabled={sending}
                  >
                    <Send size={17} />

                    <span>
                      {sending
                        ? "Sending..."
                        : `Send ${
                            selectedSavedPosts.length > 1
                              ? `(${selectedSavedPosts.length})`
                              : ""
                          }`}
                    </span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : !composerEmojiOpen ? (
                      <>
                        <button
                          type="button"
                          className="messages-composer-tool"
                          onClick={() => {
                            attachmentInputRef.current?.click();
                            setComposerToolsOpen(false);
                          }}
                        >
                          <span className="messages-composer-tool-icon">
                            <Image size={21} />
                          </span>
                          <span>Photos & videos</span>
                        </button>

                        <button
                          type="button"
                          className={`messages-composer-tool ${
                            composerSavedOpen ? "selected" : ""
                          }`}
                          onClick={openSavedComposer}
                          disabled={sending}
                        >
                          <span className="messages-composer-tool-icon">
                            <Bookmark size={21} />
                          </span>
                          <span>Saved</span>
                        </button>

                        <button
                          type="button"
                          className={`messages-composer-tool ${
                            sharingLocation ? "selected" : ""
                          }`}
                          onClick={handleShareLocation}
                          disabled={sending || sharingLocation}
                        >
                          <span className="messages-composer-tool-icon">
                            <MapPin size={21} />
                          </span>
                          <span>
                            {sharingLocation
                              ? "Getting location..."
                              : "Location"}
                          </span>
                        </button>

                        <button
                          type="button"
                          className="messages-composer-tool"
                          disabled
                        >
                          <span className="messages-composer-tool-icon">
                            <Video size={21} />
                          </span>
                          <span>GIFs</span>
                        </button>

                        <button
                          type="button"
                          className="messages-composer-tool"
                          disabled
                        >
                          <span className="messages-composer-tool-icon">
                            <Sticker size={21} />
                          </span>
                          <span>Stickers</span>
                        </button>

                        <button
                          type="button"
                          className="messages-composer-tool"
                          disabled
                        >
                          <span className="messages-composer-tool-icon">
                            <Sparkles size={21} />
                          </span>
                          <span>AI images</span>
                        </button>
                      </>
                    ) : (
                      <div className="messages-composer-emoji-panel">
                        <div className="messages-composer-emoji-header">
                          <button
                            type="button"
                            onClick={() => setComposerEmojiOpen(false)}
                            aria-label="Back to message tools"
                          >
                            <ArrowLeft size={18} />
                          </button>
                          <strong>Emoji</strong>
                        </div>

                        <ChitChatEmojiPicker
                          width={340}
                          height={380}
                          onEmojiClick={(emojiData) => {
                            setText((current) => current + emojiData.emoji);
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="messages-composer-input">
                  {selectedFile && (
                    <div className="messages-selected-file">
                      <span
                        className="messages-selected-file-name"
                        title={selectedFile.name}
                      >
                        {selectedFile.name}
                      </span>

                      <button
                        type="button"
                        onClick={clearSelectedFile}
                        disabled={sending}
                        aria-label="Remove attachment"
                        title="Remove attachment"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  <input
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder={
                      selectedFile
                        ? "Add a message (optional)..."
                        : "Message..."
                    }
                    maxLength={5000}
                    disabled={sending}
                  />
                </div>

                <button
                  type="submit"
                  disabled={
                    sending || (!text.trim() && !selectedFile)
                  }
                  aria-label="Send message"
                  title="Send message"
                >
                  <Send size={20} />
                </button>
        <button
          type="button"
          className={`messages-composer-action ${
            isRecordingVoice ? "active" : ""
          }`}
          onClick={toggleVoiceRecording}
          disabled={sending}
          aria-label={
            isRecordingVoice
              ? "Stop recording"
              : "Record voice message"
          }
          title={
            isRecordingVoice
              ? `Stop recording (${voiceRecordingSeconds}s)`
              : "Record voice message"
          }
          aria-pressed={isRecordingVoice}
        >
          <Mic size={20} />
        </button>

        <button
          type="button"
          className={`messages-composer-action ${
            composerEmojiOpen ? "active" : ""
          }`}
          onClick={() => {
            setComposerToolsOpen(true);
            setComposerEmojiOpen(true);
            setComposerSavedOpen(false);
          }}
          disabled={sending}
          aria-label="Open emoji picker"
          title="Emoji"
          aria-pressed={composerEmojiOpen}
        >
          <SmilePlus size={20} />
        </button>
              </form>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

export default MessagesPage;
