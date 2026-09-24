import { getStore } from "@netlify/blobs";
import { handleSelfie } from "../lib/selfie.mjs";

export default async (req) => {
  const store = getStore({ name: "pixel-me-selfies", consistency: "strong" });
  try {
    return await handleSelfie(req, store);
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "server error" }), { status: 500, headers: { "content-type": "application/json" } });
  }
};

export const config = { path: "/api/selfie" };
