import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TEMPLATE_ROOT, resolvePath } from '../theme-path.js';
import { readFileContent, scanDirectory } from '../utils/file-scanner.js';
import { componentNameFromFilename } from '../utils/component-metadata.js';
import { suggestBladeComponentName } from '../utils/pug-to-blade.js';

export function register(server: McpServer): void {
  // ── 1. phoenix://readme ─────────────────────────────────────────────
  server.registerResource(
    'phoenix-readme',
    'phoenix://readme',
    {
      title: 'Phoenix Theme README',
      description:
        'The full contents of the Phoenix theme README.md — overview, file structure, and usage notes.',
      mimeType: 'text/plain',
    },
    async (uri) => {
      const content = await readFileContent(resolvePath('README.md'));
      return { contents: [{ uri: uri.href, text: content }] };
    },
  );

  // ── 2. phoenix://colors ─────────────────────────────────────────────
  server.registerResource(
    'phoenix-colors',
    'phoenix://colors',
    {
      title: 'Phoenix Color Palette',
      description:
        'The complete _colors.scss file defining the Phoenix theme color palette, CSS custom properties, and color utility maps.',
      mimeType: 'text/plain',
    },
    async (uri) => {
      const content = await readFileContent(
        resolvePath('src', 'scss', 'theme', '_colors.scss'),
      );
      return { contents: [{ uri: uri.href, text: content }] };
    },
  );

  // ── 3. phoenix://component-index ────────────────────────────────────
  server.registerResource(
    'phoenix-component-index',
    'phoenix://component-index',
    {
      title: 'Phoenix Component Index',
      description:
        'Dynamically scanned index of every Pug mixin and SCSS component in the Phoenix theme, including component name, type, path, and suggested Blade component name.',
      mimeType: 'text/plain',
    },
    async (uri) => {
      const pugDir = resolvePath('src', 'pug', 'mixins');
      const scssDir = resolvePath('src', 'scss', 'theme');

      const [pugFiles, scssFiles] = await Promise.all([
        scanDirectory(pugDir, ['.pug']),
        scanDirectory(scssDir, ['.scss']),
      ]);

      const lines: string[] = [
        `Phoenix Component Index`,
        `=======================`,
        ``,
        `Pug Mixins (${pugFiles.length})`,
        `${'─'.repeat(40)}`,
      ];

      for (const file of pugFiles) {
        const name = componentNameFromFilename(file.name);
        const blade = suggestBladeComponentName(file.relativePath);
        lines.push(
          `  ${name}`,
          `    Type:  pug`,
          `    Path:  src/pug/mixins/${file.relativePath}`,
          `    Blade: <x-${blade} />`,
          ``,
        );
      }

      lines.push(
        `SCSS Components (${scssFiles.length})`,
        `${'─'.repeat(40)}`,
      );

      for (const file of scssFiles) {
        const name = componentNameFromFilename(file.name);
        const blade = suggestBladeComponentName(file.name);
        lines.push(
          `  ${name}`,
          `    Type:  scss`,
          `    Path:  src/scss/theme/${file.relativePath}`,
          `    Blade: <x-${blade} />`,
          ``,
        );
      }

      lines.push(
        `${'─'.repeat(40)}`,
        `Total: ${pugFiles.length + scssFiles.length} components`,
      );

      return { contents: [{ uri: uri.href, text: lines.join('\n') }] };
    },
  );

  // ── 4. phoenix://laravel-setup ──────────────────────────────────────
  server.registerResource(
    'phoenix-laravel-setup',
    'phoenix://laravel-setup',
    {
      title: 'Laravel 12 + Phoenix Quick Start',
      description:
        'Step-by-step guide for integrating the Phoenix admin theme into a fresh Laravel 12 project — npm deps, Vite config, SCSS/JS setup, base layout, and asset strategy.',
      mimeType: 'text/plain',
    },
    async (uri) => {
      const guide = `\
Laravel 12 + Phoenix Theme — Quick Start Guide
================================================

1. NPM Dependencies
--------------------
Install the front-end packages Phoenix relies on:

  npm install bootstrap@5 @popperjs/core
  npm install -D sass-embedded

Optional (depending on which Phoenix components you use):

  npm install dayjs choices.js dropzone echarts flatpickr
  npm install glightbox is-js list.js lodash prism-themes prismjs
  npm install rater-js simplebar sortablejs swiper tinymce

2. Vite Configuration (vite.config.js)
---------------------------------------
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';

export default defineConfig({
  plugins: [
    laravel({
      input: [
        'resources/scss/phoenix.scss',
        'resources/js/phoenix.js',
      ],
      refresh: true,
    }),
  ],
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
});

3. SCSS Import Structure
-------------------------
Create resources/scss/phoenix.scss as the main entry point:

  // Core Bootstrap functions & Phoenix variables
  @use 'phoenix/functions';
  @use 'phoenix/variables';
  @use 'phoenix/colors';

  // Bootstrap core
  @use 'bootstrap/scss/bootstrap';

  // Phoenix theme overrides & components
  @use 'phoenix/theme';

Copy the Phoenix SCSS source files from the template into
resources/scss/phoenix/. Key files to include:

  resources/scss/phoenix/
    _functions.scss
    _variables.scss
    _colors.scss
    _theme.scss          (imports all component partials)
    ... (all component partials from src/scss/theme/)

4. JavaScript Setup
--------------------
Create resources/js/phoenix.js:

  // Bootstrap JS
  import * as bootstrap from 'bootstrap';
  window.bootstrap = bootstrap;

  // Phoenix utilities (copy from template src/js/)
  import './phoenix/phoenix.js';

Copy the Phoenix JS source files into resources/js/phoenix/.
Key modules to include:

  resources/js/phoenix/
    phoenix.js            (main initializer)
    config.js             (theme configuration)
    utils.js              (DOM & utility helpers)
    ... (additional modules as needed per component)

5. Base Layout Blade Component
-------------------------------
Create resources/views/components/layouts/phoenix.blade.php:

  <!DOCTYPE html>
  <html lang="{{ str_replace('_', '-', app()->getLocale()) }}"
        data-bs-theme="light"
        data-navigation-type="default"
        data-navbar-horizontal-shape="default">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="csrf-token" content="{{ csrf_token() }}" />
    <title>{{ $title ?? config('app.name') }}</title>

    {{-- Fonts --}}
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;600;700;800;900&display=swap"
          rel="stylesheet" />

    @vite(['resources/scss/phoenix.scss', 'resources/js/phoenix.js'])
  </head>
  <body>
    <main class="main" id="top">
      <div class="container-fluid px-0" data-layout="container">

        {{-- Sidebar / Navbar slot --}}
        {{ $sidebar ?? '' }}

        <div class="content">
          {{-- Top navbar slot --}}
          {{ $navbar ?? '' }}

          {{-- Page content --}}
          {{ $slot }}

          {{-- Footer --}}
          {{ $footer ?? '' }}
        </div>
      </div>
    </main>
  </body>
  </html>

Usage in a page:

  <x-layouts.phoenix>
    <x-slot:sidebar>
      {{-- sidebar markup --}}
    </x-slot:sidebar>

    <h1>Dashboard</h1>
  </x-layouts.phoenix>

6. Asset Copying Strategy
--------------------------
The Phoenix template ships static assets (images, fonts, JSON data)
that must be available at public URLs. Recommended approach:

a) Copy static assets into the Laravel public directory:

     cp -r template/phoenix-v1.24.0/public/assets/img public/assets/img
     cp -r template/phoenix-v1.24.0/public/assets/video public/assets/video
     cp -r template/phoenix-v1.24.0/public/vendors public/vendors

b) For vendor JS libraries already installed via npm (e.g. echarts,
   simplebar), import them through your JS build instead of copying
   the vendor bundles.

c) Add public/assets and public/vendors to .gitignore if you prefer
   to treat them as build artifacts, or commit them for simpler deploys.

d) Reference assets in Blade templates using the asset() helper:

     <img src="{{ asset('assets/img/phoenix-logo.png') }}" alt="Logo" />

Summary
--------
1. Install npm packages
2. Configure Vite with SCSS + JS entry points
3. Copy and organize Phoenix SCSS/JS sources under resources/
4. Create the base Blade layout component
5. Copy static assets to public/
6. Start building pages with <x-layouts.phoenix> and Phoenix components
`;

      return { contents: [{ uri: uri.href, text: guide }] };
    },
  );
}
