#!/usr/bin/env python3
"""Verify reviewed text sources only. Never downloads or executes an installer/binary."""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

root = Path(__file__).resolve().parents[1]
lock = json.loads((root / 'docs/voip/upstream-lock.json').read_text())
repos = {'sipserver': 'sidhantjohnaind/sipserver', 'NetSIPCore': 'WildRogerr/NetSIPCore'}
assert lock['executionPermitted'] is False
for source in lock['sources']:
    assert len(source['commit']) == 40 and all(c in '0123456789abcdef' for c in source['commit'])
    for name, expected in source['files'].items():
        assert '..' not in name and not name.startswith('/')
        url = f"https://raw.githubusercontent.com/{repos[source['name']]}/{source['commit']}/{name}"
        with urlopen(url, timeout=30) as response:
            data = response.read(2 * 1024 * 1024)
        assert hashlib.sha256(data).hexdigest() == expected, 'Reviewed source checksum mismatch'
print('PASS: pinned upstream text checksums; live execution remains prohibited.')
