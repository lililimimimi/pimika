"""
Entry point of the packaged backend. The desktop app starts this program with a port number.

    pi-backend --port 8123

It serves the same FastAPI app as `uvicorn app.main:app`, but as one program that does not need
a Python installation or a virtual environment.
"""

from __future__ import annotations

import argparse

import uvicorn

from app.main import app


def main() -> None:
    parser = argparse.ArgumentParser(description="PI backend")
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()
    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
