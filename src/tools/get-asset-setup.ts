import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';

type Aspect = 'all' | 'vite' | 'scss' | 'js' | 'fonts' | 'images';

function getViteGuide(): string {
  return `## Vite Configuration (vite.config.js)

Install the Laravel Vite plugin if not already present:

\`\`\`bash
npm install --save-dev laravel-vite-plugin
\`\`\`

Configure \`vite.config.js\` in your Laravel project root:

\`\`\`js
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/scss/phoenix/theme.scss',
                'resources/js/phoenix.js',
            ],
            refresh: true,
        }),
    ],
    css: {
        preprocessorOptions: {
            scss: {
                // If Phoenix uses global SCSS variables/mixins, make them available everywhere
                additionalData: \`@use "resources/scss/phoenix/variables" as *;\`,
            },
        },
    },
    resolve: {
        alias: {
            // Alias for Phoenix assets if needed
            '@phoenix': '/resources',
        },
    },
});
\`\`\`

In your Blade layout, include the assets:

\`\`\`blade
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $title ?? 'Phoenix' }}</title>
    @vite(['resources/scss/phoenix/theme.scss', 'resources/js/phoenix.js'])
    {{ $styles ?? '' }}
</head>
<body>
    {{ $slot }}
    {{ $scripts ?? '' }}
</body>
</html>
\`\`\``;
}

function getScssGuide(): string {
  return `## SCSS Integration

### Directory Structure

Copy Phoenix SCSS source into your Laravel project:

\`\`\`
resources/scss/phoenix/
├── theme.scss              ← Main entry point (import this in Vite)
├── _variables.scss         ← Phoenix variable overrides
├── _custom.scss            ← Your custom overrides
├── theme/                  ← From Phoenix src/scss/theme/
│   ├── _avatar.scss
│   ├── _badge.scss
│   ├── _buttons.scss
│   ├── _card.scss
│   ├── _navbar.scss
│   └── ...
└── vendor/                 ← Third-party SCSS (if any)
\`\`\`

### Main Entry Point (theme.scss)

\`\`\`scss
// resources/scss/phoenix/theme.scss

// 1. Phoenix variable overrides (before importing Phoenix)
@use 'variables' as *;

// 2. Phoenix theme partials (copy from src/scss/theme/)
@use 'theme/avatar';
@use 'theme/badge';
@use 'theme/buttons';
@use 'theme/card';
@use 'theme/navbar';
// ... add all partials from src/scss/theme/

// 3. Your custom overrides (after Phoenix)
@use 'custom';
\`\`\`

### Variable Overrides

\`\`\`scss
// resources/scss/phoenix/_variables.scss
// Override Phoenix variables here before they are used

$phoenix-primary: #2c7be5;
$phoenix-font-family-sans-serif: 'Nunito Sans', sans-serif;
// See the Phoenix theme's _variables.scss for all available variables
\`\`\`

### Copy Command

\`\`\`bash
# From your Laravel project root (adjust Phoenix path as needed)
cp -r /path/to/phoenix/src/scss/theme resources/scss/phoenix/theme
cp /path/to/phoenix/src/scss/theme.scss resources/scss/phoenix/theme.scss
\`\`\``;
}

function getJsGuide(): string {
  return `## JavaScript Integration

### Directory Structure

\`\`\`
resources/js/
├── phoenix.js              ← Main entry point (import this in Vite)
├── phoenix/
│   ├── bootstrap.js        ← Phoenix bootstrap/init
│   ├── config.js           ← Phoenix config
│   ├── utils.js            ← Phoenix utility functions
│   ├── echarts.js          ← Chart integrations (lazy-load per page)
│   ├── datatables.js       ← DataTables integration
│   ├── fullcalendar.js     ← Calendar integration
│   ├── leaflet.js          ← Map integration
│   ├── dropzone.js         ← File upload integration
│   ├── choices.js          ← Select/input enhancement
│   ├── tinymce.js          ← Rich text editor
│   ├── swiper.js           ← Carousel/slider
│   └── sortable.js         ← Drag & drop
└── vendor/                 ← Third-party libraries
\`\`\`

### Main Entry Point

\`\`\`js
// resources/js/phoenix.js

// Core Phoenix functionality
import './phoenix/bootstrap';
import './phoenix/config';
import './phoenix/utils';

// Initialize Phoenix
document.addEventListener('DOMContentLoaded', () => {
    // Phoenix initialization code
    console.log('Phoenix theme loaded');
});
\`\`\`

### Page-Specific JS (Lazy Loading)

For heavy libraries, import them only on pages that need them:

\`\`\`blade
{{-- In your Blade page view --}}
@push('scripts')
    @vite('resources/js/phoenix/echarts.js')
@endpush
\`\`\`

### Copy Command

\`\`\`bash
# From your Laravel project root
mkdir -p resources/js/phoenix
cp -r /path/to/phoenix/src/js/theme/* resources/js/phoenix/
cp /path/to/phoenix/src/js/phoenix.js resources/js/phoenix.js
\`\`\`

### NPM Dependencies

Install Phoenix's JS dependencies:

\`\`\`bash
npm install echarts@^5 dayjs@^1 list.js@^2 choices.js@^10 \\
    @fullcalendar/core @fullcalendar/daygrid @fullcalendar/timegrid \\
    leaflet@^1 dropzone@^6 sortablejs@^1 swiper@^11 \\
    feather-icons@^4 --save
\`\`\`

Note: Only install the packages your pages actually use. Check each page's requirements with \`generate_laravel_scaffold\`.`;
}

function getFontsGuide(): string {
  return `## Font & Icon Setup

### FontAwesome 6

Phoenix uses FontAwesome 6 (Pro or Free). For Laravel integration:

**Option A — CDN (quickest)**
\`\`\`blade
{{-- In your layout <head> --}}
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
\`\`\`

**Option B — NPM + Vite (recommended for production)**
\`\`\`bash
npm install @fortawesome/fontawesome-free
\`\`\`

\`\`\`scss
// resources/scss/phoenix/theme.scss (add near top)
@import '@fortawesome/fontawesome-free/scss/fontawesome';
@import '@fortawesome/fontawesome-free/scss/solid';
@import '@fortawesome/fontawesome-free/scss/regular';
@import '@fortawesome/fontawesome-free/scss/brands';
\`\`\`

**Option C — Self-hosted (copy from Phoenix)**
\`\`\`bash
cp -r /path/to/phoenix/public/vendors/@fortawesome public/vendors/@fortawesome
# or
cp -r /path/to/phoenix/src/vendors/@fortawesome resources/vendors/@fortawesome
\`\`\`

### Feather Icons

\`\`\`bash
npm install feather-icons
\`\`\`

\`\`\`js
// resources/js/phoenix.js
import feather from 'feather-icons';

document.addEventListener('DOMContentLoaded', () => {
    feather.replace();
});
\`\`\`

### Google Fonts

Phoenix typically uses Google Fonts (e.g., "Nunito Sans", "Open Sans"). Add to your layout:

\`\`\`blade
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;600;700;800;900&display=swap" rel="stylesheet">
\`\`\`

Or import via SCSS:

\`\`\`scss
@import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;600;700;800;900&display=swap');
\`\`\``;
}

function getImagesGuide(): string {
  return `## Image & Static Asset Setup

### Copy Strategy

Phoenix ships images in \`assets/img/\`. For Laravel, you have two options:

**Option A — Public Directory (simple, no build step)**

\`\`\`bash
# Copy Phoenix images to Laravel's public directory
cp -r /path/to/phoenix/public/assets/img public/assets/img

# Reference in Blade:
# <img src="{{ asset('assets/img/team/avatar.webp') }}" />
\`\`\`

**Option B — Resources + Vite (hashed filenames, cache-busting)**

\`\`\`bash
# Copy to resources for Vite processing
cp -r /path/to/phoenix/public/assets/img resources/img/phoenix
\`\`\`

\`\`\`js
// In JS, import images:
import avatar from '../img/phoenix/team/avatar.webp';
\`\`\`

\`\`\`blade
{{-- In Blade, use Vite::asset() --}}
<img src="{{ Vite::asset('resources/img/phoenix/team/avatar.webp') }}" />
\`\`\`

### Recommended Approach

For most Phoenix → Laravel migrations, **Option A** (public directory) is simpler and works well.
Use Option B only for images that benefit from cache-busting (rarely needed for theme images).

### Directory Structure After Copy

\`\`\`
public/assets/img/
├── team/               ← Avatar images
│   ├── 1.webp
│   ├── 2.webp
│   └── ...
├── icons/              ← Icon images
├── logos/              ← Logo variants
├── bg/                 ← Background images
├── gallery/            ← Gallery images
├── products/           ← E-commerce product images (demo)
├── country/            ← Country flag images
└── generic/            ← Placeholder / generic images
\`\`\`

### Updating Image Paths in Blade

When converting Pug templates to Blade, update image paths:

\`\`\`blade
{{-- Pug: img(src=\`\${CWD}assets/img/team/1.webp\`) --}}
{{-- Blade: --}}
<img src="{{ asset('assets/img/team/1.webp') }}" alt="" />
\`\`\``;
}

function getAllGuide(): string {
  return `# Phoenix Theme → Laravel 12 Integration Guide

This is a comprehensive guide for integrating the Phoenix admin theme into a Laravel 12 project.

## Prerequisites

- Laravel 12 project (\`composer create-project laravel/laravel your-project\`)
- Node.js 18+ and npm
- The Phoenix theme source files

## Quick Start

\`\`\`bash
# 1. Install NPM dependencies
npm install laravel-vite-plugin --save-dev

# 2. Copy Phoenix assets
cp -r /path/to/phoenix/src/scss/theme resources/scss/phoenix/theme
cp -r /path/to/phoenix/src/js/theme resources/js/phoenix/
cp -r /path/to/phoenix/public/assets public/assets

# 3. Install Phoenix JS dependencies
npm install echarts dayjs list.js feather-icons --save

# 4. Install FontAwesome
npm install @fortawesome/fontawesome-free --save

# 5. Build
npm run dev
\`\`\`

---

${getViteGuide()}

---

${getScssGuide()}

---

${getJsGuide()}

---

${getFontsGuide()}

---

${getImagesGuide()}

---

## Blade Layout Component

Create the main Phoenix layout as a Blade component:

\`\`\`bash
mkdir -p resources/views/components/layouts
\`\`\`

\`\`\`blade
{{-- resources/views/components/layouts/phoenix-theme.blade.php --}}
@props(['title' => 'Phoenix'])

<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" data-bs-theme="light">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $title }} | {{ config('app.name') }}</title>

    {{-- Fonts --}}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;600;700;800;900&display=swap" rel="stylesheet">

    {{-- Theme Assets --}}
    @vite(['resources/scss/phoenix/theme.scss', 'resources/js/phoenix.js'])

    {{-- Page-specific styles --}}
    {{ $styles ?? '' }}
</head>
<body>
    {{-- Navbar --}}
    {{ $navbar ?? '' }}

    {{-- Sidebar --}}
    {{ $sidebar ?? '' }}

    <main class="main" id="top">
        <div class="container-fluid" data-layout="container">
            {{ $slot }}
        </div>
    </main>

    {{-- Footer --}}
    {{ $footer ?? '' }}

    {{-- Page-specific scripts --}}
    {{ $scripts ?? '' }}
</body>
</html>
\`\`\`

## Workflow

1. Use \`list_pages\` to browse available Phoenix pages
2. Use \`generate_blade_page\` to convert a Pug page to Blade
3. Use \`generate_blade_component\` to convert individual Pug mixins to Blade components
4. Use \`generate_laravel_scaffold\` to get the full Controller + Route + View for a page
5. Use \`get_asset_setup\` (this tool) for asset configuration details`;
}

export function register(server: McpServer): void {
  server.registerTool(
    'get_asset_setup',
    {
      description:
        'Get comprehensive setup instructions for integrating Phoenix theme assets into Laravel 12. ' +
        'Covers Vite config, SCSS structure, JS imports, font/icon setup, and image copy strategy. ' +
        'Use aspect="all" for the full guide or pick a specific aspect.',
      inputSchema: z.object({
        aspect: z
          .enum(['all', 'vite', 'scss', 'js', 'fonts', 'images'])
          .optional()
          .default('all')
          .describe(
            'Which aspect of asset setup to return. Defaults to "all" for the complete guide.',
          ),
      }),
    },
    async (input) => {
      const aspect: Aspect = input.aspect || 'all';

      let guide: string;
      switch (aspect) {
        case 'vite':
          guide = getViteGuide();
          break;
        case 'scss':
          guide = getScssGuide();
          break;
        case 'js':
          guide = getJsGuide();
          break;
        case 'fonts':
          guide = getFontsGuide();
          break;
        case 'images':
          guide = getImagesGuide();
          break;
        case 'all':
        default:
          guide = getAllGuide();
          break;
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: guide,
          },
        ],
      };
    },
  );
}
