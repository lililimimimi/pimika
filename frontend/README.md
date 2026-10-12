# Pimika frontend

The user interface of Pimika: React, TypeScript, Vite, Zustand and Tailwind. It also contains the desktop shell in `src-tauri/` (Tauri, Rust).

## Setup

```bash
npm install
```

## Run

```bash
npm run dev          # web version at http://localhost:5173 (needs the backend and the bridge)
npx tauri dev        # desktop window in development mode
npx tauri build      # build the installer: src-tauri/target/release/bundle/dmg/
```

For the whole app, see the main [README](../README.md).

## Test and check

```bash
npx vitest run       # unit tests
npx tsc --noEmit     # type check
npm run lint         # lint (oxlint)
npx prettier --check .
npx playwright test  # end-to-end tests
```

## Folders

- `src/components/` — screens and widgets (chat, sidebar, settings, file browser)
- `src/stores/` — application state (Zustand)
- `src/services/api/` — calls to the backend
- `src-tauri/` — the desktop shell
