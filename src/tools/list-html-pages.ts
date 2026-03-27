import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { resolvePath } from '../theme-path.js';
import { scanDirectory } from '../utils/file-scanner.js';
import type { FileEntry } from '../utils/file-scanner.js';
import { readdir } from 'node:fs/promises';

const SECTIONS = ['all', 'root', 'apps', 'dashboard', 'pages', 'modules', 'documentation', 'demo'] as const;
type Section = (typeof SECTIONS)[number];

/** Subdirectories inside public/, keyed by section name. */
const SECTION_DIRS: Record<Exclude<Section, 'all' | 'root'>, string> = {
  apps: 'apps',
  dashboard: 'dashboard',
  pages: 'pages',
  modules: 'modules',
  documentation: 'documentation',
  demo: 'demo',
};

interface HtmlPageInfo {
  name: string;
  relativePath: string;
  section: string;
}

async function scanSection(section: string, subdir: string): Promise<HtmlPageInfo[]> {
  const dir = resolvePath('public', subdir);
  let files: FileEntry[];
  try {
    files = await scanDirectory(dir, ['.html']);
  } catch {
    return [];
  }

  return files.map((f) => ({
    name: f.name,
    relativePath: subdir ? `${subdir}/${f.relativePath}` : f.relativePath,
    section,
  }));
}

/** Scan only top-level HTML files in public/ (not recursive). */
async function scanRoot(): Promise<HtmlPageInfo[]> {
  const dir = resolvePath('public');
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.html'))
      .map((e) => ({
        name: e.name.replace(/\.html$/, ''),
        relativePath: e.name,
        section: 'root',
      }))
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  } catch {
    return [];
  }
}

export function register(server: McpServer): void {
  server.registerTool(
    'list_html_pages',
    {
      description:
        'List all compiled HTML pages in the Phoenix theme public/ directory, grouped by section ' +
        '(root, apps, dashboard, pages, modules, documentation, demo). ' +
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

      const grouped: Record<string, HtmlPageInfo[]> = {};

      if (selectedSection === 'all' || selectedSection === 'root') {
        const rootPages = await scanRoot();
        if (rootPages.length > 0) {
          grouped['root'] = rootPages;
        }
      }

      const sectionsToScan: Array<Exclude<Section, 'all' | 'root'>> =
        selectedSection === 'all'
          ? (Object.keys(SECTION_DIRS) as Array<Exclude<Section, 'all' | 'root'>>)
          : selectedSection === 'root'
            ? []
            : [selectedSection as Exclude<Section, 'all' | 'root'>];

      for (const sec of sectionsToScan) {
        const pages = await scanSection(sec, SECTION_DIRS[sec]);
        if (pages.length > 0) {
          grouped[sec] = pages;
        }
      }

      const totalCount = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

      const lines: string[] = [
        `Found ${totalCount} HTML page(s)${selectedSection !== 'all' ? ` in section "${selectedSection}"` : ' across all sections'}.`,
        '',
      ];

      for (const [section, pages] of Object.entries(grouped)) {
        lines.push(`## ${section.toUpperCase()} (${pages.length})`);
        for (const page of pages) {
          lines.push(`  - ${page.name}  →  public/${page.relativePath}`);
        }
        lines.push('');
      }

      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );
}