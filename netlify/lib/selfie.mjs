// Phone → screen selfie hand-off. The big screen shows a QR code with a random session id;
// the phone uploads one photo for that id; the screen picks it up once and it is deleted straight away.
// Anything not picked up is removed after 10 minutes.

const ID_RE = /^[a-z0-9]{8,24}$/;
const IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX = 1_500_000;          // ~1.1 MB image
const TTL = 10 * 60e3;

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

async function cleanup(store) {
  try {
    const { blobs } = await store.list({ prefix: "sf-" });
    const now = Date.now();
    for (const b of (blobs || []).slice(0, 50)) {
      const v = await store.get(b.key, { type: "json" });
      if (!v || now - (v.t || 0) > TTL) await store.delete(b.key);
    }
  } catch {}
}

export async function handleSelfie(req, store) {
  const url = new URL(req.url);
  if (req.method === "GET" || req.method === "DELETE") {
    const s = url.searchParams.get("s") || "";
    if (!ID_RE.test(s)) return json(400, { error: "bad id" });
    const key = "sf-" + s;
    const v = req.method === "GET" ? await store.get(key, { type: "json" }) : null;
    if (req.method === "DELETE" || v) await store.delete(key);
    if (!v || Date.now() - (v.t || 0) > TTL) return json(200, { img: null });
    return json(200, { img: v.img });
  }
  if (req.method !== "POST") return json(405, { error: "method not allowed" });
  let body;
  try { body = await req.json(); } catch { return json(400, { error: "bad json" }); }
  const s = body && body.s, img = body && body.img;
  if (typeof s !== "string" || !ID_RE.test(s)) return json(400, { error: "bad id" });
  if (typeof img !== "string" || img.length > MAX || !IMG_RE.test(img)) return json(400, { error: "bad image" });
  await store.setJSON("sf-" + s, { img, t: Date.now() });
  await cleanup(store);
  return json(200, { ok: true });
}
