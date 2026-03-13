# MCP Phoenix Theme

A Model Context Protocol (MCP) server that gives AI assistants deep access to the [Phoenix v1.24.0](https://themewagon.com/themes/phoenix/) admin theme — enabling browsing, searching, and **automatic Laravel 12 code generation** from the theme's Pug/SCSS/JS source files.

## What It Does

This MCP server bridges the gap between a purchased HTML/Pug admin template and a production Laravel 12 application. Instead of manually converting hundreds of Pug templates and SCSS partials, you connect this server to your AI assistant and it can:

- **Browse** every component, layout, page, and app module in the Phoenix theme
- **Read** full source code of any Pug mixin, SCSS partial, or JS module
- **Search** across all theme source files with context
- **Extract** SCSS variables (colors, typography, spacing, etc.)
- **Generate** ready-to-use Laravel Blade components from Pug mixins
- **Generate** full Blade page views from Pug page templates
- **Scaffold** complete Laravel features — Controller, Route, Blade view, and Vite asset imports — from a single command

## Installation

```bash
git clone <repo-url>
cd MCP-Phoenix-Theme
npm install
npm run build
```

### Add to Claude Code

Add to your `.mcp.json` (project or global):

```json
{
  "mcpServers": {
    "phoenix-theme": {
      "command": "node",
      "args": ["C:/path/to/MCP-Phoenix-Theme/dist/index.js"]
    }
  }
}
```

### Add to Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "phoenix-theme": {
      "command": "node",
      "args": ["C:/path/to/MCP-Phoenix-Theme/dist/index.js"]
    }
  }
}
```

## Tools

### Theme Browsing (10 tools)

| Tool | Description |
|------|-------------|
| `list_components` | List all SCSS partials, Pug mixins, and JS modules. Optionally filter by type (`scss`, `pug`, `js`). |
| `get_component` | Get the full source code of a component by name (case-insensitive search). For Pug files, includes Blade conversion hints. |
| `list_layouts` | List all Pug layout files with their suggested Blade layout component mappings. |
| `get_layout` | Read a layout's full Pug source, included mixins, and a complete Blade conversion guide. |
| `list_pages` | List all page templates grouped by section (`apps`, `dashboard`, `pages`, `modules`, `documentation`, `demo`). |
| `get_page` | Read a Pug page template with Blade conversion hints. Optionally include the compiled HTML output. |
| `search_theme` | Case-insensitive search across all theme source files (Pug, SCSS, JS, HTML) with surrounding context. |
| `get_theme_variables` | Extract SCSS variables grouped by category: colors, typography, spacing, borders, shadows, breakpoints, components. |
| `list_apps` | List all application modules (CRM, e-commerce, email, kanban, etc.) with page counts and suggested Laravel route prefixes. |
| `get_app_structure` | Get the full structure of an app module — pages, layouts, mixins, SCSS, JS, and a Laravel scaffold summary. |

### Laravel Generation (4 tools)

| Tool | Description |
|------|-------------|
| `generate_blade_component` | Convert a Pug mixin into a Laravel Blade anonymous component with `@props`, `{{ $slot }}`, `{{ $attributes->merge() }}`, and usage examples. |
| `generate_blade_page` | Convert a Pug page template into a Blade view using `<x-layouts.phoenix-theme>` and `<x-phoenix.*>` components. |
| `generate_laravel_scaffold` | Generate a complete Laravel scaffold from a Pug page: Controller, Route, Blade view, and Vite asset imports with auto-detected dependencies (ECharts, DataTables, FullCalendar, Leaflet, etc.). |
| `get_asset_setup` | Get setup instructions for integrating Phoenix assets into Laravel 12 — Vite config, SCSS structure, JS imports, fonts, and images. |

## Resources

The server also exposes static resources for quick context loading:

| Resource URI | Description |
|--------------|-------------|
| `phoenix://readme` | The Phoenix theme's original README |
| `phoenix://colors` | The complete `_colors.scss` color palette and CSS custom properties |
| `phoenix://component-index` | Dynamically scanned index of every Pug mixin and SCSS component |
| `phoenix://laravel-setup` | Step-by-step Laravel 12 + Phoenix integration quick-start guide |

## Example Workflows

### "Set up Phoenix in my Laravel project"

Ask your AI assistant to call `get_asset_setup` — it returns a full guide covering npm dependencies, Vite config, SCSS/JS entry points, font setup, and image copy strategy.

### "Build me the CRM analytics page"

1. `get_app_structure` with `app: "crm"` — see all CRM pages, layouts, and files
2. `generate_laravel_scaffold` with `page: "apps/crm/analytics.pug"` — get a ready-to-use Controller, Route, Blade view, and Vite imports
3. `generate_blade_component` for any components you need (e.g., `"Card"`, `"Avatar"`) — get reusable Blade components

### "What colors does this theme use?"

Call `get_theme_variables` with `category: "colors"` or read the `phoenix://colors` resource.

### "Find everywhere this theme uses a modal"

Call `search_theme` with `query: "modal"` — get file paths, line numbers, and context across all source files.

## Project Structure

```
MCP-Phoenix-Theme/
  src/
    index.ts                 # Server entry point
    theme-path.ts            # Template root path resolution
    tools/
      list-components.ts     # Browse components
      get-component.ts       # Read component source
      list-layouts.ts        # Browse layouts
      get-layout.ts          # Read layout source + Blade guide
      list-pages.ts          # Browse page templates
      get-page.ts            # Read page source + Blade hints
      search-theme.ts        # Full-text search
      get-theme-variables.ts # SCSS variable extraction
      list-apps.ts           # Browse app modules
      get-app-structure.ts   # App module deep dive
      generate-blade-component.ts  # Pug mixin -> Blade component
      generate-blade-page.ts       # Pug page -> Blade view
      generate-laravel-scaffold.ts # Full Laravel scaffold
      get-asset-setup.ts           # Asset integration guide
    resources/
      register-resources.ts  # Static resource registration
    utils/
      file-scanner.ts        # Recursive directory scanner
      component-metadata.ts  # SCSS/Pug metadata extraction
      pug-to-blade.ts        # Pug-to-Blade conversion engine
  template/
    phoenix-v1.24.0/         # Phoenix theme source files
  dist/                      # Compiled output (generated)
```

## Development

```bash
npm run dev    # Watch mode — recompiles on changes
npm run build  # One-time build
npm start      # Run the server
```

## Tech Stack

- **TypeScript** with ES2022 target
- **@modelcontextprotocol/sdk** ^1.27.0
- **Zod** for input validation
- **stdio** transport (works with Claude Code, Claude Desktop, and any MCP-compatible client)

## License

Private — for use with a licensed copy of the Phoenix admin theme.
