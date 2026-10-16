#!/usr/bin/env python3
"""Read public GitHub refs and approved technical documentation without cookies or API keys."""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

ALLOWED_HOSTS = {
    "github.com",
    "raw.githubusercontent.com",
    "docs.github.com",
    "docs.nvidia.com",
    "docs.python.org",
    "supabase.com",
    "docs.supabase.com",
    "vite.dev",
    "nodejs.org",
    "playwright.dev",
}
MAX_BYTES = 1_000_000
REPOSITORY = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")


def allowed_https_url(value: str):
    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("only public HTTPS URLs without embedded credentials are allowed")
    if parsed.hostname.lower() not in ALLOWED_HOSTS:
        raise ValueError(f"host is not on the public documentation allowlist: {parsed.hostname}")
    return parsed


class AllowedRedirects(HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        allowed_https_url(new_url)
        return super().redirect_request(request, response, code, message, headers, new_url)


class VisibleText(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.hidden_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() in {"script", "style", "noscript", "svg"}:
            self.hidden_depth += 1
        elif tag.lower() in {"p", "div", "li", "h1", "h2", "h3", "pre", "br"} and self.hidden_depth == 0:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in {"script", "style", "noscript", "svg"} and self.hidden_depth:
            self.hidden_depth -= 1
        elif tag.lower() in {"p", "div", "li", "h1", "h2", "h3", "pre"} and self.hidden_depth == 0:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self.hidden_depth == 0:
            self.parts.append(data)


def read_doc(url: str, max_bytes: int) -> int:
    allowed_https_url(url)
    opener = build_opener(AllowedRedirects())
    request = Request(url, headers={"User-Agent": "Codex-Public-Research/1.0", "Accept": "text/html,text/plain,text/markdown,application/json;q=0.9,*/*;q=0.1"})
    try:
        with opener.open(request, timeout=20) as response:
            final_url = response.geturl()
            allowed_https_url(final_url)
            data = response.read(max_bytes + 1)
            content_type = response.headers.get_content_type()
    except (HTTPError, URLError, TimeoutError) as error:
        print(f"ERROR: public documentation request failed: {error}", file=sys.stderr)
        return 1
    if len(data) > max_bytes:
        print(f"ERROR: response exceeded the {max_bytes}-byte limit", file=sys.stderr)
        return 1
    charset = response.headers.get_content_charset() or "utf-8"
    text = data.decode(charset, errors="replace")
    if content_type == "text/html":
        parser = VisibleText()
        parser.feed(text)
        text = "\n".join(line.strip() for line in "".join(parser.parts).splitlines() if line.strip())
    print(f"Source: {final_url}")
    print(f"Retrieved (UTC): {datetime.now(timezone.utc).date().isoformat()}")
    print(f"Content type: {content_type}; bytes: {len(data)}")
    print("---")
    print(text)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    repo = subparsers.add_parser("repo", help="resolve a public GitHub repository's HEAD commit")
    repo.add_argument("name", help="owner/repository")
    doc = subparsers.add_parser("doc", help="retrieve an allowlisted public technical documentation URL")
    doc.add_argument("url")
    doc.add_argument("--max-bytes", type=int, default=MAX_BYTES)
    args = parser.parse_args()

    try:
        if args.command == "repo":
            if not REPOSITORY.fullmatch(args.name) or ".." in args.name:
                raise ValueError("repository must use owner/repository form")
            url = f"https://github.com/{args.name}.git"
            result = subprocess.run(["git", "ls-remote", "--symref", url, "HEAD"], capture_output=True, text=True, check=True, timeout=20)
            print(f"Repository: https://github.com/{args.name}")
            print(result.stdout.strip())
            return 0
        if args.max_bytes < 1 or args.max_bytes > MAX_BYTES:
            raise ValueError(f"--max-bytes must be between 1 and {MAX_BYTES}")
        return read_doc(args.url, args.max_bytes)
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
