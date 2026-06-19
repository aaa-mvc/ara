# ARA — click to rename in Obsidian, just like Windows File Explorer.

Click an already-active file in Obsidian's file explorer to rename it inline — just like Windows File Explorer.

![](https://img.shields.io/badge/version-1.0.0-blue)

## How it works

1. Click a file in the file explorer — opens it (default Obsidian behavior)
2. Click the **already-active** file again — triggers inline rename
3. Type the new name, press `Enter` — done

A smart cooldown prevents accidental rename when double-clicking to open.

## Installation

### Community Plugins (recommended)

1. Settings → Community Plugins → Browse → Search "Inline Rename"
2. Install and enable

### Manual

```bash
cd your-vault/.obsidian/plugins/
git clone https://github.com/aaa-mvc/ara.git
cd ara
```

### BRAT (Beta)

Add `aaa-mvc/ara` to BRAT plugin for automatic updates.

## Compatibility

- Requires Obsidian ≥ 0.15.0
- Works on desktop and mobile
- Supports both legacy and new tree-item file explorer DOM

## License

MIT
