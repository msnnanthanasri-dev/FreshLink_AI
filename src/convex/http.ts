import { httpRouter } from "convex/server";
import { httpActionGeneric as httpAction } from "convex/server";
import { auth } from "./auth";
import { uploadPhoto } from "./uploads";

const http = httpRouter();

auth.addHttpRoutes(http);

// CORS preflight for the upload endpoint
http.route({
  path: "/api/upload",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }),
});

http.route({
  path: "/api/upload",
  method: "POST",
  handler: uploadPhoto,
});

export default http;
