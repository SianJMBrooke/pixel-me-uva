import { getStore } from "@netlify/blobs";
import { handle } from "../lib/board.mjs";

// The code for deleting scores. Set LEADERBOARD_CODE in Netlify (Site configuration → Environment variables)
// to change it without editing code; otherwise it falls back to 1984.
// This file runs on Netlify's servers only, so visitors never see the code.
function adminCode() {
  try {
    const v = globalThis.Netlify?.env?.get("LEADERBOARD_CODE");
    if (v) return v;
  } catch {}
  return process.env.LEADERBOARD_CODE || "1984";
}

export default async (req) => {
  const store = getStore({ name: "pixel-me-leaderboard", consistency: "strong" });
  try {
    return await handle(req, store, adminCode());
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "server error" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};

export const config = { path: "/api/leaderboard" };
