import { httpActionGeneric as httpAction } from "convex/server";
import { internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];

/** Document formats accepted for FSSAI certificate uploads. */
const DOC_TYPES = ["application/pdf", ...IMAGE_TYPES];

/**
 * POST /api/upload  — multipart form with `photo` file.
 * `kind` (optional): "photo" (default, images only) | "certificate" (pdf/images).
 * Stores the file in Convex file storage and returns a serving URL.
 *
 * Certificate files live in Convex storage with unguessable URLs; access is
 * only surfaced to the owning organization and platform admins in the UI.
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
    const kind = String(form.get("kind") || "photo");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "Missing 'photo' file" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (file.size > 6 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File must be under 6 MB" }), {
        status: 413,
        headers: { "Content-Type": "application/json" },
      });
    }
    const allowed = kind === "certificate" ? DOC_TYPES : IMAGE_TYPES;
    if (!allowed.includes(file.type)) {
      return new Response(
        JSON.stringify({
          error:
            kind === "certificate"
              ? "Certificates must be a PDF or image (JPG, PNG, WEBP)."
              : "Only image files are supported",
        }),
        { status: 415, headers: { "Content-Type": "application/json" } },
      );
    }
    const blob = await file.arrayBuffer();
    const storageId = await ctx.storage.store(new Blob([blob], { type: file.type }));
    const url = await ctx.storage.getUrl(storageId);
    return new Response(JSON.stringify({ storageId, url, name: file.name, type: file.type }), {
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
