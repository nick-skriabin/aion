# Aion

A minimal terminal calendar client.

## Quick Start

```bash
bun install
bun dev
```

## Navigation

Switch panes:
- h - Focus days sidebar (left)
- l - Focus timeline (right)  
- Tab - Toggle between panes

Within a pane:
- j / k - Move down/up
- gg - Jump to start
- G - Jump to end
- Enter - Select (days) / Open details (timeline)

Events:
- e - Edit
- D - Delete
- : - Command mode
- /new [title] - Create event

General:
- Esc - Close/cancel
- q - Quit

## Configuration

Create ~/.aion/config.toml to customize colors.

## Data

Events stored in ~/.aion/aion.db
