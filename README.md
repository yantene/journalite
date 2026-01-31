# Journalite

A calendar and task management sidebar plugin for Obsidian.

## Features

- **Calendar View**: Monthly calendar showing daily notes, click to open/create
- **Task List**: Tasks grouped by Overdue / Today / Upcoming / No Schedule
- **Task Completion**: Complete tasks directly from the sidebar
- **Task Creation**: Right-click calendar dates to create tasks with start/due dates

## Installation

1. Clone this repository into `.obsidian/plugins/journalite/`
2. Run `npm install`
3. Run `npm run build`
4. Enable Journalite in Obsidian Settings → Community Plugins

## Usage

### Daily Notes

Integrates with Obsidian's built-in Daily Notes plugin. Daily notes require this frontmatter:

```yaml
---
type: daily
---
```

Filename must be in `YYYY-MM-DD.md` format.

### Task Pages

Files are recognized as tasks when frontmatter contains `type: task`:

```yaml
---
type: task
startDate: 2025-01-01
dueDate: 2025-01-31
completed: false
---
```

- `startDate`: Start date (optional)
- `dueDate`: Due date (optional)
- `completed`: Completion flag

### Daily Note Tasks

Incomplete checkboxes (`- [ ]`) within daily notes also appear in the task list.

## Settings

- **Tasks Folder**: Destination folder for newly created tasks
- **Task Template**: Use `task.md` from Obsidian's template folder, or specify a custom path

## Development

```bash
npm install
npm run dev    # Development mode with file watching
npm run build  # Production build
```

## License

MIT
