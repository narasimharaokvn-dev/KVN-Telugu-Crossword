#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import json
import re
from pathlib import Path


MIME_EXTENSIONS = {
    "image/png": "png",
    "image/gif": "gif",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract puzzle image, grid JSON, and clue JSON from an old combined export HTML."
    )
    parser.add_argument("html_file", help="Path to old exported HTML file")
    parser.add_argument(
        "--output-dir",
        default="extracted-from-html",
        help="Folder where extracted files should be written, relative to DYNAMIC unless absolute",
    )
    parser.add_argument(
        "--base-name",
        default=None,
        help="Optional file base name. Defaults to the HTML file stem.",
    )
    return parser.parse_args()


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def extract_assignment(source: str, name: str) -> str:
    pattern = rf"\blet\s+{re.escape(name)}\s*=\s*"
    match = re.search(pattern, source, re.DOTALL)
    if not match:
        raise ValueError(f"Could not find JavaScript assignment for {name}")

    index = match.end()
    while index < len(source) and source[index].isspace():
        index += 1

    if index >= len(source):
        raise ValueError(f"Could not read JavaScript value for {name}")

    start_char = source[index]
    if start_char == '"':
        end_index = scan_js_string(source, index)
        return source[index : end_index + 1]
    if start_char in "[{":
        end_index = scan_js_structure(source, index)
        return source[index : end_index + 1]

    semicolon = source.find(";", index)
    if semicolon == -1:
        raise ValueError(f"Could not find end of JavaScript assignment for {name}")
    return source[index:semicolon].strip()


def scan_js_string(source: str, start_index: int) -> int:
    escaped = False
    for index in range(start_index + 1, len(source)):
        char = source[index]
        if escaped:
            escaped = False
            continue
        if char == "\\":
            escaped = True
            continue
        if char == '"':
            return index
    raise ValueError("Unterminated JavaScript string")


def scan_js_structure(source: str, start_index: int) -> int:
    opener = source[start_index]
    closer = "]" if opener == "[" else "}"
    depth = 0
    in_string = False
    escaped = False

    for index in range(start_index, len(source)):
        char = source[index]
        if in_string:
            if escaped:
                escaped = False
                continue
            if char == "\\":
                escaped = True
                continue
            if char == '"':
                in_string = False
            continue

        if char == '"':
            in_string = True
            continue

        if char == opener:
            depth += 1
            continue

        if char == closer:
            depth -= 1
            if depth == 0:
                return index

    raise ValueError("Unterminated JavaScript array/object")


def extract_string_assignment(source: str, name: str) -> str:
    pattern = rf'\blet\s+{re.escape(name)}\s*=\s*"((?:[^"\\]|\\.)*)";'
    match = re.search(pattern, source, re.DOTALL)
    if not match:
        raise ValueError(f"Could not find quoted string assignment for {name}")
    try:
        return json.loads(f'"{match.group(1)}"')
    except json.JSONDecodeError as exc:
        raise ValueError(f"Could not parse string value for {name}: {exc}") from exc


def parse_js_json_like(source: str, name: str):
    value_text = extract_assignment(source, name)
    try:
        return json.loads(value_text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Could not parse {name} as JSON: {exc}") from exc


def parse_data_url(data_url: str) -> tuple[str, bytes]:
    match = re.fullmatch(r"data:([^;]+);base64,(.*)", data_url, re.DOTALL)
    if not match:
        raise ValueError("Could not parse puzzleImage data URL")

    mime_type = match.group(1).strip().lower()
    encoded = match.group(2).strip()
    try:
        data = base64.b64decode(encoded)
    except Exception as exc:
        raise ValueError("Could not decode puzzle image base64 data") from exc

    if mime_type not in MIME_EXTENSIONS:
        raise ValueError(f"Unsupported image type in puzzleImage: {mime_type}")

    return MIME_EXTENSIONS[mime_type], data


def build_clue_payload(raw_clues: dict) -> dict:
    across = raw_clues.get("across", {})
    down = raw_clues.get("down", {})

    across_entries = [
        {"number": int(number), "text": text}
        for number, text in sorted(across.items(), key=lambda item: int(item[0]))
    ]
    down_entries = [
        {"number": int(number), "text": text}
        for number, text in sorted(down.items(), key=lambda item: int(item[0]))
    ]

    return {
        "crossEntries": across_entries,
        "downEntries": down_entries,
    }


def ensure_output_dir(dynamic_dir: Path, output_dir_value: str) -> Path:
    output_dir = Path(output_dir_value)
    if not output_dir.is_absolute():
        output_dir = dynamic_dir / output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def main() -> None:
    args = parse_args()
    html_path = Path(args.html_file).resolve()
    dynamic_dir = Path(__file__).resolve().parent
    output_dir = ensure_output_dir(dynamic_dir, args.output_dir)
    base_name = args.base_name or html_path.stem

    source = read_text(html_path)

    puzzle_image_url = extract_string_assignment(source, "puzzleImage")
    row_lines = parse_js_json_like(source, "rowLines")
    col_lines = parse_js_json_like(source, "colLines")
    numbers = parse_js_json_like(source, "numbers")
    clues = parse_js_json_like(source, "clues")

    image_ext, image_bytes = parse_data_url(puzzle_image_url)
    image_path = output_dir / f"{base_name}.{image_ext}"
    grid_path = output_dir / f"{base_name}.json"
    clue_path = output_dir / f"{base_name}C.json"

    image_path.write_bytes(image_bytes)

    grid_payload = {
        "rowLines": row_lines,
        "colLines": col_lines,
        "cellNumbers": numbers,
    }
    grid_path.write_text(json.dumps(grid_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    clue_payload = build_clue_payload(clues)
    clue_path.write_text(json.dumps(clue_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Image written: {image_path}")
    print(f"Grid JSON written: {grid_path}")
    print(f"Clue JSON written: {clue_path}")


if __name__ == "__main__":
    main()
