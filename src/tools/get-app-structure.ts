import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { resolvePath } from '../theme-path.js';
import { scanDirectory, readFileContent } from '../utils/file-scanner.js';
import { stat } from 'node:fs/promises';

/** Suggested Laravel route-group prefixes for each app. */
const ROUTE_PREFIXES: Record<string, string> = {
  calendar: '/calendar',
  chat: '/chat',
  crm: '/crm',
  'e-commerce': '/shop',
  email: '/email',
  events: '/events',
  'file-manager': '/file-manager',
  gallery: '/gallery',
  'gantt-chart': '/gantt-chart',
  kanban: '/kanban',
  'project-management': '/projects',
  social: '/social',
  stock: '/stock',
  'travel-agency': '/travel',
  dashboard: '/dashboard',
};

/**
 * Check whether a path exists on disk.
 */
async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert an app name like "e-commerce" to a StudlyCase controller prefix
 * e.g. "ECommerce".
 */
function toStudly(name: string): string {
  return name
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/**
 * Convert a page filename (without extension) to a StudlyCase name.
 * e.g. "add-contact" -> "AddContact"
 */
function pageToStudly(pageName: string): string {
  return pageName
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

/**
 * Extract the layout name from a Pug file's `extends` directive.
 * e.g. "extends ../../layouts/LayoutTheme" -> "LayoutTheme"
 */
function extractLayout(pugContent: string): string | null {
  const match = pugContent.match(/^extends\s+.*\/(Layout\w+)/m);
  return match ? match[1] : null;
}

/**
 * Extract `include` references from a Pug file.
 */
function extractIncludes(pugContent: string): string[] {
  const includes: string[] = [];
  const regex = /^include\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(pugContent)) !== null) {
    includes.push(m[1].trim());
  }
  return includes;
}

export function register(server: McpServer): void {
  server.registerTool(
    'get_app_structure',
    {
      description:
        'Get the full structure of a Phoenix theme application module. ' +
        'Returns page list, Pug layouts used, mixin files, SCSS partials, JS files, ' +
        'and a Laravel scaffold summary (controllers, route prefix, Blade view directory).',
      inputSchema: z.object({
        app: z
          .string()
          .describe(
            'App name, e.g. "crm", "e-commerce", "kanban", "dashboard".',
          ),
      }),
    },
    async (input) => {
      const app = input.app.toLowerCase().trim();

      // ---------- 1. Resolve the HTML pages directory ----------
      const isDashboard = app === 'dashboard';
      const htmlDir = isDashboard
        ? resolvePath('public/dashboard')
        : resolvePath('public/apps', app);

      if (!(await exists(htmlDir))) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `App "${app}" not found. No directory at public/${isDashboard ? 'dashboard' : `apps/${app}`}.`,
            },
          ],
        };
      }

      // ---------- 2. Scan HTML pages ----------
      const htmlFiles = await scanDirectory(htmlDir, ['.html']);
      const pages = htmlFiles.map((f) => f.relativePath);

      // ---------- 3. Scan Pug source pages ----------
      const pugPagesDir = isDashboard
        ? resolvePath('src/pug/dashboard')
        : resolvePath('src/pug/apps', app);
      const pugPagesExist = await exists(pugPagesDir);
      const pugPages = pugPagesExist
        ? await scanDirectory(pugPagesDir, ['.pug'])
        : [];

      // Parse layouts and includes from each Pug page
      const layoutsUsed = new Set<string>();
      const allIncludes: string[] = [];

      for (const pf of pugPages) {
        const content = await readFileContent(pf.absolutePath);
        const layout = extractLayout(content);
        if (layout) layoutsUsed.add(layout);
        allIncludes.push(...extractIncludes(content));
      }

      // ---------- 4. Scan Pug mixins ----------
      const mixinsDir = resolvePath('src/pug/mixins', app);
      const mixinsExist = await exists(mixinsDir);
      const mixinFiles = mixinsExist
        ? await scanDirectory(mixinsDir, ['.pug'])
        : [];

      // ---------- 5. Check SCSS ----------
      // Try common naming patterns: _app.scss, _ecommerce.scss, _e-commerce.scss
      const scssNames = [
        `_${app}.scss`,
        `_${app.replace(/-/g, '')}.scss`,
      ];
      const scssDir = resolvePath('src/scss/theme');
      const scssFiles: string[] = [];
      for (const name of scssNames) {
        const scssPath = `${scssDir}/${name}`;
        if (await exists(scssPath)) {
          scssFiles.push(`src/scss/theme/${name}`);
        }
      }

      // ---------- 6. Check JS ----------
      const jsDir = resolvePath('src/js/theme');
      const jsPatterns = [
        `${app}.js`,
        `${app.replace(/-/g, '')}.js`,
      ];
      const jsFiles: string[] = [];

      // Check for direct JS files
      for (const name of jsPatterns) {
        if (await exists(`${jsDir}/${name}`)) {
          jsFiles.push(`src/js/theme/${name}`);
        }
      }

      // Check for JS subdirectory (e.g. src/js/theme/calendar/)
      const jsDirForApp = `${jsDir}/${app}`;
      if (await exists(jsDirForApp)) {
        const subFiles = await scanDirectory(jsDirForApp, ['.js']);
        for (const sf of subFiles) {
          jsFiles.push(`src/js/theme/${app}/${sf.relativePath}`);
        }
      }
      // Also try without hyphens (e.g. ganttchart for gantt-chart)
      const jsAltDir = `${jsDir}/${app.replace(/-/g, '')}`;
      if (jsAltDir !== jsDirForApp && (await exists(jsAltDir))) {
        const subFiles = await scanDirectory(jsAltDir, ['.js']);
        for (const sf of subFiles) {
          jsFiles.push(`src/js/theme/${app.replace(/-/g, '')}/${sf.relativePath}`);
        }
      }

      // ---------- 7. Build Laravel scaffold summary ----------
      const studly = toStudly(app);
      const routePrefix = ROUTE_PREFIXES[app] ?? `/${app}`;
      const bladeDir = isDashboard ? 'dashboard' : `apps/${app}`;

      // Group pages by subdirectory for controller suggestions
      const controllerMap = new Map<string, string[]>();
      for (const page of pages) {
        const parts = page.split('/');
        if (parts.length === 1) {
          // Top-level page
          const group = '__root__';
          if (!controllerMap.has(group)) controllerMap.set(group, []);
          controllerMap.get(group)!.push(parts[0].replace(/\.html$/, ''));
        } else {
          // Nested: first segment is the sub-group
          const group = parts[0];
          if (!controllerMap.has(group)) controllerMap.set(group, []);
          controllerMap.get(group)!.push(
            parts.slice(1).join('/').replace(/\.html$/, ''),
          );
        }
      }

      const controllers: string[] = [];
      for (const [group, groupPages] of controllerMap) {
        if (group === '__root__') {
          controllers.push(
            `${studly}Controller  (${groupPages.length} action${groupPages.length !== 1 ? 's' : ''}): ` +
              groupPages.map((p) => pageToStudly(p)).join(', '),
          );
        } else {
          const subStudly = toStudly(group);
          controllers.push(
            `${studly}${subStudly}Controller  (${groupPages.length} action${groupPages.length !== 1 ? 's' : ''}): ` +
              groupPages.map((p) => pageToStudly(p)).join(', '),
          );
        }
      }

      // ---------- 8. Format output ----------
      const sections: string[] = [];

      sections.push(`=== App: ${app} ===`);
      sections.push('');

      // Pages
      sections.push(`Pages (${pages.length}):`);
      for (const p of pages) {
        sections.push(`  ${p}`);
      }
      sections.push('');

      // Layouts
      if (layoutsUsed.size > 0) {
        sections.push(`Pug Layouts Used:`);
        for (const l of layoutsUsed) {
          sections.push(`  ${l}  (src/pug/layouts/${l}.pug)`);
        }
        sections.push('');
      }

      // Mixins
      if (mixinFiles.length > 0) {
        sections.push(`Pug Mixins (${mixinFiles.length}):`);
        for (const mf of mixinFiles) {
          sections.push(`  src/pug/mixins/${app}/${mf.relativePath}`);
        }
        sections.push('');
      }

      // SCSS
      if (scssFiles.length > 0) {
        sections.push(`SCSS:`);
        for (const sf of scssFiles) {
          sections.push(`  ${sf}`);
        }
        sections.push('');
      }

      // JS
      if (jsFiles.length > 0) {
        sections.push(`JavaScript (${jsFiles.length}):`);
        for (const jf of jsFiles) {
          sections.push(`  ${jf}`);
        }
        sections.push('');
      }

      // Laravel scaffold
      sections.push('--- Laravel Scaffold Summary ---');
      sections.push(`Route group prefix: ${routePrefix}`);
      sections.push(`Blade view directory: resources/views/${bladeDir}/`);
      sections.push('');
      sections.push(`Suggested Controllers:`);
      for (const c of controllers) {
        sections.push(`  ${c}`);
      }

      // Blade views
      sections.push('');
      sections.push('Blade Views:');
      for (const page of pages) {
        const bladeName = page
          .replace(/\.html$/, '')
          .replace(/\//g, '.');
        sections.push(`  ${bladeDir}.${bladeName}  ->  resources/views/${bladeDir}/${page.replace(/\.html$/, '.blade.php')}`);
      }

      return {
        content: [{ type: 'text' as const, text: sections.join('\n') }],
      };
    },
  );
}
