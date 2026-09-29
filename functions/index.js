const {setGlobalOptions} = require("firebase-functions");
const {
  onDocumentCreated,
  onDocumentDeleted,
} = require("firebase-functions/v2/firestore");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

setGlobalOptions({
  maxInstances: 10,
});

/**
 * Increment/decrement a counter on a post.
 *
 * @param {FirebaseFirestore.DocumentReference} postRef Post document reference.
 * @param {string} field Counter field name.
 * @param {number} amount Amount to increment or decrement.
 * @return {Promise<void>} Resolves when the counter update completes.
 */
async function updatePostCounter(postRef, field, amount) {
  await postRef.update({
    [field]: FieldValue.increment(amount),
  });
}

/**
 * POST LIKES
 *
 * posts/{postId}/likes/{userId}
 */
exports.onPostLikeCreated = onDocumentCreated(
    "posts/{postId}/likes/{userId}",
    async (event) => {
      const postId = event.params.postId;

      if (!postId) {
        console.error("Missing postId for like creation.");
        return;
      }

      const postRef = db.doc(`posts/${postId}`);

      try {
        await updatePostCounter(postRef, "likesCount", 1);
        console.log(`Incremented likesCount for post ${postId}.`);
      } catch (error) {
        console.error(`Failed to increment likesCount for ${postId}:`, error);
      }
    },
);

exports.onPostLikeDeleted = onDocumentDeleted(
    "posts/{postId}/likes/{userId}",
    async (event) => {
      const postId = event.params.postId;

      if (!postId) {
        console.error("Missing postId for like deletion.");
        return;
      }

      const postRef = db.doc(`posts/${postId}`);

      try {
        await updatePostCounter(postRef, "likesCount", -1);
        console.log(`Decremented likesCount for post ${postId}.`);
      } catch (error) {
        console.error(`Failed to decrement likesCount for ${postId}:`, error);
      }
    },
);

/**
 * POST COMMENTS
 *
 * posts/{postId}/comments/{commentId}
 */
exports.onPostCommentCreated = onDocumentCreated(
    "posts/{postId}/comments/{commentId}",
    async (event) => {
      const postId = event.params.postId;

      if (!postId) {
        console.error("Missing postId for comment creation.");
        return;
      }

      const postRef = db.doc(`posts/${postId}`);

      try {
        await updatePostCounter(postRef, "commentsCount", 1);
        console.log(`Incremented commentsCount for post ${postId}.`);
      } catch (error) {
        console.error(
            `Failed to increment commentsCount for ${postId}:`,
            error,
        );
      }
    },
);

exports.onPostCommentDeleted = onDocumentDeleted(
    "posts/{postId}/comments/{commentId}",
    async (event) => {
      const postId = event.params.postId;

      if (!postId) {
        console.error("Missing postId for comment deletion.");
        return;
      }

      const postRef = db.doc(`posts/${postId}`);

      try {
        await updatePostCounter(postRef, "commentsCount", -1);
        console.log(`Decremented commentsCount for post ${postId}.`);
      } catch (error) {
        console.error(
            `Failed to decrement commentsCount for ${postId}:`,
            error,
        );
      }
    },
);

/**
 * POST SHARES
 *
 * posts/{postId}/shares/{shareId}
 *
 * Shares are currently create-only in Firestore rules,
 * so this counter only increments.
 */
exports.onPostShareCreated = onDocumentCreated(
    "posts/{postId}/shares/{shareId}",
    async (event) => {
      const postId = event.params.postId;

      if (!postId) {
        console.error("Missing postId for share creation.");
        return;
      }

      const postRef = db.doc(`posts/${postId}`);

      try {
        await updatePostCounter(postRef, "sharesCount", 1);
        console.log(`Incremented sharesCount for post ${postId}.`);
      } catch (error) {
        console.error(`Failed to increment sharesCount for ${postId}:`, error);
      }
    },
);

/**
 * POST REPOSTS
 *
 * reposts/{repostId}
 */
exports.onPostRepostCreated = onDocumentCreated(
    "reposts/{repostId}",
    async (event) => {
      const data = event.data ? event.data.data() : null;

      if (!data || !data.postId) {
        console.error("Missing postId for repost creation.");
        return;
      }

      const postRef = db.doc(`posts/${data.postId}`);

      try {
        await updatePostCounter(postRef, "repostsCount", 1);
        console.log(`Incremented repostsCount for post ${data.postId}.`);
      } catch (error) {
        console.error(
            `Failed to increment repostsCount for ${data.postId}:`,
            error,
        );
      }
    },
);

exports.onPostRepostDeleted = onDocumentDeleted(
    "reposts/{repostId}",
    async (event) => {
      const data = event.data ? event.data.data() : null;

      if (!data || !data.postId) {
        console.error("Missing postId for repost deletion.");
        return;
      }

      const postRef = db.doc(`posts/${data.postId}`);

      try {
        await updatePostCounter(postRef, "repostsCount", -1);
        console.log(`Decremented repostsCount for post ${data.postId}.`);
      } catch (error) {
        console.error(
            `Failed to decrement repostsCount for ${data.postId}:`,
            error,
        );
      }
    },
);

/**
 * ONE-TIME COUNTER RECONCILIATION
 * Removes stale aggregate counters by counting actual child documents.
 */
const {onCall} = require("firebase-functions/v2/https");

exports.reconcilePostCounters = onCall(async (request) => {
  if (!request.auth) {
    throw new Error("UNAUTHENTICATED");
  }

  const postsSnapshot = await db.collection("posts").get();

  let repaired = 0;

  for (const postDoc of postsSnapshot.docs) {
    const postRef = postDoc.ref;

    const [
      likesSnapshot,
      commentsSnapshot,
      sharesSnapshot,
    ] = await Promise.all([
      postRef.collection("likes").get(),
      postRef.collection("comments").get(),
      postRef.collection("shares").get(),
    ]);

    const repostsSnapshot = await db
        .collection("reposts")
        .where("postId", "==", postDoc.id)
        .get();

    await postRef.update({
      likesCount: likesSnapshot.size,
      commentsCount: commentsSnapshot.size,
      sharesCount: sharesSnapshot.size,
      repostsCount: repostsSnapshot.size,
    });

    repaired += 1;
  }

  return {
    success: true,
    repaired,
  };
});
