<p align="center">
  <img src="docs/images/logo.png" width="120" alt="Pimika logo">
</p>

<h1 align="center">Pimika</h1>

A coding assistant that runs on your own computer. Describe a task in plain language and it can read and write files in your project, run commands, and answer questions. You see each step before it happens, and you decide what goes ahead.

## Features

**Chat**

- Replies stream in as they are written. You can stop at any time, and the text written so far is kept.
- Tool calls (reading files, writing files, running commands) are grouped by turn. Expand one to see its arguments and result.
- You can edit a message and send it again, or regenerate a reply.
- Chats are saved on your computer, so they are still there after a page refresh or an app restart. You can rename and delete them.
- Images can be attached to a message.

**Changing files safely**

- Confirm before acting: before writing a file or running a risky command, the agent lists the steps it plans. Press **Continue** to go ahead, or **Cancel** to stop.
- Auto-edit mode: edits inside the project no longer ask one by one. Use it for tasks you trust.
- Allow this command from now on: tick the box on a confirmation card, and the same command in the same project will not ask again.
- See what changed: at the end of each turn, the reply lists the files it changed. Open one to see a line-by-line comparison of before and after (added lines in green, removed lines in red).

**Projects and files**

- You can add several project folders. Each project has its own chats.
- The file browser in the sidebar shows the files in your project. Open one to preview it on the right. The preview updates when the file changes.
- Project rules: you can write rules for a project or for everything, and they are added to the agent's instructions.

**Models and login**

- Several model providers are supported (see "Configuration" below). In Settings you can enter an API key, enable the models you need, and test the connection.
- You can sign in with a Claude.ai subscription (through the Pi CLI login). The login renews itself.
- The model you pick is saved by the backend, so the browser and the desktop window use the same choice.

**Desktop app**

- Built with Tauri as a Mac window. The window appears only after the backend and the bridge are ready.
- The backend uses a different random port on every start, and it requires a random secret. Only the app's own window can use it.

## Requirements

- macOS (so far it has only been tested on macOS)
- Node.js 22 (the exact version is in `.nvmrc`)
- Python 3.11 or newer
- For the desktop app: Rust (install the latest stable version with `rustup`) and the Xcode command line tools (`xcode-select --install`)

## Installation

Run these steps from the project root, `pimika/`.

```bash
# Backend (Python)
cd backend
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"

# Bridge (Node, calls the models)
cd ../pi-bridge
npm install

# Frontend (React)
cd ../frontend
npm install
```

## Running

There are two ways to run the app. **Do not run both at the same time**, because they use the same ports.

### Option 1: Web version (for development)

```bash
bash scripts/start.sh
```

The script starts the backend (port 8000), the bridge (port 3100) and the frontend (port 5173), then opens your browser. Press `Ctrl+C` to stop everything. Logs are saved in `logs/`.

### Option 2: Desktop app

```bash
cd frontend
npx tauri dev
```

The first build is slow (a few minutes). The app is ready when the window title says **Pimika**. Closing the window also stops the backend and the bridge.

The desktop app starts the bridge with the `node` found on your system. If your Node is not in the usual place, set the `PI_NODE` environment variable to point to it, for example `PI_NODE=$(which node) npx tauri dev`.

### Option 3: Install the desktop app (.dmg)

The installer packs the backend and the bridge inside the app, so you do **not** need to install Python or Node.

1. Build it (only needed once, or after code changes):

   ```bash
   cd frontend
   npx tauri build
   ```

   This needs Rust and the Xcode command line tools (see Requirements). The installer is created at `frontend/src-tauri/target/release/bundle/dmg/Pimika_0.1.0_aarch64.dmg`.

2. Open the `.dmg` and drag **Pimika** into the Applications folder.
3. The app is not signed by Apple, so the first time, **right-click Pimika and choose Open**, then click Open again in the dialog. After that it opens normally.

The installer works on Apple Silicon Macs only.

## First use

1. **Connect a model.** Open Settings (bottom left, "Settings"). Under Providers:
   - Click **Set** and enter the API key for a provider, or
   - sign in with a Claude.ai subscription.
2. **Enable models.** Under a provider, tick the models you want to use, then click **Test** to check the connection.
3. **Add a project.** Click the folder icon next to PROJECTS in the sidebar and choose a project folder.
4. **Start chatting.** Describe your task in the input box.

## Configuration and data

All of your data is kept on your own computer and is **not** stored in the repository. It lives in `~/.pi/agent/`:

| File                     | Contents                                                        |
| ------------------------ | --------------------------------------------------------------- |
| `config.json`            | Provider settings, API keys, enabled models, the selected model |
| `auth.json`              | Pi / Claude.ai login information                                |
| `sessions/`              | Chat history                                                    |
| `projects.json`          | The list of projects                                            |
| `approved-commands.json` | Commands marked "allow from now on", per project                |

To start fresh, delete these files (make a backup first).

## How it works

```
Browser page / desktop window
      │  HTTP + streaming (SSE)
      ▼
Backend (FastAPI, Python)  ──── keeps chats, projects and settings; checks the secret
      │
      ▼
Bridge (Node + TypeScript)  ──── calls the Pi SDK, runs tools, waits for your confirmation
      │
      ▼
Model providers (Claude, DeepSeek, OpenAI, Gemini, Ollama, and others)
```

- **Frontend:** React, TypeScript, Vite, Zustand, Tailwind.
- **Backend:** FastAPI. It handles data and the API, and is started by `scripts/start.sh` or by the desktop app.
- **Bridge:** a Node service that wraps `@earendil-works/pi-coding-agent` (the Pi SDK).
- **Desktop shell:** `frontend/src-tauri/`, a Tauri program written in Rust. It picks a random backend port, creates the secret, starts the backend and the bridge, shows the window once both are healthy, and stops them when the window closes.

## Security

- All services listen only on this computer (`127.0.0.1`). The bridge does not accept connections from other computers on your network.
- The backend accepts cross-origin requests only from the app's own pages. The desktop app also requires every request to carry the random secret, so other websites cannot use the backend or read its answers.
- The commands an agent runs have wide permissions. Only tick "allow from now on" for commands you understand.
- API keys are stored only in `~/.pi/agent/config.json` on your machine. Do not commit that file to git.

## Testing

```bash
# Backend
cd backend && .venv/bin/python -m pytest tests -v

# Bridge
cd pi-bridge && npm test

# Frontend (unit tests, type check, lint, format check)
cd frontend && npx vitest run && npx tsc --noEmit && npm run lint && npx prettier --check .

# Frontend end-to-end tests (install the Playwright browser first)
cd frontend && npx playwright install chromium && npx playwright test
```

GitHub Actions (`.github/workflows/ci.yml`) runs the backend, bridge, frontend and end-to-end tests on every push.

## Project structure

```
pimika/
├── backend/        FastAPI backend: API, chats, projects, configuration, logs
├── pi-bridge/      Node bridge: calls models, runs tools, asks for confirmation
├── frontend/       React frontend; src-tauri/ is the desktop shell
├── scripts/        start.sh: starts the web version in one command
└── .github/        CI configuration
```

## Known issues

- Generation speed depends on the provider and the model, and can be slow.
- Sometimes a model writes a tool call as plain text instead of actually calling the tool. In that case, trust the files on disk, not the reply.
- The change list only records edits made with the edit and write tools. Files the agent changes with bash commands (such as `sed -i` or `echo >`) do not appear in it.
- Only replies created after the fix keep their tool calls and change records. Older replies show no tool details after a refresh.
- The installer is not signed or notarized, so macOS asks you to open it with right-click the first time.
- The installer only works on Apple Silicon (arm64) Macs. It is about 250 MB installed, because it contains a Node runtime.
- The installed app does not read the `.pi/skills` folder of this repository (a development-time setting). Your global settings in `~/.pi/agent/` still work.
- It has only been tested on macOS.

## License

MIT License. See [LICENSE](LICENSE).
