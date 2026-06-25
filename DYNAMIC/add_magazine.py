#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Add one magazine folder entry to DYNAMIC/sources.json."
    )
    parser.add_argument("code", help="Magazine code, for example EE or AJ")
    parser.add_argument(
        "--title",
        default=None,
        help="Optional display title. Defaults to the code.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    dynamic_dir = Path(__file__).resolve().parent
    sources_path = dynamic_dir / "sources.json"

    if not sources_path.exists():
        raise SystemExit(f"sources.json not found: {sources_path}")

    code = args.code.strip().upper()
    title = (args.title or code).strip()
    if not code:
        raise SystemExit("Magazine code cannot be blank")

    payload = json.loads(sources_path.read_text(encoding="utf-8-sig"))
    folders = payload.setdefault("folders", [])

    for folder in folders:
        if str(folder.get("id", "")).strip().upper() == code:
            print(f"Magazine {code} already exists in sources.json")
            return

    folders.append(
        {
            "id": code,
            "title": title,
            "index": f"{code}/index.json",
            "assetBase": f"{code}/",
            "solutionBase": "PUZZLE/",
        }
    )

    payload["folders"] = sorted(
        folders,
        key=lambda item: str(item.get("id", "")).upper(),
    )

    sources_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Added magazine {code} to {sources_path}")


if __name__ == "__main__":
    main()
