# Journalite

A calendar and task management sidebar plugin for Obsidian.

## Features

### Calendar
- Monthly calendar view
- Dots indicate days with Daily notes
- Click a date to open/create Daily note
- Right-click menu to open Daily note

### Task List
Tasks are categorized and displayed as:
- **Overdue**: Past due tasks
- **Today**: Today's tasks
- **Upcoming**: Tasks within the next 2 weeks
- **No Schedule**: Task notes without dates

### Editor Integration
- Date patterns (`@YYYY-MM-DD`, etc.) are highlighted
- Complete checkboxes directly from the sidebar

## Concepts

### Daily Note
Files named in `YYYY-MM-DD.md` format are automatically recognized as Daily notes.

```
2025-01-15.md  → Daily note
my-note.md     → Regular note
```

### Task Note
Notes with `done` field in frontmatter are treated as task notes:

```yaml
---
done: false
startDate: 2025-01-01
dueDate: 2025-01-31
---
```

| Field | Description |
|-------|-------------|
| `done` | Required. Set `true` to mark as done |
| `startDate` | Start date (optional) |
| `dueDate` | Due date (optional) |

Task notes without `startDate` or `dueDate` appear in "No Schedule".

### Task Item
Checkboxes with a date pattern at the end:

```markdown
- [ ] Task content @2025-01-15
```

#### Supported Date Formats

| Pattern | Meaning |
|---------|---------|
| `@2025-01-15` | Single date (start = due) |
| `@2025-01-15..` | Start date only (shown from this date onwards) |
| `@..2025-01-15` | Due date only (shown until this date) |
| `@2025-01-01..2025-01-15` | Date range |

Date patterns are highlighted in the editor for visual confirmation.

## Installation

1. Clone this repository into `.obsidian/plugins/journalite/`
2. Run `npm install`
3. Run `npm run build`
4. Enable Journalite in Obsidian Settings → Community Plugins

## Development

```bash
npm install
npm run dev    # Development mode with file watching
npm run build  # Production build
```

## License

MIT
