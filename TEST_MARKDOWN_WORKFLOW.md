# Test Markdown File

This is a test file to demonstrate the **Filesystem MCP + git workflow** for `.md` files.

## Operations Demonstrated

| Operation | Tool | Description |
|-----------|------|-------------|
| Read | `read_file` / `read` | Read .md file content |
| Write | `write_file` / `write` | Create new .md file |
| Edit | `edit_file` / `edit` | Modify existing .md file |
| Search | `grep` / `search_files` | Search content in .md files |
| Git Log | `git log` | History of .md files |
| Git Diff | `git diff` | Changes in .md files |

## Filesystem MCP Config

Created two config files:
1. `.mcp.json` - For Claude Code
2. `~/.codex/config.toml` - For Codex

Both point to `@modelcontextprotocol/server-filesystem` with project directory access.

## Git Integration

Using `git-master` skill for proper atomic commits:

```bash
# Find .md files
git ls-files '*.md'

# Search in .md files
git grep "pattern" -- '*.md'

# History of .md files
git log --oneline -- '*.md'

# Commit with proper style (detected from repo)
git add file.md
git commit -m "docs: add test markdown file"
```

---

*Generated via Filesystem MCP + git-master workflow*