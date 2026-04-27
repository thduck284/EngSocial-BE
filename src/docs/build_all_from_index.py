# -*- coding: utf-8 -*-
"""Gộp use case vào all/ theo index.txt: khớp theo tiêu đề dòng « UC-1.x — … » hoặc « UC-2.x — … », đổi mã UC & tham chiếu chéo."""
from __future__ import annotations

import re
from pathlib import Path

DOCS = Path(__file__).resolve().parent
INDEX = DOCS / "index.txt"
SOURCES = [
    DOCS / "usecases-1.1-1.30.txt",
    DOCS / "usecases-1.31-1.60.txt",
    DOCS / "usecases-1.61-end.txt",
    DOCS / "usecases-1.63-study-group.txt",
]
OUT_DIR = DOCS / "all"
SEP = "=" * 88

# Dòng mục lục: UC-1.1–UC-1.4 (xác thực) và UC-2.1–UC-2.79 (phần còn lại, tương ứng UC-1.5–1.83 cũ).
INDEX_LINE = re.compile(r"^\s+UC-([12])\.(\d+)\s+—\s+(.+?)\s*$")
HEADER_OLD = re.compile(
    rf"^{re.escape(SEP)}\s*\n  UC-1\.(\d+)\s+—\s+([^\n]+?)\s*\n{re.escape(SEP)}\s*$",
    re.MULTILINE,
)
MA_ROW = re.compile(
    r"^\| Mã Use Case\s+\|\s*UC-1\.(\d+)\s*\|\s*$", re.MULTILINE
)


def parse_index(path: Path) -> list[tuple[int, int, str]]:
    """(major, minor, title) theo thứ tự dòng trong index."""
    out: list[tuple[int, int, str]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        m = INDEX_LINE.match(line)
        if m:
            out.append((int(m.group(1)), int(m.group(2)), m.group(3).strip()))
    return out


def split_blocks(text: str) -> list[str]:
    parts = re.split(rf"(?=\n{re.escape(SEP)}\n  UC-1\.\d+)", "\n" + text)
    return [p.lstrip("\n") for p in parts if p.strip() and "UC-1." in p[:200]]


def block_old_id_and_title(block: str) -> tuple[int, str | None]:
    m = HEADER_OLD.match(block)
    if not m:
        return (-1, None)
    return int(m.group(1)), m.group(2).strip()


def collect_blocks_by_header_title() -> dict[str, str]:
    """Khớp với index theo phần sau « UC-1.x — » (cùng dòng tiêu đề trong file gốc)."""
    by_title: dict[str, str] = {}
    for src in SOURCES:
        text = src.read_text(encoding="utf-8")
        for block in split_blocks(text):
            m = HEADER_OLD.match(block)
            if not m:
                continue
            title = m.group(2).strip()
            if title in by_title:
                raise SystemExit(f"Trùng tiêu đề UC trong nguồn: «{title}» ({src.name})")
            by_title[title] = block
    return by_title


def version_tuple(s: str) -> tuple[int, ...]:
    return tuple(int(x) for x in s.split("."))


def uc_label(major: int, minor: int) -> str:
    return f"UC-{major}.{minor}"


def remap_uc_refs(text: str, old_to_new: dict[str, tuple[int, int]]) -> str:
    keys = sorted(old_to_new.keys(), key=int, reverse=True)
    out = text
    for old in keys:
        maj, mino = old_to_new[old]
        pat = rf"UC-1\.{old}(?!\d)"
        out = re.sub(pat, uc_label(maj, mino), out)
    return out


def patch_header_and_ma(block: str, maj: int, mino: int, title: str) -> str:
    block = HEADER_OLD.sub(
        f"{SEP}\n  {uc_label(maj, mino)} — {title}\n{SEP}",
        block,
        count=1,
    )
    block = MA_ROW.sub(
        f"| Mã Use Case                                            | {uc_label(maj, mino)} |",
        block,
        count=1,
    )
    return block


def main() -> None:
    entries = parse_index(INDEX)
    if len(entries) != 83:
        raise SystemExit(f"index: mong đợi 83 UC, có {len(entries)}")

    by_title = collect_blocks_by_header_title()
    old_to_new: dict[str, tuple[int, int]] = {}

    for maj, mino, title in entries:
        if title not in by_title:
            raise SystemExit(
                f"Không tìm thấy UC trong nguồn (tiêu đề dòng UC-1.x — …): «{title}» ({uc_label(maj, mino)})"
            )
        raw = by_title[title]
        old_id, _h = block_old_id_and_title(raw)
        if old_id < 0:
            raise SystemExit(f"Không parse được header: {title}")
        old_to_new[str(old_id)] = (maj, mino)

    remapped_bodies: list[str] = []
    for maj, mino, title in entries:
        raw = by_title[title]
        body = remap_uc_refs(raw, old_to_new)
        body = patch_header_and_ma(body, maj, mino, title)
        remapped_bodies.append(body)

    banner = (
        f"{SEP}\n"
        "  Tệp sinh tự động — theo EngSocial-BE/src/docs/index.txt\n"
        "  Khớp nội dung theo tiêu đề dòng « UC-1.x — … » trong file nguồn; mã UC & tham chiếu theo mục lục (UC-1.1–UC-1.4 và UC-2.x).\n"
        f"{SEP}\n\n"
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # Chia theo thứ tự mục lục: 30 + 30 + 23 (giữ như trước khi đổi hệ số UC).
    ranges = [(0, 30), (30, 60), (60, 83)]
    names = ["usecases-1.1-1.30.txt", "usecases-1.31-1.60.txt", "usecases-1.61-1.83.txt"]
    for (lo, hi), name in zip(ranges, names):
        chunks = remapped_bodies[lo:hi]
        (OUT_DIR / name).write_text(
            banner + "\n\n".join(chunks) + "\n", encoding="utf-8"
        )

    print("OK:", OUT_DIR, "—", len(remapped_bodies), "UC")


if __name__ == "__main__":
    main()
