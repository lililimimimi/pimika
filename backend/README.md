# Pimika backend

The Python server of Pimika (FastAPI). It keeps chats, projects, settings and the list of models, and passes the work on to the bridge.

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
```

Python 3.11 or newer is needed.

## Run

```bash
.venv/bin/uvicorn app.main:app --port 8000
```

Then open the API docs at `http://localhost:8000/docs`. To run it with the whole app, use `bash scripts/start.sh` from the project root.

## Test and check

```bash
.venv/bin/python -m pytest tests -v
.venv/bin/mypy --strict app
.venv/bin/ruff check app tests
```

## Build the packaged backend

Used by the desktop installer. It creates `packaging/dist/pi-backend`, a single program that needs no Python:

```bash
.venv/bin/pyinstaller --noconfirm --onefile --name pi-backend --paths . \
  --distpath packaging/dist --workpath packaging/build --specpath packaging \
  packaging/run_backend.py
```

## Folders

- `app/api/` — the HTTP endpoints
- `app/config/` — settings, models, Pi login
- `app/sessions/` — saved chats and projects
- `app/services/` — the connection to the bridge and the chat stream
- `tests/` — tests
