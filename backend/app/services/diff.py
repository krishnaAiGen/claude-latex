import difflib


def compute_diff(old_content: str, new_content: str) -> list[dict]:
    old_lines = old_content.splitlines(keepends=True)
    new_lines = new_content.splitlines(keepends=True)

    differ = difflib.unified_diff(old_lines, new_lines, lineterm="")
    result = []
    current_line = 0

    for line in differ:
        if line.startswith("@@"):
            # Parse hunk header: @@ -start,count +start,count @@
            parts = line.split()
            new_range = parts[2]  # +start,count
            current_line = int(new_range.split(",")[0].lstrip("+"))
            continue
        if line.startswith("---") or line.startswith("+++"):
            continue

        if line.startswith("+"):
            result.append(
                {"type": "insert", "line": current_line, "content": line[1:]}
            )
            current_line += 1
        elif line.startswith("-"):
            result.append(
                {"type": "delete", "line": current_line, "content": line[1:]}
            )
        else:
            current_line += 1

    return result
