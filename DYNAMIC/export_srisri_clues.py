from __future__ import annotations

import json
from pathlib import Path

from openpyxl import load_workbook


WORKBOOK_PATH = Path(__file__).with_name("SriSri_Puzzle_Counts_TextRows.xlsm")
OUTPUT_DIR = Path(__file__).with_name("SS")


def normalize_value(value):
    if isinstance(value, str):
        value = value.strip()
        return value or None
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def row_to_record(row):
    values = [normalize_value(cell) for cell in row[:4]]
    while len(values) < 4:
        values.append(None)
    return {
        "leftNumber": values[0],
        "leftText": values[1],
        "rightNumber": values[2],
        "rightText": values[3],
    }


def has_content(record):
    return any(value is not None for value in record.values())


def build_sheet_payload(sheet_name, worksheet):
    row_records = []
    left_entries = []
    right_entries = []

    for row_index, row in enumerate(
        worksheet.iter_rows(values_only=True),
        start=1,
    ):
        record = row_to_record(row)
        if not has_content(record):
            continue

        row_records.append(record)

        if record["leftNumber"] is not None or record["leftText"] is not None:
            left_entries.append(
                {
                    "row": row_index,
                    "number": record["leftNumber"],
                    "text": record["leftText"],
                }
            )

        if record["rightNumber"] is not None or record["rightText"] is not None:
            right_entries.append(
                {
                    "row": row_index,
                    "number": record["rightNumber"],
                    "text": record["rightText"],
                }
            )

    return {
        "sheetName": sheet_name,
        "identity": f"{sheet_name}C",
        "rows": row_records,
        "leftEntries": left_entries,
        "rightEntries": right_entries,
    }


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)

    workbook = load_workbook(
        WORKBOOK_PATH,
        data_only=True,
        read_only=True,
        keep_vba=True,
    )

    created_files = []

    for sheet_name in workbook.sheetnames:
        worksheet = workbook[sheet_name]
        payload = build_sheet_payload(sheet_name, worksheet)
        output_path = OUTPUT_DIR / f"{sheet_name}C.json"
        output_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8-sig",
        )
        created_files.append(output_path.name)

    print(f"Created {len(created_files)} clue JSON files in {OUTPUT_DIR}")
    for name in created_files:
        print(name)


if __name__ == "__main__":
    main()
