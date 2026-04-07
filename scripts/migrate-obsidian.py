#!/usr/bin/env python3
"""Migrate Obsidian Zettelkasten at /home/nidal/Zettlekasten into the app's SQLite DB."""

import re, sqlite3, uuid
from datetime import datetime
from pathlib import Path

VAULT = Path("/home/nidal/Zettlekasten")
DB_PATH = Path.home() / ".config/com.zettelkasten.app/zettelkasten.db"
NS = uuid.NAMESPACE_URL  # deterministic UUIDs → idempotent re-runs


def make_id(kind, title):
    return str(uuid.uuid5(NS, f"{kind}:{title}"))


def parse_frontmatter(text):
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    fm = {}
    for line in parts[1].strip().splitlines():
        if ":" in line and not line.startswith(" ") and not line.startswith("-"):
            k, _, v = line.partition(":")
            fm[k.strip()] = v.strip()
    return fm, parts[2].strip()


def split_connections(body):
    m = re.search(r"\n---\s*\n## Connections|\n## Connections", body)
    if m:
        return body[: m.start()].strip(), body[m.end() :]
    return body.strip(), ""


def extract_wikilinks(text):
    return [l.split("|")[0].strip() for l in re.findall(r"\[\[([^\]]+)\]\]", text)]


def date_to_ms(s):
    try:
        return int(datetime.strptime(s.strip(), "%Y-%m-%d").timestamp() * 1000)
    except:
        return int(datetime.now().timestamp() * 1000)


def map_source_type(raw):
    return {
        "video": "video",
        "article": "article",
        "book": "book",
        "podcast": "podcast",
        "conversation": "conversation",
    }.get(raw.lower().strip(), "other")


def main():
    con = sqlite3.connect(str(DB_PATH))
    cur = con.cursor()

    # Clear existing migrated data (idempotent re-run)
    cur.execute("DELETE FROM note_links")
    cur.execute("DELETE FROM notes")
    cur.execute("DELETE FROM sources")

    now_ms = int(datetime.now().timestamp() * 1000)

    # 1. Sources + Literature notes
    # Each Sources/*.md becomes:
    #   - a sources record (metadata from frontmatter)
    #   - a literature note (body content), linked to that source, processed_at set
    source_title_to_id = {}
    lit_note_title_to_id = {}  # source title → literature note id (for connections)
    lit_note_connections = {}  # lit note id → [wikilink targets]

    for path in sorted((VAULT / "Sources").glob("*.md")):
        title = path.stem
        fm, body = parse_frontmatter(path.read_text(encoding="utf-8"))
        content, conn_sec = split_connections(body)
        ts = date_to_ms(fm.get("created", ""))

        # Source record
        sid = make_id("source", title)
        source_title_to_id[title] = sid
        cur.execute(
            "INSERT OR IGNORE INTO sources (id,type,label,description,created_at) VALUES (?,?,?,?,?)",
            (
                sid,
                map_source_type(fm.get("source-type", "")),
                title,
                fm.get("author", "").strip() or None,
                ts,
            ),
        )

        # Literature note (body = the actual notes taken while consuming the source)
        nid = make_id("literature", title)
        lit_note_title_to_id[title] = nid
        lit_note_connections[nid] = extract_wikilinks(conn_sec)
        cur.execute(
            "INSERT OR IGNORE INTO notes "
            "(id,type,title,content,created_at,updated_at,source_id,processed_at) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (nid, "literature", title, content, ts, ts, sid, ts),
        )
        print(f"  source + literature note: {title}")

    # 2. Permanent notes
    note_title_to_id = {}
    note_connections = {}
    for path in sorted((VAULT / "Notes").glob("*.md")):
        title = path.stem
        fm, body = parse_frontmatter(path.read_text(encoding="utf-8"))
        content, conn_sec = split_connections(body)
        nid = make_id("note", title)
        note_title_to_id[title] = nid
        note_connections[nid] = extract_wikilinks(conn_sec)
        ts = date_to_ms(fm.get("created", ""))
        cur.execute(
            "INSERT OR IGNORE INTO notes "
            "(id,type,title,content,created_at,updated_at,own_words_confirmed) "
            "VALUES (?,?,?,?,?,?,1)",
            (nid, "permanent", title, content, ts, ts),
        )
        print(f"  note: {title}")

    # 3. Fleeting notes
    fleeting_count = 0
    for path in sorted((VAULT / "Inbox").glob("*.md")):
        title = path.stem
        fm, body = parse_frontmatter(path.read_text(encoding="utf-8"))
        content, _ = split_connections(body)
        nid = make_id("fleeting", title)
        ts = date_to_ms(fm.get("created", ""))
        cur.execute(
            "INSERT OR IGNORE INTO notes "
            "(id,type,title,content,created_at,updated_at) "
            "VALUES (?,?,?,?,?,?)",
            (nid, "fleeting", title, content, ts, ts),
        )
        fleeting_count += 1
        print(f"  fleeting: {title}")

    # 4. Links
    # permanent → permanent (from Notes/ connections)
    # literature → permanent (from Sources/ connections)
    links = 0

    for from_id, targets in note_connections.items():
        for t in targets:
            to_id = note_title_to_id.get(t)
            if to_id and to_id != from_id:
                cur.execute(
                    "INSERT OR IGNORE INTO note_links (from_note_id,to_note_id,created_at) VALUES (?,?,?)",
                    (from_id, to_id, now_ms),
                )
                links += 1

    for from_id, targets in lit_note_connections.items():
        for t in targets:
            to_id = note_title_to_id.get(t)
            if to_id:
                cur.execute(
                    "INSERT OR IGNORE INTO note_links (from_note_id,to_note_id,created_at) VALUES (?,?,?)",
                    (from_id, to_id, now_ms),
                )
                links += 1

    con.commit()
    con.close()
    print(
        f"\nDone: {len(note_title_to_id)} permanent, {len(source_title_to_id)} sources, "
        f"{len(source_title_to_id)} literature, {fleeting_count} fleeting, {links} links."
    )


if __name__ == "__main__":
    main()
