<p align="center">
  <img src="https://em-content.zobj.net/source/apple/391/calendar_1f4c5.png" width="120" height="120" alt="Aion">
</p>

<h1 align="center">Aion</h1>

<p align="center">
  <strong>Terminal calendar client with vim-style keybindings</strong><br>
  <em>Beautiful. Fast. Keyboard-driven.</em>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#keybindings">Keybindings</a> •
  <a href="#commands">Commands</a> •
  <a href="#configuration">Configuration</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Bun-1.0+-f9f1e1?logo=bun&logoColor=black" alt="Bun">
  <img src="https://img.shields.io/badge/TypeScript-First-3178c6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-Terminal-61dafb?logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="MIT License">
</p>

---

## Table of Contents

- [Why Aion?](#why-aion)
- [Quick Start](#quick-start)
- [Keybindings](#keybindings)
  - [Navigation](#navigation)
  - [Events](#events)
  - [General](#general)
- [Commands](#commands)
- [Configuration](#configuration)
  - [Theme](#theme)
- [Data Storage](#data-storage)
- [Tech Stack](#tech-stack)
- [Roadmap](#roadmap)

---

## Why Aion?

Most calendar apps are mouse-driven, slow, and cluttered. Aion takes a different approach:

**Vim-style navigation. Terminal-native. Zero distractions.**

### Features

| Feature | Description |
|---------|-------------|
| **⌨️ Vim Keybindings** | Navigate with `j`/`k`, `gg`/`G`, `h`/`l` — feels like home |
| **📅 Visual Timeline** | Day view with 15-minute precision and overlap handling |
| **🎨 Themeable** | Customize every color via TOML configuration |
| **💾 Local-First** | SQLite database, no cloud required, your data stays yours |
| **🔔 Notifications** | Track pending invites at a glance |
| **📝 Command Palette** | Quick access to all actions with fuzzy search |
| **❓ Context Help** | Press `?` anywhere to see available keybindings |
| **🚀 Fast** | Built with Bun and React — instant startup |

---

## Quick Start

### 1. Install Dependencies

```bash
git clone https://github.com/your-username/aion.git
cd aion
bun install
```

### 2. Run

```bash
bun dev
```

### 3. Navigate

Use `j`/`k` to move through events, `h`/`l` to switch panes, `Enter` to view details.

---

## Keybindings

### Navigation

| Key | Action |
|-----|--------|
| `h` / `l` | Switch between days sidebar and timeline |
| `Tab` | Toggle focus between panes |
| `j` / `↓` | Move down / Next item |
| `k` / `↑` | Move up / Previous item |
| `gg` | Jump to first item |
| `G` | Jump to last item |
| `n` | Jump to now (timeline only) |

### Events

| Key | Action |
|-----|--------|
| `Enter` / `Space` | Open event details |
| `e` | Edit event |
| `D` | Delete event |
| `Ctrl+N` | Create new event |

### Event Details

| Key | Action |
|-----|--------|
| `y` | Accept invitation |
| `n` | Decline invitation |
| `m` | Maybe / Tentative |
| `o` | Open meeting link |
| `e` | Edit event |
| `D` | Delete event |

### General

| Key | Action |
|-----|--------|
| `:` | Open command palette |
| `?` | Show help (context-aware) |
| `N` | Open notifications |
| `Esc` | Close overlay / Go back |
| `q` | Quit |

---

## Commands

Open the command palette with `:` and type a command:

| Command | Action |
|---------|--------|
| `new` | Create new event |
| `new <title>` | Create event with title |
| `edit` | Edit selected event |
| `delete` | Delete selected event |
| `help` | Show keybindings |
| `notifications` | Open notifications panel |
| `now` | Jump to current time |
| `quit` | Exit application |

Navigate with `↑`/`↓` or `Ctrl+P`/`Ctrl+N`, select with `Enter`.

---

## Configuration

Create `~/.aion/config.toml` to customize Aion:

### Theme

```toml
[theme]
# Accent colors
[theme.accent]
primary = "cyan"
secondary = "blue"
success = "green"
warning = "yellow"
error = "red"

# Text colors
[theme.text]
primary = "white"
secondary = "gray"
dim = "darkGray"

# Selection highlight
[theme.selection]
background = "blue"
text = "white"
indicator = "cyan"

# Event type colors
[theme.eventType]
default = "cyan"
focusTime = "blue"
outOfOffice = "magenta"
birthday = "yellow"

# Attendance status colors
[theme.status]
accepted = "green"
declined = "red"
tentative = "yellow"

# UI elements
[theme.modal]
background = "black"

[theme.input]
background = "black"

[theme.statusBar]
background = "black"
```

---

## Data Storage

All data is stored locally in `~/.aion/`:

| File | Description |
|------|-------------|
| `aion.db` | SQLite database with all events |
| `config.toml` | User configuration (theme, etc.) |

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Runtime** | [Bun](https://bun.sh) |
| **UI Framework** | [Glyph](https://github.com/nick-skriabin/glyph) (React for terminals) |
| **State Management** | [Jotai](https://jotai.org) |
| **Database** | SQLite via [Drizzle ORM](https://orm.drizzle.team) |
| **Date/Time** | [Luxon](https://moment.github.io/luxon) |
| **Validation** | [Zod](https://zod.dev) |

---

## Roadmap

- [ ] Google Calendar sync (OAuth)
- [ ] Week view
- [ ] Month view
- [ ] Recurring event expansion
- [ ] Multiple calendars
- [ ] Search / filtering
- [ ] Import/export (ICS)

---

## License

MIT © 2025

---

<p align="center">
  <sub>Built with ⌨️ for terminal lovers</sub>
</p>
