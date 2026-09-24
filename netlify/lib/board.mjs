// Leaderboard logic, kept separate from the Netlify wiring so it can be tested with a fake store.
// State lives in ONE blob so every change is a single read-modify-write:
//   { board: { NAME: {name,wins,losses,draws,played,games,thumb,last} }, seen: [recordIds], fails: [timestamps] }

export const GAMES = ["pong", "cycles", "coins", "dash"];
const KEY = "state";
const MAX_SEEN = 500;          // remembered record ids, so a retried upload never counts twice
const MAX_FAILS = 5;           // wrong codes allowed ...
const FAIL_WINDOW = 10 * 60e3; // ... per 10 minutes, then admin actions pause
const THUMB_RE = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function cleanName(n) {
  if (typeof n !== "string") return null;
  const s = n.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 24);
  return s || null;
}
function cleanThumb(t) {
  return typeof t === "string" && t.length <= 40000 && THUMB_RE.test(t) ? t : "";
}
const int = (v) => (Number.isFinite(+v) && +v >= 0 ? Math.min(1e7, Math.floor(+v)) : 0);

function cleanEntry(name, e) {
  const games = {};
  for (const g of GAMES) if (e && e.games && e.games[g]) games[g] = int(e.games[g]);
  const out = {
    name,
    wins: int(e && e.wins),
    losses: int(e && e.losses),
    draws: int(e && e.draws),
    played: int(e && e.played),
    games,
    thumb: cleanThumb(e && e.thumb),
    last: int(e && e.last),
  };
  out.played = Math.max(out.played, out.wins + out.losses + out.draws);
  return out;
}

async function load(store) {
  const s = (await store.get(KEY, { type: "json" })) || {};
  return { board: s.board || {}, seen: s.seen || [], fails: s.fails || [] };
}
const save = (store, s) => store.setJSON(KEY, s);

export async function handle(req, store, adminCode) {
  if (req.method === "GET") {
    const s = await load(store);
    return json(200, { board: s.board });
  }
  if (req.method !== "POST") return json(405, { error: "method not allowed" });

  let body;
  try { body = await req.json(); } catch { return json(400, { error: "bad json" }); }
  if (!body || typeof body !== "object") return json(400, { error: "bad request" });

  const s = await load(store);
  const now = Date.now();

  // ---- record a finished game (anyone can do this) ----
  if (body.action === "record") {
    const id = typeof body.id === "string" ? body.id.slice(0, 64) : "";
    if (!id || !GAMES.includes(body.game) || !Array.isArray(body.players) || !body.players.length || body.players.length > 2)
      return json(400, { error: "bad record" });
    if (s.seen.includes(id)) return json(200, { board: s.board, duplicate: true });
    for (const p of body.players) {
      const name = cleanName(p && p.name);
      if (!name || !["win", "loss", "draw"].includes(p.result)) return json(400, { error: "bad player" });
    }
    for (const p of body.players) {
      const name = cleanName(p.name);
      const e = s.board[name] || (s.board[name] = cleanEntry(name, {}));
      e.played++;
      if (p.result === "draw") e.draws++;
      else if (p.result === "win") { e.wins++; e.games[body.game] = (e.games[body.game] || 0) + 1; }
      else e.losses++;
      const t = cleanThumb(p.thumb);
      if (t) e.thumb = t;
      e.last = now;
    }
    s.seen.push(id);
    if (s.seen.length > MAX_SEEN) s.seen = s.seen.slice(-MAX_SEEN);
    await save(store, s);
    return json(200, { board: s.board });
  }

  // ---- admin actions: need the confirmation code ----
  if (!["delete", "reset", "import"].includes(body.action)) return json(400, { error: "unknown action" });

  s.fails = s.fails.filter((t) => now - t < FAIL_WINDOW);
  if (s.fails.length >= MAX_FAILS) return json(429, { error: "too many wrong codes, wait 10 minutes" });
  if (String(body.code ?? "") !== String(adminCode)) {
    s.fails.push(now);
    await save(store, s);
    return json(403, { error: "wrong code" });
  }
  s.fails = [];

  if (body.action === "delete") {
    const name = cleanName(body.name);
    if (!name) return json(400, { error: "bad name" });
    delete s.board[name];
  } else if (body.action === "reset") {
    s.board = {};
  } else if (body.action === "import") {
    const inc = body.data;
    if (!inc || typeof inc !== "object" || Array.isArray(inc)) return json(400, { error: "bad import" });
    for (const k of Object.keys(inc).slice(0, 2000)) {
      const name = cleanName((inc[k] && inc[k].name) || k);
      if (!name) continue;
      const b = cleanEntry(name, inc[k]);
      const a = s.board[name];
      if (!a || b.played > a.played) s.board[name] = b;
    }
  }
  await save(store, s);
  return json(200, { board: s.board });
}
