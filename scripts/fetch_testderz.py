"""Download testderz prosecutor (pu) pages and extract question→answer pairs."""
from __future__ import annotations

import html as html_lib
import json
import re
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "data"
RAW = ROOT / "testderz_raw"
RAW.mkdir(parents=True, exist_ok=True)

# Known section pages under /pu/
URLS = {
    "ekpl": "https://testderz.com/pu/ekzpl/",
    "anticor": "https://testderz.com/pu/anticoruption/",
    "kku": "https://testderz.com/pu/kk/",
    "kpku": "https://testderz.com/pu/kpk/",
    "kvk": "https://testderz.com/pu/kvk/",
    "nabu": "https://testderz.com/pu/nabu/",
    "ethics": "https://testderz.com/pu/ethics/",
    "prokuratura": "https://testderz.com/pu/prokuratura/",
    "sud": "https://testderz.com/pu/sud/",
    "konstytucia": "https://testderz.com/pu/konstytucia/",
    "konstitucia": "https://testderz.com/pu/konstitucia/",
    "constitution": "https://testderz.com/pu/constitution/",
}


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_td = False
        self.cur: list[str] = []
        self.row: list[str] = []
        self.rows: list[list[str]] = []

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        elif tag == "td":
            self.in_td = True
            self.cur = []
        elif tag == "br" and self.in_td:
            self.cur.append(" ")

    def handle_endtag(self, tag):
        if tag == "td" and self.in_td:
            text = html_lib.unescape("".join(self.cur))
            text = re.sub(r"\s+", " ", text).strip()
            self.row.append(text)
            self.in_td = False
            self.cur = []
        elif tag == "tr" and self.row:
            self.rows.append(self.row)

    def handle_data(self, data):
        if self.in_td:
            self.cur.append(data)


def fetch(url: str) -> str | None:
    req = urllib.request.Request(
        url, headers={"User-Agent": "Mozilla/5.0 (compatible; brother-testing/1.0)"}
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            if resp.status >= 400:
                return None
            return resp.read().decode("utf-8", errors="replace")
    except Exception as exc:  # noqa: BLE001
        print("FAIL", url, exc)
        return None


def parse_pairs(category: str, content: str) -> list[dict]:
    p = TableParser()
    p.feed(content)
    pairs = []
    for row in p.rows:
        if len(row) < 2 or not row[0] or not row[1]:
            continue
        q, a = row[0], row[1]
        if q.lower().startswith("питання") or "---" in q:
            continue
        q2 = re.sub(r"^\d+\)\s*", "", q).strip()
        a2 = re.sub(r"^\d+\)\s*", "", a).strip()
        if q2 and a2:
            pairs.append(
                {
                    "category": category,
                    "question": q2,
                    "answer": a2,
                    "raw_q": q,
                    "raw_a": a,
                }
            )
    return pairs


def extract_pu_links(index_html: str) -> list[str]:
    hrefs = re.findall(r'href=["\'](https?://testderz\.com/pu/[^"\'?#]+/?)["\']', index_html)
    hrefs += re.findall(r'href=["\'](/pu/[^"\'?#]+/?)["\']', index_html)
    out = []
    for h in hrefs:
        if h.startswith("/"):
            h = "https://testderz.com" + h
        if h.rstrip("/") == "https://testderz.com/pu":
            continue
        slug = h.rstrip("/").split("/")[-1]
        if not re.fullmatch(r"[a-zA-Z0-9_\-]+", slug):
            continue
        out.append(h if h.endswith("/") else h + "/")
    return sorted(set(out))


def main() -> None:
    index = fetch("https://testderz.com/pu/")
    discovered = {}
    if index:
        (RAW / "index.html").write_text(index, encoding="utf-8")
        for url in extract_pu_links(index):
            slug = url.rstrip("/").split("/")[-1]
            discovered[slug] = url
        print("discovered links", len(discovered), sorted(discovered))

    urls = dict(URLS)
    urls.update(discovered)
    # drop placeholder / bad keys from URLS that aren't real slugs
    urls = {
        k: v
        for k, v in urls.items()
        if re.fullmatch(r"[a-zA-Z0-9_\-]+", k)
    }

    all_pairs: list[dict] = []
    for cat, url in sorted(urls.items()):
        content = fetch(url)
        if not content:
            print(cat, "skip")
            continue
        (RAW / f"{cat}.html").write_text(content, encoding="utf-8")
        pairs = parse_pairs(cat, content)
        print(cat, "bytes", len(content), "pairs", len(pairs))
        all_pairs.extend(pairs)

    out = ROOT / "testderz_answers.json"
    out.write_text(json.dumps(all_pairs, ensure_ascii=False, indent=2), encoding="utf-8")
    print("TOTAL", len(all_pairs), "->", out)


if __name__ == "__main__":
    main()
