import { httpActionGeneric as httpAction } from "convex/server";
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * POST /api/upload  — multipart form with `photo` file.
 * Stores the image in Convex file storage and returns a serving URL.
 */
export const uploadPhoto = httpAction(async (ctx, request) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "Missing 'photo' file" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (file.size > 6 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "Photo must be under 6 MB" }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!file.type.startsWith("image/")) {
      return new Response(JSON.stringify({ error: "Only image files are supported" }), {
        status: 415,
        headers: { "Content-Type": "application/json" },
      });
    }
    const blob = await file.arrayBuffer();
    const storageId = await ctx.storage.store(new Blob([blob], { type: file.type }));
    const url = await ctx.storage.getUrl(storageId);
    return new Response(JSON.stringify({ storageId, url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Upload failed. Please try again." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

/** Internal backreference table not needed — storage ids are returned directly. */
export const noop = internalMutation({ args: {}, handler: async () => null });
