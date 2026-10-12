# Pimika bridge

A small Node service that sits between the backend and the Pi SDK. It calls the models, runs the tools (read, write, edit, bash), and waits for your confirmation before risky steps.

## Setup

```bash
npm install
```

## Run

```bash
npm run dev          # development, restarts when the code changes; port 3100
```

The port can be changed with `PI_BRIDGE_PORT`. It listens only on `127.0.0.1`.

## Test

```bash
npm test
npx tsc --noEmit
```

## Build the packaged bridge

Used by the desktop installer. It creates `packaging/dist/bridge/`, which contains the bundled code, the production packages and a copy of Node:

```bash
bash packaging/build-bridge.sh
```

## Folders

- `src/routes/` — the HTTP endpoints (chat, preview, models, providers)
- `src/` — tools, confirmation, approvals, file changes, models
- `server.ts` — the entry point
