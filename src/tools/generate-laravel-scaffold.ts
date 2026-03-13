import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { resolvePath } from '../theme-path.js';
import { readFileContent } from '../utils/file-scanner.js';
import { convertPugToBladeHints } from '../utils/pug-to-blade.js';

/**
 * Convert a page path to a PascalCase controller name.
 * e.g. "dashboard/crm" → "DashboardCrmController"
 *      "apps/crm/analytics" → "AppsCrmAnalyticsController"
 */
function deriveControllerName(pagePath: string): string {
  const cleaned = pagePath
    .replace(/\.pug$/, '')
    .replace(/[\/\\]/g, '-');
  return cleaned
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') + 'Controller';
}

/**
 * Convert a page path to a route prefix.
 * e.g. "dashboard/crm" → "dashboard/crm"
 *      "apps/crm/analytics" → "apps/crm/analytics"
 */
function deriveRoutePrefix(pagePath: string): string {
  return pagePath.replace(/\.pug$/, '');
}

/**
 * Convert a page path to a controller method name.
 * e.g. "dashboard/crm" → "index"
 *      "apps/crm/analytics" → "index"
 */
function deriveMethodName(pagePath: string): string {
  const lastSegment = pagePath.replace(/\.pug$/, '').split('/').pop() || 'index';
  // Common page names map to "index"; otherwise use the page name
  const indexNames = ['index', 'default', 'home', 'main'];
  if (indexNames.includes(lastSegment.toLowerCase())) return 'index';
  return lastSegment
    .replace(/[-_](\w)/g, (_, c: string) => c.toUpperCase());
}

/**
 * Derive the Blade view dot-notation path from a pug path.
 * e.g. "dashboard/crm" → "phoenix.dashboard.crm"
 */
function deriveViewName(pagePath: string): string {
  const cleaned = pagePath.replace(/\.pug$/, '');
  return 'phoenix.' + cleaned.replace(/\//g, '.');
}

/**
 * Derive a Blade file path.
 */
function deriveBladeFilePath(pagePath: string): string {
  const cleaned = pagePath.replace(/\.pug$/, '');
  return `resources/views/phoenix/${cleaned}.blade.php`;
}

/**
 * Extract the variables that the controller should provide.
 */
function extractControllerVariables(hints: ReturnType<typeof convertPugToBladeHints>): string[] {
  const vars = new Set<string>();
  for (const v of hints.variables) {
    vars.add(v);
  }
  for (const loop of hints.loops) {
    const collectionMatch = loop.match(/in\s+(.+)/);
    if (collectionMatch) {
      const collection = collectionMatch[1].trim();
      if (/^\w+$/.test(collection)) {
        vars.add(collection);
      }
    }
  }
  return [...vars];
}

/**
 * Generate a PHP controller class.
 */
function generateController(
  controllerName: string,
  methodName: string,
  viewName: string,
  variables: string[],
  pageTitle: string,
): string {
  const lines: string[] = [];
  lines.push('<?php');
  lines.push('');
  lines.push('namespace App\\Http\\Controllers;');
  lines.push('');
  lines.push('use Illuminate\\Http\\Request;');
  lines.push('use Illuminate\\View\\View;');
  lines.push('');
  lines.push(`class ${controllerName} extends Controller`);
  lines.push('{');
  lines.push(`    /**`);
  lines.push(`     * Display the ${pageTitle} page.`);
  lines.push(`     */`);
  lines.push(`    public function ${methodName}(Request $request): View`);
  lines.push('    {');

  if (variables.length > 0) {
    lines.push('        // TODO: Replace with actual data from your models/services');
    for (const v of variables) {
      lines.push(`        $${v} = []; // TODO: populate $${v}`);
    }
    lines.push('');
    lines.push(`        return view('${viewName}', [`);
    for (const v of variables) {
      lines.push(`            '${v}' => $${v},`);
    }
    lines.push('        ]);');
  } else {
    lines.push(`        return view('${viewName}');`);
  }

  lines.push('    }');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate a Route definition.
 */
function generateRoute(
  controllerName: string,
  methodName: string,
  routePrefix: string,
): string {
  const routeName = routePrefix.replace(/\//g, '.');
  const lines: string[] = [];
  lines.push(`use App\\Http\\Controllers\\${controllerName};`);
  lines.push('');
  lines.push(`Route::get('/${routePrefix}', [${controllerName}::class, '${methodName}'])`);
  lines.push(`    ->name('${routeName}');`);
  return lines.join('\n');
}

/**
 * Generate the Blade view.
 */
function generateBladeView(
  hints: ReturnType<typeof convertPugToBladeHints>,
  pageTitle: string,
  variables: string[],
): string {
  const lines: string[] = [];
  const layoutName = hints.layout || 'phoenix-theme';

  lines.push(`<x-layouts.${layoutName} title="${pageTitle}">`);

  // Named slots for layout sections
  for (const section of hints.sections) {
    if (section === 'content' || section === 'body') continue;
    lines.push(`    <x-slot:${section}>`);
    lines.push(`        {{-- ${section} content --}}`);
    lines.push('    </x-slot>');
    lines.push('');
  }

  lines.push('    <div class="content">');

  // Component references from includes
  for (const inc of hints.includes) {
    const componentName = inc
      .replace(/^\.\.\/mixins\//, '')
      .replace(/^\.\.\//, '')
      .replace(/\.pug$/, '')
      .split('/')
      .map((part: string) =>
        part
          .replace(/([a-z])([A-Z])/g, '$1-$2')
          .replace(/[\s_]+/g, '-')
          .toLowerCase(),
      )
      .join('.');
    lines.push(`        <x-phoenix.${componentName} />`);
  }

  // Mixin calls → component tags
  for (const mc of hints.mixinCalls) {
    const componentName = mc.name
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase();
    if (mc.args) {
      lines.push(`        <x-phoenix.${componentName} {{-- ${mc.args} --}} />`);
    } else {
      lines.push(`        <x-phoenix.${componentName} />`);
    }
  }

  // Loops
  for (const loop of hints.loops) {
    const loopMatch = loop.match(/^(\w+)\s+in\s+(.+)/);
    if (loopMatch) {
      const [, item, collection] = loopMatch;
      lines.push(`        @foreach($${collection} as $${item})`);
      lines.push(`            {{-- Loop body for $${item} --}}`);
      lines.push('        @endforeach');
    }
  }

  // Conditionals
  for (const cond of hints.conditionals) {
    lines.push(`        @if(/* ${cond} */)`);
    lines.push('            {{-- Conditional content --}}');
    lines.push('        @endif');
  }

  if (
    hints.includes.length === 0 &&
    hints.mixinCalls.length === 0 &&
    hints.loops.length === 0 &&
    hints.conditionals.length === 0
  ) {
    lines.push('        {{-- Page content here --}}');
  }

  lines.push('    </div>');
  lines.push(`</x-layouts.${layoutName}>`);

  return lines.join('\n');
}

/**
 * Determine which Vite assets this page likely needs.
 */
function determineViteImports(
  pugSource: string,
  hints: ReturnType<typeof convertPugToBladeHints>,
): { scss: string[]; js: string[] } {
  const scss: string[] = ['resources/scss/phoenix/theme.scss'];
  const js: string[] = ['resources/js/phoenix.js'];

  // Check for specific asset references in the Pug source
  if (/chart|echarts/i.test(pugSource)) {
    js.push('resources/js/phoenix/echarts.js');
  }
  if (/datatables?|DataTable/i.test(pugSource)) {
    js.push('resources/js/phoenix/datatables.js');
  }
  if (/fullcalendar|calendar/i.test(pugSource)) {
    js.push('resources/js/phoenix/fullcalendar.js');
  }
  if (/leaflet|map/i.test(pugSource)) {
    js.push('resources/js/phoenix/leaflet.js');
  }
  if (/dropzone|file-upload/i.test(pugSource)) {
    js.push('resources/js/phoenix/dropzone.js');
  }
  if (/choices|select2/i.test(pugSource)) {
    js.push('resources/js/phoenix/choices.js');
  }
  if (/tinymce|editor/i.test(pugSource)) {
    js.push('resources/js/phoenix/tinymce.js');
  }
  if (/swiper|carousel/i.test(pugSource)) {
    js.push('resources/js/phoenix/swiper.js');
  }
  if (/sortable|kanban/i.test(pugSource)) {
    js.push('resources/js/phoenix/sortable.js');
  }

  return { scss, js };
}

export function register(server: McpServer): void {
  server.registerTool(
    'generate_laravel_scaffold',
    {
      description:
        'Generate a complete Laravel scaffold for a Phoenix page: Controller, Route, Blade view, ' +
        'and Vite asset imports. Provide a Pug page path (e.g. "dashboard/crm.pug") and optionally ' +
        'a custom controller name and route prefix.',
      inputSchema: z.object({
        page: z
          .string()
          .describe(
            'Pug page path relative to src/pug/ (e.g. "dashboard/crm.pug", "apps/crm/analytics.pug").',
          ),
        controller_name: z
          .string()
          .optional()
          .describe(
            'Custom controller class name (e.g. "CrmDashboardController"). Auto-generated from page path if omitted.',
          ),
        route_prefix: z
          .string()
          .optional()
          .describe(
            'Custom route prefix (e.g. "admin/crm"). Auto-generated from page path if omitted.',
          ),
      }),
    },
    async (input) => {
      const pugRelative = input.page.replace(/^\/+/, '');
      const pugAbsolute = resolvePath('src/pug', pugRelative);

      // Read Pug source
      let pugSource: string;
      try {
        pugSource = await readFileContent(pugAbsolute);
      } catch {
        return {
          content: [
            {
              type: 'text' as const,
              text:
                `Error: Could not read Pug file at src/pug/${pugRelative}.\n` +
                'Verify the path is correct (use list_pages to browse available pages).',
            },
          ],
        };
      }

      // Parse Pug → Blade hints
      const hints = convertPugToBladeHints(pugSource);

      // Derive names
      const controllerName = input.controller_name || deriveControllerName(pugRelative);
      const routePrefix = input.route_prefix || deriveRoutePrefix(pugRelative);
      const methodName = deriveMethodName(pugRelative);
      const viewName = deriveViewName(pugRelative);
      const bladeFilePath = deriveBladeFilePath(pugRelative);
      const pageTitle = pugRelative
        .replace(/\.pug$/, '')
        .split('/')
        .pop()!
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      // Extract variables
      const variables = extractControllerVariables(hints);

      // Determine Vite imports
      const viteImports = determineViteImports(pugSource, hints);

      // Generate all parts
      const controller = generateController(controllerName, methodName, viewName, variables, pageTitle);
      const route = generateRoute(controllerName, methodName, routePrefix);
      const bladeView = generateBladeView(hints, pageTitle, variables);

      // Build output
      const sections: string[] = [];

      sections.push('# Laravel Scaffold');
      sections.push(`Page: \`src/pug/${pugRelative}\``);
      sections.push('');

      // 1. Controller
      sections.push('## 1. Controller');
      sections.push(`File: \`app/Http/Controllers/${controllerName}.php\``);
      sections.push('```php');
      sections.push(controller);
      sections.push('```');
      sections.push('');

      // 2. Route
      sections.push('## 2. Route');
      sections.push('Add to `routes/web.php`:');
      sections.push('```php');
      sections.push(route);
      sections.push('```');
      sections.push('');

      // 3. Blade View
      sections.push('## 3. Blade View');
      sections.push(`File: \`${bladeFilePath}\``);
      sections.push('```blade');
      sections.push(bladeView);
      sections.push('```');
      sections.push('');

      // 4. Vite Imports
      sections.push('## 4. Vite Asset Imports');
      sections.push('Add to your layout\'s `<head>` or the page-specific `@push(\'styles\')` / `@push(\'scripts\')`:');
      sections.push('```blade');
      sections.push(`@vite([`);
      for (const s of viteImports.scss) {
        sections.push(`    '${s}',`);
      }
      for (const j of viteImports.js) {
        sections.push(`    '${j}',`);
      }
      sections.push('])');
      sections.push('```');
      sections.push('');

      if (viteImports.js.length > 1) {
        sections.push('**Page-specific JS dependencies detected:**');
        for (const j of viteImports.js.slice(1)) {
          sections.push(`- \`${j}\``);
        }
        sections.push('');
        sections.push('If these are loaded globally in your layout, you can omit them from the page-level @vite call.');
        sections.push('');
      }

      // 5. Summary
      sections.push('## 5. Summary');
      sections.push(`| Item | Path |`);
      sections.push(`|------|------|`);
      sections.push(`| Controller | \`app/Http/Controllers/${controllerName}.php\` |`);
      sections.push(`| Route | \`GET /${routePrefix}\` (name: \`${routePrefix.replace(/\//g, '.')}\`) |`);
      sections.push(`| Blade View | \`${bladeFilePath}\` |`);
      sections.push(`| View Name | \`${viewName}\` |`);
      if (variables.length > 0) {
        sections.push(`| Controller Vars | ${variables.map((v) => `\`$${v}\``).join(', ')} |`);
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: sections.join('\n'),
          },
        ],
      };
    },
  );
}
