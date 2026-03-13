import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { resolvePath } from '../theme-path.js';
import { scanDirectory } from '../utils/file-scanner.js';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

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

interface AppInfo {
  name: string;
  type: 'single-page' | 'multi-page';
  pageCount: number;
  routePrefix: string;
}

/**
 * Count all HTML files recursively under a directory.
 */
async function countHtmlPages(dir: string): Promise<number> {
  try {
    const files = await scanDirectory(dir, ['.html']);
    return files.length;
  } catch {
    return 0;
  }
}

/**
 * Detect top-level apps inside public/apps/.
 * Standalone .html files are single-page apps; subdirectories are multi-page.
 */
async function discoverApps(): Promise<AppInfo[]> {
  const appsDir = resolvePath('public/apps');
  const entries = await readdir(appsDir, { withFileTypes: true });
  const apps: AppInfo[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subDir = resolve(entry.parentPath ?? entry.path, entry.name);
      const pageCount = await countHtmlPages(subDir);
      apps.push({
        name: entry.name,
        type: pageCount <= 1 ? 'single-page' : 'multi-page',
        pageCount,
        routePrefix: ROUTE_PREFIXES[entry.name] ?? `/${entry.name}`,
      });
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      const appName = entry.name.replace(/\.html$/, '');
      apps.push({
        name: appName,
        type: 'single-page',
        pageCount: 1,
        routePrefix: ROUTE_PREFIXES[appName] ?? `/${appName}`,
      });
    }
  }

  return apps.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Discover dashboard pages under public/dashboard/.
 */
async function discoverDashboard(): Promise<AppInfo> {
  const dashDir = resolvePath('public/dashboard');
  const pageCount = await countHtmlPages(dashDir);
  return {
    name: 'dashboard',
    type: pageCount <= 1 ? 'single-page' : 'multi-page',
    pageCount,
    routePrefix: ROUTE_PREFIXES['dashboard'] ?? '/dashboard',
  };
}

export function register(server: McpServer): void {
  server.registerTool(
    'list_apps',
    {
      description:
        'List all Phoenix theme application modules (CRM, e-commerce, email, kanban, etc.) and the dashboard. ' +
        'Returns each app name, page count, single/multi-page classification, and a suggested Laravel route group prefix.',
      inputSchema: z.object({}),
    },
    async () => {
      const apps = await discoverApps();
      const dashboard = await discoverDashboard();
      const all: AppInfo[] = [...apps, dashboard];

      const totalPages = all.reduce((sum, a) => sum + a.pageCount, 0);

      const lines = [
        `Found ${all.length} app module(s) with ${totalPages} total page(s).`,
        '',
        ...all.map(
          (a) =>
            `${a.name}  (${a.type}, ${a.pageCount} page${a.pageCount !== 1 ? 's' : ''})\n` +
            `  Route prefix: ${a.routePrefix}`,
        ),
      ];

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );
}
