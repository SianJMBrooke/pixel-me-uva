# Pixel Me Arcade: shared leaderboard

The leaderboard is now saved online, on Netlify, instead of in one browser. Every device that opens the site sees the same Hall of Fame, and scores stay when the browser is closed or its data is cleared.

## What's in this folder

| Path | What it is |
|---|---|
| `public/` | The game itself (`index.html` + icon). This is all that visitors download. |
| `netlify/functions/leaderboard.mjs` | A small server function at `/api/leaderboard` that stores the scores (Netlify Blobs). |
| `netlify/lib/board.mjs` | The rules: recording games, deleting scores, checking the code. |
| `netlify.toml`, `package.json` | Tell Netlify where things are and what to install. |

## Deploying

Server functions **don't run on drag-and-drop deploys** (Netlify Drop / "Deploy manually"). Use one of these instead:

**A. GitHub (no command line)**
1. Create a new GitHub repository and upload the *contents* of this folder (Add file → Upload files).
2. In Netlify: open your existing site → Site configuration → Build & deploy → **Link repository**, and pick the repo. (Or Add new site → Import an existing project, if it's a new site.)
3. Leave the build command empty. Netlify reads `netlify.toml` and deploys.

**B. Netlify CLI**
```
npm install -g netlify-cli
cd pixel-me-netlify
netlify link      # choose your site
netlify deploy --prod
```

Once it's live, the leaderboard screen shows **SHARED · LIVE** next to the buttons. If it shows **OFFLINE · WILL SYNC**, the device can't reach the server. Games are still counted and upload automatically when it reconnects.

## Keep your current scores

The old version kept scores only in the kiosk's browser. Before you update:
1. On the kiosk, open the leaderboard and press **EXPORT** (saves a `.json` file).
2. After the new version is live, press **IMPORT**, pick that file and enter the code.

## Deleting scores

- **✕** next to a player deletes that player.
- **RESET ALL** deletes everyone.
- **IMPORT** merges a saved file.

Each asks for the confirmation code (**1984**). The code is checked on the server and never appears in the page, so visitors can't read it. After 5 wrong codes in 10 minutes, deleting pauses for 10 minutes.

To change the code without touching the files: Netlify → Site configuration → Environment variables → add `LEADERBOARD_CODE` with the new code, then redeploy.
