---
name: run-loopkeep
description: Build, run, and drive the Loopkeep Expo app via its web target. Use when asked to start loopkeep, run it, take a screenshot of its UI, or interact with the running app (dashboard, item list, add/edit item, calendar).
---

Loopkeep is an Expo/React Native app (SQLite-backed home-maintenance
tracker). There's no Xcode or Android SDK in this environment, so it's
driven through Expo's **web** target instead: start the Metro/web dev
server, then drive the page with the Playwright REPL at
`.claude/skills/run-loopkeep/driver.mjs`.

All paths below are relative to `loopkeep/` (this skill's grandparent dir).

## Prerequisites

None beyond Node — no `apt-get`/system packages were needed. The driver
uses the **system Google Chrome** via Playwright's `channel: 'chrome'`,
not Playwright's own downloaded Chromium (see Gotchas).

## Setup

The web platform isn't set up by default — `react-dom` and
`react-native-web` aren't in `package.json`. Install them once:

```bash
npx expo install react-dom react-native-web
```

`expo-sqlite`'s web backend (`wa-sqlite`, used for the app's database)
needs Metro to treat `.wasm` as a bundleable asset, which isn't Expo's
default. This project had no `metro.config.js` — it now has one
committed at the repo root with:

```js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('wasm');
module.exports = config;
```

Without this, the web bundle fails with `Unable to resolve
"./wa-sqlite/wa-sqlite.wasm"`.

The driver needs `playwright-core` (not full `playwright` — its
postinstall browser download doesn't work here, see Gotchas):

```bash
npm install --no-save playwright-core
```

## Build / Run the dev server

No separate build step — Metro compiles on request.

```bash
npx expo start --web &
timeout 30 bash -c 'until curl -sf http://localhost:8081 >/dev/null; do sleep 1; done'
```

Stop with: `lsof -ti:8081 -sTCP:LISTEN | xargs -r kill`

## Run (agent path)

```bash
NODE_PATH="$PWD/node_modules" node .claude/skills/run-loopkeep/driver.mjs
```

It's a stdin REPL (works piped via heredoc, or interactively). Example
session — first-launch notification intro, dismiss it, land on the
dashboard, expand the item list:

```bash
NODE_PATH="$PWD/node_modules" node .claude/skills/run-loopkeep/driver.mjs <<'EOF'
launch
click-text Not now
click-text On track (10)
ss dashboard
console
quit
EOF
```

Screenshots land in `/tmp/loopkeep-shots/` (override: `SCREENSHOT_DIR`).
`LOOPKEEP_URL` overrides the dev server URL (default
`http://localhost:8081`).

### Commands

| command | what it does |
|---|---|
| `launch` | open the page, start capturing console errors |
| `ss [name]` | screenshot → `/tmp/loopkeep-shots/<name>.png` |
| `click <css-sel>` | Playwright `.click()` |
| `click-text <text>` | click first element containing that text |
| `type <text>` / `press <key>` | keyboard input |
| `wait <css-sel>` | wait for a selector, 10s timeout |
| `wait-text <text>` | wait for text to appear, 10s timeout |
| `eval <js>` | evaluate expression in the page, print JSON |
| `text [css-sel]` | print `innerText` of selector (default: `body`) |
| `console` | print captured console/page errors since `launch` |
| `quit` | close the browser |

On first launch the app always shows a one-time "Stay on top of home
maintenance" notification-permission screen (`App.tsx`'s
`showNotifIntro` state, gated on an AsyncStorage/SQLite setting) —
`click-text Not now` (or `Enable Reminders`) to get past it to the real
dashboard.

## Run (human path)

```bash
npx expo start --web   # opens your default browser to localhost:8081
```

Or scan the QR code Expo prints with the Expo Go app for a real
device/simulator instead of the web target.

## Test

```bash
npm test
```

## Gotchas

- **`expo-sqlite` web backend needs the `wasm` Metro asset fix above.**
  Without it, `expo start --web` bundles but the app never reaches
  "ready" — the whole point of this app (SQLite item tracking) is
  broken on web without it.
- **Playwright's own Chromium download times out here** (`ETIMEDOUT`
  reading from `cdn.playwright.dev`). Don't run `npx playwright
  install`. Use `playwright-core` and `chromium.launch({ channel:
  'chrome', args: ['--no-sandbox'] })` against the system Google
  Chrome install instead (already at `/Applications/Google Chrome.app`
  on this machine).
- **`react-dom`/`react-native-web` aren't installed by default** —
  `expo start --web` fails fast with a clear `CommandError` naming
  exactly what to `expo install`; don't skip straight to debugging
  Metro.
- **Piped/heredoc input to the driver races the REPL.** Node's
  `readline` reads all heredoc lines and fires `close` (EOF) almost
  immediately — well before the driver's async command chain (browser
  launch, navigation, clicks) has processed them. The driver serializes
  commands into a promise chain and guards `rl.prompt()`/exit against
  early `close` so this doesn't throw `ERR_USE_AFTER_CLOSE` or drop
  queued commands; you don't need to slow-feed it, but if you extend
  the driver, keep new commands inside that same chain.
- **`NODE_PATH` is required** when invoking the driver — it's a script
  under `.claude/skills/`, outside the normal `node_modules`
  resolution chain from its own directory, so `playwright-core` won't
  resolve without it.
- **No `tmux`** in this environment (only `screen`) — the driver was
  verified via piped heredoc instead of the usual tmux `send-keys`
  wrapping. If `tmux` is available where you're running this, it works
  the same way: `tmux send-keys -t app 'launch' Enter`, poll
  `capture-pane` for `launched:`, then proceed.

## Troubleshooting

- **`Unable to resolve "./wa-sqlite/wa-sqlite.wasm"`**: missing the
  `metro.config.js` wasm asset fix above.
- **`CommandError: ...don't have the required dependencies...web
  support`**: run the `expo install react-dom react-native-web` setup
  step.
- **`Error: read ETIMEDOUT` from `npx playwright install`**: network
  can't reach `cdn.playwright.dev` in this environment. Skip it — use
  `playwright-core` + system Chrome (`channel: 'chrome'`) as documented
  above.
- **`Cannot find module 'playwright-core'` running the driver**: you
  forgot `NODE_PATH="$PWD/node_modules"` (run from `loopkeep/`).
- **`EADDRINUSE` on `:8081`**: a previous dev server is still running —
  `lsof -ti:8081 -sTCP:LISTEN | xargs -r kill` before restarting.
