# mountlab — Desktop Application Migration Plan

> Status: planning only. No code is changed by this document.
> Scope: turn mountlab from a locally-served web app (Vite dev server + Express + Python/FreeCAD) into a packaged desktop application that a user installs and double-clicks on a PC.

---

# Current Architecture Summary

mountlab is **already a local-only application** — it does not depend on the cloud or the internet. It is split into a browser frontend and a local Node backend that shells out to Python/FreeCAD for CAD work.

### Frontend
- **Framework:** React 18.3.1 (`src/main.jsx`, `src/App.jsx`).
- **Build tool:** Vite 5 (`vite.config.js`, `@vitejs/plugin-react`).
- **Styling:** Tailwind 3 (`tailwind.config.js`, `postcss.config.js`), `src/index.css` / `src/App.css`.
- **3D:** `three` 0.183 + `@react-three/fiber` 8 + `@react-three/drei` 9, `@use-gesture/react`. Loaders used: `STLLoader` (`src/main.jsx:4`, `src/components/AssemblyModel.jsx:3`, `src/components/ModelLoader.jsx:5`), `useGLTF` (drei).
- **State / business logic:** concentrated in `src/hooks/useAssembly.js` (~2100 lines) and `src/hooks/useConfigurator.js`. This holds assembly state, drilling/holes math, export orchestration, workspace lifecycle, and all `fetch`/SSE calls.
- **Pure config/data:** `src/config/` (`assemblyObjects.js`, `chassisComponents.js`, `materialDefinitions.js`, `productOptions.js`, `rackPresets.js`) — no I/O, fully portable.
- **Server coupling:** the API base URL is **hardcoded** to `http://127.0.0.1:3001` in three places:
  - `src/App.jsx:16`
  - `src/components/AssemblyModel.jsx:5`
  - `src/hooks/useAssembly.js:24`
- **Live reload of models:** `EventSource('http://127.0.0.1:3001/api/events')` SSE stream (`src/hooks/useAssembly.js:2121`) fed by the backend file watcher.

### Backend
- **Framework:** Express 5 (`server/index.js`), ES modules, Node runtime.
- **Port/host:** `SERVER_PORT` (default 3001), `SERVER_HOST` (default 127.0.0.1) — `server/index.js:14-15`.
- **CORS:** locked to `http://(localhost|127.0.0.1):517x` (`server/index.js:17-25`).
- **Routes** (`server/routes/`): `model.js`, `convert.js`, `positions.js`, `drill.js`, `export.js`, `workspace.js`, plus `/api/health` and `/api/events`.
- **File watching:** `chokidar` → Server-Sent Events (`server/lib/watcher.js`).
- **CAD compute via Python subprocess** (`child_process.spawn`):
  - `server/convert.py` — STEP → STL using **CadQuery** (`server/lib/conversion.js`).
  - `server/export.py` — STL → STEP using **FreeCAD** (`server/lib/export.js`). Note: this is *mesh-derived* STEP via `makeShapeFromMesh`, not true B-rep.
  - `server/drill.py` — applies cylindrical holes via FreeCAD (`server/lib/drill.js`).

### Storage layer (filesystem, no database)
- **Saved projects:** `public/projects/<slug>/` (`server/lib/workspace.js`, `savedProjectsRoot = <projectRoot>/public/projects`). Served statically by Vite. `.gitignore` excludes `public/projects/*`.
- **Scratch workspaces:** `os.tmpdir()/mountlab-workspaces/<id>/` (`server/lib/workspace.js`).
- **Conversion cache:** `server/converted/*.stl` (sha256-keyed, `server/lib/conversion.js`).
- **STEP export cache:** written next to the source STL as `<name>.export-<hash>.step` (`server/lib/export.js`).
- **Positions:** `server/positions.json`.
- Example shipped data: `public/projects/tamburi/` (assembly.json + STL/STEP panels).

### Authentication
- **None.** No login, sessions, tokens, or user accounts anywhere.

### Environment variables (current)
`SERVER_PORT`, `SERVER_HOST`, `ALLOWED_DIRS` (path allowlist in `server/lib/paths.js`), `PYTHON_CMD`, `FREECAD_CMD`, `FREECAD_LIB_PATH`, `EXPORT_TIMEOUT_MS`. No `.env` file is committed; these are read from `process.env` with defaults.

### External runtime dependencies (the hard part of any packaging)
- **Python 3** + **CadQuery** (STEP import/preview).
- **FreeCAD** (STEP export + drilling). `server/lib/export.js:13-21` probes a list of macOS FreeCAD paths.

### Deployment assumptions today
- `npm run dev` runs `concurrently` → `node server/index.js` + `vite` (`package.json`). Two processes, two ports, browser opens `localhost:517x`.
- No CI/CD, no Dockerfile, no cloud config. It is a developer-run local tool.

### Layer classification
| Layer | Lives in | Desktop concern |
|---|---|---|
| Pure UI | `src/components/`, `src/App.css` | None — runs as-is in a webview |
| Business logic (JS) | `src/hooks/`, `src/config/` | Portable; only the `fetch` base URL is coupled |
| Server-dependent | all `/api/*` calls, SSE | Must reach a backend bundled in the app |
| Browser-only APIs | `fetch`, `EventSource`, File input, `URL`/`Blob`, WebGL | All supported in Electron/Chromium webview |
| Native/OS | filesystem, `child_process`, `os.tmpdir` | Already Node-side; must keep a Node host |

---

# Desktop Migration Goal

"Running as a PC app" for mountlab means:

1. A single installable artifact (`.exe`/installer on Windows first) that launches a native window — **no terminal, no `npm run dev`, no browser tab.**
2. The Express backend starts and stops **automatically** with the window, on a private loopback port (or via in-process IPC), invisible to the user.
3. Works **fully offline**. No internet required (already true).
4. Reads/writes user projects in a proper **per-user app-data location**, not inside the installed program folder (which is read-only on Windows/macOS).
5. CAD tooling (Python/CadQuery, FreeCAD) is either **bundled** or the app **degrades gracefully** with a clear message when missing.
6. Native niceties: native file open/save dialogs, app menu, and (optionally) auto-update.

Non-goals for v1: multi-user accounts, online sync, mobile.

---

# Migration Options

The decisive factor: **the backend is non-trivial Node** (Express + chokidar + `child_process` spawning Python/FreeCAD). Any option must keep a Node runtime alive. That single fact drives the comparison.

### Option A — Electron
- **Stack compatibility:** Excellent. Chromium hosts the existing React/Three.js build unchanged; Node main process runs the existing Express server (forked child or in-process).
- **Code reuse:** ~95%. Frontend untouched except API base URL. Backend reused verbatim.
- **Architectural change:** Add a `main` process + `preload`. Optionally drop CORS and talk over IPC, but keeping the localhost Express server is the lowest-risk path.
- **Performance:** Heavier RAM (full Chromium). Irrelevant for a single-window CAD tool; Three.js already needs a real GPU-backed WebGL context, which Electron provides reliably.
- **Packaging:** Mature — `electron-builder` produces NSIS `.exe` (Windows), `.dmg`, `AppImage/.deb`. Bundling Python/FreeCAD is the only hard part (same for every option).
- **Security:** Must configure `contextIsolation: true`, `nodeIntegration: false`, a `preload` bridge, and a strict CSP. Well-trodden.
- **Maintenance:** Large ecosystem, abundant examples. Bigger binaries (~100–150 MB before Python).
- **OS support:** Windows/macOS/Linux all first-class.

### Option B — Tauri
- **Stack compatibility:** Frontend yes (any webview). Backend **no** — Tauri's native side is Rust. The Express/chokidar/Python-spawning backend would either be **rewritten in Rust** (large effort) or shipped as a **Node sidecar binary** (`tauri.conf.json > externalBin`).
- **Code reuse:** Frontend ~95%. Backend either 0% (Rust rewrite) or ~100% but as an awkward sidecar you must bundle a Node runtime for anyway.
- **Architectural change:** Significant if rewriting; with sidecar you reintroduce the exact localhost-server model Electron gives natively, minus the smooth integration.
- **Performance:** Smaller binary, lower idle RAM (OS webview). But Windows uses WebView2 (Edge/Chromium) — fine for Three.js — while Linux uses WebKitGTK, where heavy WebGL can be flaky.
- **Packaging:** Good, smaller installers. Sidecar + Python + FreeCAD bundling is *more* fiddly than Electron's.
- **Security:** Strong defaults (capability-based allowlist).
- **Maintenance:** Rust toolchain in the loop; smaller (but growing) ecosystem; cross-platform WebGL variance is a real risk for a 3D app.
- **OS support:** All three, with the WebKitGTK/WebGL caveat on Linux.

### Option C — Native rewrite (C++/Qt, .NET, etc.)
- **Compatibility:** None — discard React/Three.js entirely.
- **Reuse:** ~0% of UI; only the `src/config/*` data and Python scripts survive.
- **Change:** Total rewrite, new 3D renderer, re-implement the whole assembly/drilling UX.
- **Performance:** Best-in-class, irrelevant at this app's scale.
- **Verdict:** Massive cost, no payoff here. Only justified if you later need a true B-rep CAD kernel UI at AutoCAD scale. **Reject for this migration.**

### Option D — Wrap existing frontend in a desktop shell, no backend changes
- This is essentially Option A/B *minus* lifecycle management of the server — i.e., the shell still needs to launch `server/index.js`. It is not a distinct destination; it's the first milestone of Option A. Treated as Phase 1 below.

### Option E — Split into local frontend + local backend process
- Already the de-facto architecture (two processes). The desktop work is to make the shell **own** the backend process lifecycle and hide the ports. This is *how* Option A is implemented, not an alternative to it.

---

# Recommended Architecture

**Primary recommendation: Electron**, running the existing Express server as a **forked child process on a random loopback port**, with the built Vite bundle loaded from disk.

**Fallback: Tauri + Node sidecar** — only adopt if installer size or per-process RAM becomes a hard requirement and you accept the Linux WebGL risk and extra sidecar packaging.

Why Electron wins for mountlab specifically:
1. The backend is Node and **spawns child processes** (Python/FreeCAD). Electron's main process *is* Node — zero impedance mismatch. Tauri would force a Rust rewrite or a redundant Node sidecar.
2. Three.js/WebGL behaves identically to today (Chromium), eliminating cross-webview rendering risk.
3. ~95% code reuse; the migration is mostly *lifecycle + paths + packaging*, not a rewrite.
4. `electron-builder` has the most mature Windows-first installer story, including bundling extra resources (the Python scripts and, optionally, a Python runtime).

The realistic decision is **not** "rewrite the backend" but "embed the backend we already have and fix the filesystem assumptions that break inside a packaged app."

---

# Target Architecture Diagram (textual)

```
┌──────────────────────────── Electron app (single process tree) ────────────────────────────┐
│                                                                                              │
│  MAIN PROCESS (Node)                          RENDERER PROCESS (Chromium)                    │
│  ┌────────────────────────────┐               ┌──────────────────────────────────────────┐  │
│  │ electron/main.js           │               │ Built Vite bundle (dist/ via loadFile)   │  │
│  │  • create BrowserWindow    │  IPC (preload │  • React + Tailwind UI                    │  │
│  │  • pick free loopback port │   contextBridge) │  • Three.js / r3f viewer              │  │
│  │  • fork server/index.js ───┼──────────────►│  • fetch(`${API_BASE}/api/...`)          │  │
│  │  • inject env (ports,paths)│   exposes:    │  • EventSource(`${API_BASE}/api/events`) │  │
│  │  • native menus/dialogs    │   getApiBase()│                                          │  │
│  │  • app lifecycle/updater   │   openFile()  │  API_BASE injected, NOT hardcoded         │  │
│  └─────────────┬──────────────┘               └──────────────────────────────────────────┘  │
│                │ child_process.fork                                                          │
│                ▼                                                                              │
│  ┌────────────────────────────┐        ┌──────────────────────────────────────────────────┐│
│  │ EMBEDDED BACKEND           │ spawn  │ CAD TOOLCHAIN (external/bundled)                  ││
│  │ server/index.js (Express)  ├───────►│  python3 + CadQuery  → convert.py                ││
│  │  • loopback only           │        │  FreeCAD             → export.py, drill.py        ││
│  │  • chokidar watcher → SSE  │        └──────────────────────────────────────────────────┘│
│  └─────────────┬──────────────┘                                                             │
│                │ fs I/O                                                                       │
│                ▼                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────────────────┐  │
│  │ LOCAL STORAGE  (app.getPath('userData')/...)                                          │  │
│  │   projects/<slug>/        ← was public/projects (now writable, user-owned)            │  │
│  │   workspaces/<id>/        ← was os.tmpdir()/mountlab-workspaces                        │  │
│  │   cache/converted/*.stl   ← was server/converted                                      │  │
│  │   positions.json, config.json                                                         │  │
│  └──────────────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
                         No network egress. Loopback only. Fully offline.
```

---

# Detailed Migration Plan

Each phase ends with the app still working (`npm run dev` stays valid throughout).

### Phase 0 — Decouple frontend from the hardcoded backend URL (no Electron yet)
1. Introduce a single API-base resolver, e.g. `src/config/apiBase.js`, returning, in order: `window.__MOUNTLAB_API_BASE__` (injected by Electron preload) → `import.meta.env.VITE_API_BASE` → `http://127.0.0.1:3001` (dev default).
2. Replace the three hardcoded `API_BASE` constants (`src/App.jsx:16`, `src/components/AssemblyModel.jsx:5`, `src/hooks/useAssembly.js:24`) with imports from it.
3. Verify `npm run dev` still works unchanged. **This phase alone is shippable and de-risks everything after it.**

### Phase 1 — Make the backend packaging-safe (paths & port)
4. Add a path-resolution module so storage roots come from env, not from `__dirname/../../public`:
   - `MOUNTLAB_DATA_DIR` → base for `projects/`, `workspaces/`, `cache/converted/`, `positions.json`.
   - Update `server/lib/workspace.js` (`savedProjectsRoot`, `workspaceRoot`), `server/lib/conversion.js` (`convertedDir`), and wherever `positions.json` is written, to read these.
   - Keep current defaults when env is unset so dev behavior is identical.
5. Support **port 0 / ephemeral port**: have `server/index.js` listen on `SERVER_PORT` where `0` = OS-assigned, and print/emit the chosen port (`server.address().port`) so the parent can read it.
6. Decouple "saved projects" from Vite's static `public/` serving: add a backend route to serve project files from `MOUNTLAB_DATA_DIR/projects` (the renderer currently loads `/projects/...` statically — in a packaged build there is no Vite static server, so these must go through `/api/model` or a new `/api/project-file` route).

### Phase 2 — Add the Electron shell
7. Add dev deps: `electron`, `electron-builder`. Add `electron/main.js`, `electron/preload.js`.
8. `main.js`: on app ready, pick a free port, `child_process.fork('server/index.js')` with env (`SERVER_PORT`, `SERVER_HOST=127.0.0.1`, `MOUNTLAB_DATA_DIR=app.getPath('userData')`, `PYTHON_CMD`, `FREECAD_CMD`), wait for `/api/health` 200, then create the `BrowserWindow` and `loadFile('dist/index.html')` (prod) or `loadURL(vite dev server)` (dev).
9. `preload.js`: `contextBridge.exposeInMainWorld('mountlab', { apiBase, openFile, saveFile, ... })`; set `window.__MOUNTLAB_API_BASE__`.
10. Lifecycle: kill the forked server on `window-all-closed`/`before-quit`; handle macOS re-activate.
11. Add scripts: `electron:dev` (Vite dev server + electron pointing at it) and `electron:build`.

### Phase 3 — Native integration
12. Application menu (File ▸ New/Open/Save/Export, Edit, View, Help) wired to existing actions via IPC.
13. Native dialogs: replace browser `<input type=file>`/download flows for project import and STEP/STL export with `dialog.showOpenDialog`/`showSaveDialog` (keep web flow as fallback for `npm run dev`).
14. Optional: tray icon, "open recent", OS notifications on long export completion.

### Phase 4 — CAD toolchain bundling / detection
15. Ship `server/*.py` as packaged resources (`extraResources` in electron-builder) and resolve their paths from `process.resourcesPath` in prod.
16. Python/CadQuery: either (a) bundle a relocatable Python with CadQuery as a resource, or (b) detect a system Python and show a guided setup if missing. **Recommend (b) for v1, (a) later.**
17. FreeCAD: detection + clear "FreeCAD required for STEP export/drilling" UX (the probing list in `server/lib/export.js:13-21` is macOS-only — add Windows paths like `C:\Program Files\FreeCAD *\bin\`).

### Phase 5 — Packaging, updates, CI
18. `electron-builder` config (Windows NSIS first). Code-sign later.
19. Auto-update via `electron-updater` (optional, needs a release host).
20. GitHub Actions matrix build (Windows first, then mac/linux).

### Phase 6 — Test, harden, document
21. Smoke tests (Playwright-for-Electron), packaging tests, update README.

---

# File-by-File / Folder-by-Folder Changes

### New files/folders
| Path | Purpose |
|---|---|
| `electron/main.js` | App entry: window, fork backend, port/env, menus, lifecycle, updater. |
| `electron/preload.js` | `contextBridge` API; injects `window.__MOUNTLAB_API_BASE__`. |
| `electron/menu.js` | Native application menu → IPC. |
| `electron/paths.js` | Resolve `userData` data dir + packaged resource paths. |
| `src/config/apiBase.js` | Single source of truth for the API base URL. |
| `build/` (icons) | `.ico`/`.icns`/`.png` for installers. |
| `electron-builder.yml` | Packaging config (appId, targets, `extraResources`). |
| `.github/workflows/desktop-build.yml` | CI desktop builds. |

### Modified files
| Path | Change | Why |
|---|---|---|
| `src/App.jsx:16` | Remove hardcoded `API_BASE`; import resolver. | Decouple from fixed port. |
| `src/components/AssemblyModel.jsx:5` | Same. | Same. |
| `src/hooks/useAssembly.js:24` (+ `:2121` SSE, `/projects/...` loads) | Same; route project-file loads through API in packaged mode. | No Vite static server in prod. |
| `server/index.js:14` | Allow ephemeral port (`SERVER_PORT=0`) and report chosen port to parent. | Avoid port clashes; hidden backend. |
| `server/index.js:17-25` | Keep CORS for dev; in Electron prod the origin is `file://`/`app://` — allow it or move to IPC. | Packaged renderer isn't `localhost:517x`. |
| `server/lib/workspace.js` | `savedProjectsRoot`/`workspaceRoot` from `MOUNTLAB_DATA_DIR`. | Installed folder is read-only; tmp is wrong for saved projects. |
| `server/lib/conversion.js` | `convertedDir` under data dir; script path via resources. | Writable cache + packaged script. |
| `server/lib/export.js:13-21` | Add Windows FreeCAD paths; resolve `export.py` from resources; honor `FREECAD_CMD`. | Currently macOS-only. |
| `server/lib/drill.js` | Resolve `drill.py` from resources. | Packaged script path. |
| `server/lib/paths.js` | Default `ALLOWED_DIRS` to the data dir in packaged mode. | Safer default sandbox. |
| `package.json` | Add `main: electron/main.js`, electron scripts, `electron`/`electron-builder` dev deps, `build` config or point to `electron-builder.yml`. | Make it an Electron app. |
| `index.html` | Add a strict CSP `<meta>` for packaged mode. | Renderer hardening. |
| `vite.config.js` | Set `base: './'` so `dist` assets load over `file://`. | Relative asset paths in packaged build. |
| `.gitignore` | Add `dist-electron/`, `release/`, `out/`. | Ignore build artifacts. |
| `README.md` | Document desktop build/run. | Onboarding. |

### Unchanged (intentionally)
- `src/config/assemblyObjects.js`, `chassisComponents.js`, `materialDefinitions.js`, `productOptions.js`, `rackPresets.js` — pure data, fully portable.
- `server/convert.py`, `server/export.py`, `server/drill.py` — logic unchanged; only how they're located/invoked changes.
- All `src/components/*` rendering code (besides the API base import).

---

# Data and Storage Plan

Move every writable location out of the install directory into the per-user app-data folder (`app.getPath('userData')`, e.g. `%APPDATA%/mountlab` on Windows, `~/Library/Application Support/mountlab` on macOS), exposed to the backend as `MOUNTLAB_DATA_DIR`:

| Today | Target |
|---|---|
| `<repo>/public/projects/<slug>/` | `MOUNTLAB_DATA_DIR/projects/<slug>/` |
| `os.tmpdir()/mountlab-workspaces/<id>/` | `MOUNTLAB_DATA_DIR/workspaces/<id>/` (or keep in OS temp — fine since they're scratch) |
| `server/converted/*.stl` | `MOUNTLAB_DATA_DIR/cache/converted/*.stl` |
| `server/positions.json` | `MOUNTLAB_DATA_DIR/positions.json` |
| `<name>.export-<hash>.step` next to source | keep next to source STL (already user-chosen location) |

- **No SQLite needed.** The data model is files (STL/STEP/glTF) + small JSON sidecars (`assembly.json`, `positions.json`). A relational DB adds nothing. If a project *index* is later wanted (recent list, search), add a single `projects.json` or a tiny SQLite (`better-sqlite3`) — not required for v1.
- **Bundled sample data:** ship `public/projects/tamburi/` as a read-only template under resources and copy it into `MOUNTLAB_DATA_DIR/projects` on first run.
- **IndexedDB:** not recommended — geometry already lives as files the backend and FreeCAD/CadQuery must read directly; IndexedDB would trap data inside the renderer.

---

# Security Considerations

- **Renderer hardening (Electron):** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` where possible, all Node access via `preload` `contextBridge`. Never expose `fs`/`child_process` to the renderer.
- **CSP:** add a strict `Content-Security-Policy` (no remote scripts; `connect-src` limited to the loopback backend). The app is offline, so this can be tight.
- **Loopback only:** keep `SERVER_HOST=127.0.0.1`; never bind `0.0.0.0`. Consider a per-launch random token header so other local processes can't call the API.
- **Path traversal:** the existing guards in `server/lib/paths.js` (null-byte, `..`, absolute-only, `ALLOWED_DIRS`) are good — **tighten the default**: in packaged mode default `ALLOWED_DIRS` to `MOUNTLAB_DATA_DIR` + the user's chosen open/save folders rather than "allow all when empty."
- **Subprocess safety:** `convert.py`/`export.py`/`drill.py` are invoked with array args (no shell) — keep it that way; never interpolate user input into a shell string.
- **Bundled binaries:** if shipping Python/FreeCAD, pin versions and verify checksums; these expand the attack/CVE surface — document update responsibility.
- **Code signing:** sign Windows (Authenticode) and macOS (notarization) before public distribution to avoid SmartScreen/Gatekeeper blocks.

---

# Packaging and Distribution Plan

**Windows first** (primary target):
1. `electron-builder` with NSIS target → `mountlab Setup x.y.z.exe` (per-user install, no admin needed).
2. `extraResources`: `server/**` (incl. `*.py`), sample projects, and optionally a bundled Python+CadQuery.
3. App icon `build/icon.ico`.
4. Output to `release/`.
5. Code-sign with an Authenticode certificate (defer until first public release; unsigned is fine for internal testing but triggers SmartScreen).

**Commands (target state):**
```
npm run build            # vite build -> dist/
npm run electron:build   # electron-builder --win  (then --mac / --linux)
```

**macOS / Linux (optional, later):** `.dmg` (notarized) and `AppImage`/`.deb`. Watch the FreeCAD/CadQuery bundling story per-OS; this is the dominant cross-platform cost, not Electron itself.

---

# Testing Plan

- **Unit (JS):** add Vitest for `src/config/*` geometry helpers (e.g. `getAssemblyObjectClass`, dimension math) and the new `apiBase` resolver. None today — start here, they're pure functions.
- **Backend integration:** spin up `server/index.js` on an ephemeral port and hit `/api/health`, `/api/model`, `/api/convert`, `/api/export`, `/api/workspace/*` with fixture STL/STEP from `public/projects/tamburi/`. Use mocked/fake Python for CI where CadQuery/FreeCAD aren't installed; mark real-toolchain tests as a separate, locally-run suite.
- **Desktop smoke (E2E):** Playwright with Electron support — launch the packaged/dev app, assert the window loads, backend health passes, a model renders (canvas present), and a STEP export round-trips.
- **Packaging tests:** after `electron:build`, install the artifact in a clean Windows VM, launch, create a project, export STEP — verify writable data dir and graceful messaging when FreeCAD is absent.
- **Migration safety:** keep `npm run dev` green at every phase; CI runs lint (`npm run lint`) + unit + backend integration on each PR.

---

# Risks and Open Questions

1. **Python/CadQuery + FreeCAD distribution** — the single biggest risk. Bundle (large download, licensing review) vs. require the user to install (smaller app, friction)? Decision needed before Phase 4.
2. **STEP quality** — current export is mesh-derived (`makeShapeFromMesh`), not true B-rep. Is faithful machinable STEP a requirement? If yes, that's a separate geometry-engine workstream (model in CadQuery as solids) independent of desktop packaging.
3. **FreeCAD path probing is macOS-only** (`server/lib/export.js`) — Windows paths must be added; confirm supported FreeCAD versions.
4. **Saved projects served via Vite static `/projects/...`** — must be rerouted through the API for packaged builds; audit every `/projects/...` and `/models/...` reference in the renderer.
5. **Licensing** — FreeCAD (LGPL) and CadQuery (Apache-2.0) bundling terms must be reviewed for redistribution.
6. **Code-signing certs** — obtain Windows Authenticode (and Apple Developer ID if macOS) — procurement lead time.
7. **Target OS priority** — confirmed Windows-first? Any Linux requirement (affects Tauri vs Electron weighting)?
8. **App size budget** — is a ~150 MB+ installer (more with bundled Python/FreeCAD) acceptable? If hard-capped, revisit the Tauri fallback.

---

# Implementation Checklist

**Phase 0 — Decouple URL (shippable on its own)**
- [ ] Create `src/config/apiBase.js` (window-injected → env → localhost default).
- [ ] Replace `API_BASE` in `src/App.jsx:16`, `src/components/AssemblyModel.jsx:5`, `src/hooks/useAssembly.js:24`.
- [ ] Confirm `npm run dev` unchanged.

**Phase 1 — Backend packaging-safe**
- [ ] Add `MOUNTLAB_DATA_DIR` resolution; refactor `server/lib/workspace.js`, `conversion.js`, positions path.
- [ ] Support `SERVER_PORT=0` and report chosen port from `server/index.js`.
- [ ] Add API route to serve project files (replace static `/projects/...`).
- [ ] Update renderer to load project/model files via API in packaged mode.

**Phase 2 — Electron shell**
- [ ] `npm i -D electron electron-builder`.
- [ ] Add `electron/main.js`, `electron/preload.js`, `electron/paths.js`, `electron/menu.js`.
- [ ] Set `package.json` `main`, add `electron:dev` / `electron:build` scripts.
- [ ] `vite.config.js`: `base: './'`.
- [ ] Fork backend, wait for `/api/health`, load `dist/index.html`; kill backend on quit.
- [ ] Harden window (`contextIsolation`, no `nodeIntegration`), add CSP to `index.html`.

**Phase 3 — Native integration**
- [ ] Application menu → IPC actions.
- [ ] Native open/save dialogs for import + STEP/STL export.
- [ ] (Optional) notifications on long export completion.

**Phase 4 — CAD toolchain**
- [ ] `extraResources` for `server/*.py`; resolve script paths from `process.resourcesPath`.
- [ ] Python/CadQuery detect-or-bundle decision + guided-setup UX.
- [ ] Add Windows FreeCAD paths to `server/lib/export.js`; graceful "FreeCAD required" messaging.

**Phase 5 — Packaging / updates / CI**
- [ ] `electron-builder.yml` (Windows NSIS first); app icons in `build/`.
- [ ] `npm run electron:build` → installer in `release/`.
- [ ] (Optional) `electron-updater` + release host.
- [ ] `.github/workflows/desktop-build.yml` (Windows first, then mac/linux).

**Phase 6 — Test / docs**
- [ ] Vitest unit tests for `src/config/*` + `apiBase`.
- [ ] Backend integration tests (ephemeral port, tamburi fixtures, fake Python in CI).
- [ ] Playwright-Electron smoke test (window + health + render + export).
- [ ] Clean-VM install/packaging test on Windows.
- [ ] Update `README.md`; keep `npm run dev` green throughout.

---

## Summary Recommendation
Adopt **Electron** with the **existing Express backend forked as a hidden loopback child process** (primary), keeping **Tauri + Node sidecar** as the fallback only if installer size/RAM become hard constraints. The work is overwhelmingly *lifecycle management, filesystem-path relocation to a writable app-data dir, and CAD-toolchain bundling* — not a rewrite. Phase 0 (URL decoupling) and Phase 1 (packaging-safe paths) are independently shippable and de-risk the entire migration while keeping today's `npm run dev` workflow fully working.
