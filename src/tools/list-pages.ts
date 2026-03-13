import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { resolvePath } from '../theme-path.js';
import { scanDirectory } from '../utils/file-scanner.js';
import type { FileEntry } from '../utils/file-scanner.js';

const SECTIONS = ['all', 'apps', 'dashboard', 'pages', 'modules', 'documentation', 'demo'] as const;
type Section = (typeof SECTIONS)[number];

/** Directories to scan, keyed by section name. */
const SECTION_DIRS: Record<Exclude<Section, 'all'>, string> = {
  apps: 'src/pug/apps',
  dashboard: 'src/pug/dashboard',
  pages: 'src/pug/pages',
  modules: 'src/pug/modules',
  documentation: 'src/pug/documentation',
  demo: 'src/pug/demo',
};

interface PageInfo {
  name: string;
  relativePath: string;
  section: string;
}

async function scanSection(section: string, subdir: string): Promise<PageInfo[]> {
  const dir = resolvePath(subdir);
  let files: FileEntry[];
  try {
    files = await scanDirectory(dir, ['.pug']);
  } catch {
    return [];
  }

  return files.map((f) => ({
    name: f.name,
    relativePath: `${subdir}/${f.relativePath}`,
    section,
  }));
}

export function register(server: McpServer): void {
  server.registerTool(
    'list_pages',
    {
      description:
        'List all page templates in the Phoenix theme, grouped by section ' +
        '(apps, dashboard, pages, modules, documentation, demo). ' +
        'Optionally filter to a single section.',
      inputSchema: z.object({
        section: z
          .enum(SECTIONS)
          .optional()
          .default('all')
          .describe('Section to list. Defaults to "all".'),
      }),
    },
    async (input) => {
      const selectedSection: Section = input.section ?? 'all';

      const sectionsToScan: Array<Exclude<Section, 'all'>> =
        selectedSection === 'all'
          ? (Object.keys(SECTION_DIRS) as Array<Exclude<Section, 'all'>>)
          : [selectedSection as Exclude<Section, 'all'>];

      const grouped: Record<string, PageInfo[]> = {};

      for (const sec of sectionsToScan) {
        const pages = await scanSection(sec, SECTION_DIRS[sec]);
        if (pages.length > 0) {
          grouped[sec] = pages;
        }
      }

      const totalCount = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

      const lines: string[] = [
        `Found ${totalCount} page(s)${selectedSection !== 'all' ? ` in section "${selectedSection}"` : ' across all sections'}.`,
        '',
      ];

      for (const [section, pages] of Object.entries(grouped)) {
        lines.push(`## ${section.toUpperCase()} (${pages.length})`);
        for (const page of pages) {
          lines.push(`  - ${page.name}  →  ${page.relativePath}`);
        }
        lines.push('');
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );
}
