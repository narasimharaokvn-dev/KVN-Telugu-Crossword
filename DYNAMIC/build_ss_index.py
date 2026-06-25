#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCES_PATH = ROOT / "sources.json"
PUZZLE_DIR = ROOT / "PUZZLE"
FOLDER_TITLES = {
    "AJ": "AJ",
    "SA": "SA",
    "HI": "HI",
    "EE": "EE",
    "SS": "Sri Sri",
    "GN": "GN",
}


def read_clue_counts(clue_path: Path) -> tuple[int, int]:
    try:
        data = json.loads(clue_path.read_text(encoding="utf-8-sig"))
    except Exception:
        return 0, 0

    across = data.get("crossEntries") or data.get("leftEntries") or [
        {
            "number": row.get("crossNumber", row.get("leftNumber")),
            "text": row.get("crossText", row.get("leftText")),
        }
        for row in data.get("rows", [])
        if row.get("crossNumber", row.get("leftNumber"))
    ]

    down = data.get("downEntries") or data.get("rightEntries") or [
        {
            "number": row.get("downNumber", row.get("rightNumber")),
            "text": row.get("downText", row.get("rightText")),
        }
        for row in data.get("rows", [])
        if row.get("downNumber", row.get("rightNumber"))
    ]

    return len(across), len(down)


def find_solution_file(puzzle_id: str) -> str | None:
    if not PUZZLE_DIR.exists():
        return None

    for ext in ("gif", "png", "jpg", "jpeg", "webp"):
        candidate = PUZZLE_DIR / f"{puzzle_id}U.{ext}"
        if candidate.exists():
            return candidate.name
    return None


def load_sources() -> dict:
    if not SOURCES_PATH.exists():
        return {"folders": []}
    return json.loads(SOURCES_PATH.read_text(encoding="utf-8-sig"))


def resolve_title(folder_id: str, folder_title: str | None) -> str:
    return (folder_title or FOLDER_TITLES.get(folder_id) or folder_id).strip()


def build_index(folder_id: str, folder_title: str | None = None) -> dict:
    folder_dir = ROOT / folder_id
    entries: dict[str, dict] = {}
    pattern = re.compile(r"^(\d+)(C)?\.(json|png|gif|jpe?g|webp)$", re.IGNORECASE)
    title_prefix = resolve_title(folder_id, folder_title)

    if not folder_dir.exists():
        return {
            "latestCompleteId": None,
            "puzzles": [],
        }

    for path in sorted(folder_dir.iterdir()):
        if not path.is_file():
            continue

        match = pattern.match(path.name)
        if not match:
            continue

        puzzle_id, clue_flag, ext = match.groups()
        item = entries.setdefault(
            puzzle_id,
            {
                "id": puzzle_id,
                "title": f"{title_prefix} Puzzle {puzzle_id}",
                "imageFile": None,
                "gridFile": None,
                "clueFile": None,
                "solutionFile": None,
                "acrossCount": 0,
                "downCount": 0,
                "complete": False,
            },
        )

        if clue_flag:
            item["clueFile"] = path.name
            across_count, down_count = read_clue_counts(path)
            item["acrossCount"] = across_count
            item["downCount"] = down_count
        elif ext.lower() == "json":
            item["gridFile"] = path.name
        else:
            item["imageFile"] = path.name

    latest_complete = None
    puzzles = []
    for puzzle_id in sorted(entries.keys(), reverse=True):
        item = entries[puzzle_id]
        item["solutionFile"] = find_solution_file(puzzle_id)
        item["complete"] = bool(item["imageFile"] and item["gridFile"] and item["clueFile"])
        if item["complete"] and latest_complete is None:
            latest_complete = item["id"]
        puzzles.append(item)

    return {
        "latestCompleteId": latest_complete,
        "puzzles": puzzles,
    }


def build_targets() -> list[tuple[str, str | None, Path]]:
    sources = load_sources()
    configured = []
    for folder in sources.get("folders", []):
        folder_id = folder.get("id")
        index_path = folder.get("index")
        if not folder_id or not index_path:
            continue
        configured.append((folder_id, folder.get("title"), ROOT / index_path))

    if len(sys.argv) > 1:
        requested = {value.strip().upper() for value in sys.argv[1:] if value.strip()}
        return [item for item in configured if item[0].upper() in requested]

    return configured


def main() -> None:
    targets = build_targets()
    if not targets:
        print("No folder targets found in sources.json")
        return

    for folder_id, folder_title, output_path in targets:
        payload = build_index(folder_id, folder_title)
        output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Wrote {output_path}")
        print(f"Latest complete puzzle in {folder_id}: {payload['latestCompleteId']}")
        print(f"Total ids in {folder_id}: {len(payload['puzzles'])}")


if __name__ == "__main__":
    main()
