#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SS_DIR = ROOT / "SS"
PUZZLE_DIR = ROOT / "PUZZLE"
OUTPUT = SS_DIR / "index.json"


def read_clue_counts(clue_path: Path) -> tuple[int, int]:
    try:
        data = json.loads(clue_path.read_text(encoding="utf-8-sig"))
    except Exception:
        return 0, 0

    left = data.get("leftEntries") or [
        {"number": row.get("leftNumber"), "text": row.get("leftText")}
        for row in data.get("rows", [])
        if row.get("leftNumber")
    ]

    right = data.get("rightEntries") or [
        {"number": row.get("rightNumber"), "text": row.get("rightText")}
        for row in data.get("rows", [])
        if row.get("rightNumber")
    ]

    return len(left), len(right)


def find_solution_file(puzzle_id: str) -> str | None:
    if not PUZZLE_DIR.exists():
        return None

    for ext in ("gif", "png", "jpg", "jpeg", "webp"):
        candidate = PUZZLE_DIR / f"{puzzle_id}U.{ext}"
        if candidate.exists():
            return candidate.name
    return None


def build_index() -> dict:
    entries: dict[str, dict] = {}
    pattern = re.compile(r"^(\d+)(C)?\.(json|png|gif)$", re.IGNORECASE)

    for path in sorted(SS_DIR.iterdir()):
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
                "title": f"Sri Sri Puzzle {puzzle_id}",
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


def main() -> None:
    payload = build_index()
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUTPUT}")
    print(f"Latest complete puzzle: {payload['latestCompleteId']}")
    print(f"Total ids: {len(payload['puzzles'])}")


if __name__ == "__main__":
    main()
