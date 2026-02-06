# 🔮 Aion

A terminal-based Google Calendar client built with React and Glyph.

## Features

- **Day View** - Navigate days with a sidebar + timeline layout
- **Event Management** - Create, edit, and delete events with full form support
- **Google Calendar Compatible** - Data model follows GCal API shapes for easy future integration
- **Keyboard-Driven** - Vim-style navigation throughout
- **Local Persistence** - SQLite database stores your events locally
- **Configurable Theme** - Customize colors via TOML config file

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **UI**: React + [Glyph](https://www.npmjs.com/package/@nick-skriabin/glyph) (Terminal React renderer)
- **State**: Jotai
- **Database**: SQLite (bun:sqlite) + Drizzle ORM
- **Date/Time**: Luxon
- **Validation**: Zod

## Quick Start

```bash
# Install dependencies
bun install

# Run the app
bun dev
```

## Configuration

Create `~/.aion/config.toml` to customize colors:

```toml
# Aion Configuration

[theme.bg]
primary = "black"
secondary = "black"
selected = "blue"
hover = "blackBright"

[theme.text]
primary = "white"
secondary = "whiteBright"
dim = "blackBright"

[theme.accent]
primary = "cyan"
success = "green"
warning = "yellow"
error = "red"

[theme.eventType]
default = "cyan"
outOfOffice = "magenta"
focusTime = "blue"
birthday = "yellow"

[theme.border]
normal = "blackBright"
focus = "cyan"

[theme.status]
accepted = "green"
declined = "red"
tentative = "yellow"
needsAction = "blackBright"
```

### Available Colors

Terminal colors: `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, `blackBright`, `redBright`, `greenBright`, `yellowBright`, `blueBright`, `magentaBright`, `cyanBright`, `whiteBright`

## Keyboard Shortcuts

### Global
| Key | Action |
|-----|--------|
| `Tab` | Toggle focus between Days sidebar and Timeline |
| `Esc` | Close current overlay/modal |
| `q` | Quit the app |
| `Ctrl+C` | Quit the app |

### Days Sidebar (when focused)
| Key | Action |
|-----|--------|
| `j` / `k` / `↓` / `↑` | Move day selection |
| `gg` | Jump to start of days list |
| `G` (Shift+g) | Jump to end of days list |
| `Enter` | Select day and focus timeline |

### Timeline (when focused)
| Key | Action |
|-----|--------|
| `j` / `k` / `↓` / `↑` | Move event selection |
| `gg` | Jump to first event |
| `G` (Shift+g) | Jump to last event |
| `Ctrl+d` / `Ctrl+u` | Scroll timeline down/up |
| `n` | Jump to "now" |
| `Enter` / `Space` | Open event details |
| `e` | Edit selected event |
| `D` (Shift+d) | Delete selected event |

### Command Bar
| Key | Action |
|-----|--------|
| `:` | Open command bar |
| `/new [title]` | Create new event (optional title) |
| `Enter` | Execute command |
| `Esc` | Cancel |

### Details Panel
| Key | Action |
|-----|--------|
| `e` | Edit event |
| `D` | Delete event |
| `Esc` | Close |

## Project Structure

```
src/
├── config/         # Configuration system
│   ├── schema.ts       # Zod schema for config
│   └── config.ts       # Config loading from TOML
├── domain/         # Business logic, types, and schemas
│   ├── gcalEvent.ts    # Google Calendar event types + Zod schemas
│   ├── time.ts         # Luxon date/time helpers
│   ├── layout.ts       # Day layout engine (hour buckets, overlaps)
│   └── mock.ts         # Seed data generator
├── db/             # Database layer
│   ├── db.ts           # SQLite + Drizzle setup
│   ├── schema.ts       # Database schema
│   └── eventsRepo.ts   # CRUD operations
├── state/          # Jotai state management
│   ├── atoms.ts        # Core and derived atoms
│   └── actions.ts      # Action atoms for mutations
├── ui/             # React components
│   ├── App.tsx             # Main app with initialization
│   ├── DayView.tsx         # Main day view layout
│   ├── DaysSidebar.tsx     # Days navigation sidebar
│   ├── Timeline.tsx        # Timeline with events
│   ├── DetailsPanel.tsx    # Event details overlay
│   ├── EventDialog.tsx     # Create/edit event modal
│   ├── ConfirmModal.tsx    # Delete confirmation + scope modals
│   ├── CommandBar.tsx      # Command input overlay
│   ├── KeyboardHandler.tsx # Keyboard navigation
│   └── theme.ts            # Theme accessor (from config)
└── index.tsx       # Entry point
```

## Event Types

Supports Google Calendar event types:
- **Event** (default) - Regular calendar events
- **Out of Office** - Marked with 🚫
- **Focus Time** - Marked with 🎯
- **Birthday** - Marked with 🎂

## Recurring Events

When editing or deleting a recurring event, you'll be prompted for scope:
- **This event only**
- **This and following events**
- **All events in the series**

(Note: v0 stores the choice but doesn't implement actual recurrence expansion)

## Database

Events are stored in `~/.aion/aion.db`. On first run, mock data is seeded.

To reset the database:
```bash
rm ~/.aion/aion.db
bun dev
```

## Future Roadmap (v1+)

- [ ] OAuth integration with Google Calendar API
- [ ] Week and Month views
- [ ] Recurrence expansion
- [ ] Real-time sync
- [ ] Multiple calendars
- [ ] Reminders/notifications

## License

MIT
