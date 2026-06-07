#!/usr/bin/env python3
"""
Script to update latest.html with new puzzle
Run this locally before pushing to Git
"""

import os
from datetime import datetime

def update_latest_html():

    print("\n" + "=" * 50)
    print("Update Latest Puzzle")
    print("=" * 50)

    # Show available folders
    print("\nAvailable Folders:")
    print("1. 1EEEXPORTED")
    print("2. 2AJEXPORTED")
    print("3. 3SAEXPORTED")
    print("4. 4SSEXPORTED")
    print("5. 5HEXPORTED")

    # Get folder number
    choice = input("\nEnter folder number (1-5): ").strip()

    folders = {
        "1": "1EEEXPORTED",
        "2": "2AJEXPORTED",
        "3": "3SAEXPORTED",
        "4": "4SSEXPORTED",
        "5": "5HEXPORTED"
    }

    if choice not in folders:
        print("❌ Invalid folder selection!")
        input("\nPress Enter to exit...")
        return

    folder = folders[choice]

    # Default date = today (YYMMDD)
    default_date = datetime.now().strftime("%y%m%d")

    # Get puzzle date
    pdate = input(
        f"Enter puzzle date [{default_date}]: "
    ).strip()

    if pdate == "":
        # Enter pressed
        pdate = default_date

    elif len(pdate) == 2 and pdate.isdigit():
        # Day only (08 -> 260608)
        pdate = default_date[:4] + pdate

    elif len(pdate) == 4 and pdate.isdigit():
        # MMDD (0531 -> 260531)
        pdate = default_date[:2] + pdate

    elif len(pdate) == 6 and pdate.isdigit():
        # Full YYMMDD
        pass

    else:
        print("❌ Invalid date format!")
        print("Use DD, MMDD, or YYMMDD")
        input("\nPress Enter to exit...")
        return

    # Check if puzzle exists
    puzzle_path = os.path.join(folder, f"{pdate}.html")

    if not os.path.exists(puzzle_path):
        print(f"\n⚠️ Warning: {puzzle_path} does not exist!")

        proceed = input(
            "Continue anyway? (y/n): "
        ).strip().lower()

        if proceed != "y":
            print("Cancelled.")
            input("\nPress Enter to exit...")
            return

    # Generate latest.html content
    html_content = f"""<!DOCTYPE html>
<html>
<head>
<title>KVN Telugu Crossword</title>
<style>
body {{
    font-family: Arial, sans-serif;
    text-align: center;
    padding: 50px;
}}
</style>
</head>
<body>

<h3>Loading latest puzzle...</h3>

<script>
window.location.href = "./{folder}/{pdate}.html";
</script>

</body>
</html>"""

    # Write latest.html
    try:

        with open("latest.html", "w", encoding="utf-8") as f:
            f.write(html_content)

        print("\n✅ Success!")
        print(f"📝 Updated latest.html to point to:")
        print(f"   {folder}/{pdate}.html")

        print("\nNext steps:")
        print("1. Test latest.html")
        print("2. Commit")
        print("3. Push")

    except Exception as e:
        print(f"❌ Error writing file: {e}")

    input("\nPress Enter to exit...")


if __name__ == "__main__":

    try:
        update_latest_html()

    except KeyboardInterrupt:
        print("\n\nCancelled by user.")
        input("\nPress Enter to exit...")

    except Exception as e:
        print(f"\n❌ Error: {e}")
        input("\nPress Enter to exit...")