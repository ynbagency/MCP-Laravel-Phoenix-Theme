import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod/v4';
import { resolvePath } from '../theme-path.js';
import { scanDirectory, readFileContent } from '../utils/file-scanner.js';
import { convertPugToBladeHints, suggestBladeComponentName } from '../utils/pug-to-blade.js';
import { componentNameFromFilename } from '../utils/component-metadata.js';

/**
 * Convert a PascalCase / camelCase / Title string to kebab-case.
 */
function kebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Parse a Pug mixin definition to extract parameter names and default values.
 *
 * Handles patterns like:
 *   mixin Avatar(src, size='xl', status=null)
 *   mixin Card(title, body, footer)
 */
interface MixinParam {
  name: string;
  defaultValue: string | null;
}

function parseMixinParams(pugSource: string): { mixinName: string; params: MixinParam[] } | null {
  const match = pugSource.match(/^mixin\s+(\w+)\s*\(([^)]*)\)/m);
  if (!match) return null;

  const mixinName = match[1];
  const rawArgs = match[2].trim();
  if (!rawArgs) return { mixinName, params: [] };

  const params: MixinParam[] = rawArgs.split(',').map((arg) => {
    const trimmed = arg.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex !== -1) {
      return {
        name: trimmed.slice(0, eqIndex).trim(),
        defaultValue: trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, ''),
      };
    }
    return { name: trimmed, defaultValue: null };
  });

  return { mixinName, params };
}

/**
 * Extract `attributes` usage from a Pug mixin body.
 * Looks for `&attributes(attributes)` or attribute spread patterns.
 */
function usesAttributes(pugSource: string): boolean {
  return /&attributes\s*\(/.test(pugSource) || /attributes/.test(pugSource);
}

/**
 * Extract CSS classes from the mixin's root element.
 */
function extractRootClasses(pugSource: string): string[] {
  const lines = pugSource.split('\n');
  // Find the first non-mixin-definition, non-comment, non-empty line (the root element)
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('mixin ') || trimmed.startsWith('//-')) continue;
    // Match classes like .avatar.avatar-xl or div.card.shadow
    const classMatches = trimmed.match(/\.([\w-]+)/g);
    if (classMatches) {
      return classMatches.map((c) => c.slice(1));
    }
    break;
  }
  return [];
}

/**
 * Detect whether the mixin uses block (i.e. has `block` keyword for slot content).
 */
function usesBlock(pugSource: string): boolean {
  return /^\s+block\s*$/m.test(pugSource);
}

/**
 * Generate a Blade anonymous component from parsed mixin information.
 */
function generateBladeComponent(
  pugSource: string,
  params: MixinParam[],
  rootClasses: string[],
  hasBlock: boolean,
  hasAttributes: boolean,
): string {
  const lines: string[] = [];

  // @props directive
  if (params.length > 0) {
    const propsEntries = params.map((p) => {
      if (p.defaultValue !== null) {
        // Check if the default is a keyword (null, true, false) or a number
        if (['null', 'true', 'false'].includes(p.defaultValue) || /^\d+$/.test(p.defaultValue)) {
          return `'${p.name}' => ${p.defaultValue}`;
        }
        return `'${p.name}' => '${p.defaultValue}'`;
      }
      return `'${p.name}'`;
    });
    lines.push(`@props([${propsEntries.join(', ')}])`);
    lines.push('');
  }

  // Determine root element and classes
  const baseClasses = rootClasses.length > 0 ? rootClasses.join(' ') : '';

  // Check if any class references a param (like avatar-{$size})
  let classExpr = baseClasses;
  for (const p of params) {
    // Replace patterns like avatar-xl where xl is a default value with dynamic version
    if (p.defaultValue !== null && baseClasses.includes(`-${p.defaultValue}`)) {
      classExpr = classExpr.replace(`-${p.defaultValue}`, `-{$${p.name}}`);
    }
  }

  // Root element opening
  if (hasAttributes && classExpr) {
    lines.push(`<div {{ $attributes->merge(['class' => "${classExpr}"]) }}>`);
  } else if (hasAttributes) {
    lines.push(`<div {{ $attributes }}>`);
  } else if (classExpr) {
    lines.push(`<div class="${classExpr}">`);
  } else {
    lines.push('<div>');
  }

  // Body with prop references
  const indent = '    ';
  for (const p of params) {
    if (['class', 'id', 'style'].includes(p.name)) continue;
    if (p.name === 'src') {
      lines.push(`${indent}<img src="{{ $${p.name} }}" alt="" />`);
    } else if (p.name === 'href' || p.name === 'url') {
      lines.push(`${indent}<a href="{{ $${p.name} }}">{{ $slot }}</a>`);
    } else if (p.name === 'title') {
      lines.push(`${indent}<h5>{{ $${p.name} }}</h5>`);
    } else if (p.name === 'status') {
      lines.push(`${indent}@if($${p.name})`);
      lines.push(`${indent}    <span class="${p.name}-{{ $${p.name} }}"></span>`);
      lines.push(`${indent}@endif`);
    }
  }

  // Slot for block content
  if (hasBlock) {
    lines.push(`${indent}{{ $slot }}`);
  }

  lines.push('</div>');

  return lines.join('\n');
}

/**
 * Try to find compiled HTML pages that showcase a given component name.
 */
async function findHtmlExamples(componentName: string): Promise<string | null> {
  const needle = componentName.toLowerCase();
  try {
    const htmlDir = resolvePath('public');
    const htmlFiles = await scanDirectory(htmlDir, ['.html']);

    // Look for files whose name suggests they showcase the component
    for (const f of htmlFiles) {
      if (f.name.toLowerCase().includes(needle)) {
        const content = await readFileContent(f.absolutePath);
        // Return a truncated version to avoid huge output
        if (content.length > 3000) {
          return content.slice(0, 3000) + '\n\n... (truncated, ' + content.length + ' chars total)';
        }
        return content;
      }
    }
  } catch {
    // public/ directory might not exist
  }
  return null;
}

export function register(server: McpServer): void {
  server.registerTool(
    'generate_blade_component',
    {
      description:
        'Generate a Laravel Blade anonymous component from a Phoenix Pug mixin. ' +
        'Provide a component name (e.g. "Avatar", "Card", "Button") and it will find the ' +
        'matching Pug mixin, parse its parameters, and generate a ready-to-use Blade component ' +
        'with @props, {{ $slot }}, {{ $attributes->merge([...]) }}, and usage examples.',
      inputSchema: z.object({
        name: z
          .string()
          .describe(
            'Component name to search for (e.g. "Avatar", "Card", "Button", "Navbar"). Case-insensitive.',
          ),
      }),
    },
    async (input) => {
      const needle = input.name.toLowerCase();
      const mixinDir = resolvePath('src/pug/mixins');

      let files;
      try {
        files = await scanDirectory(mixinDir, ['.pug']);
      } catch {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error: Could not scan src/pug/mixins/ directory. Ensure the Phoenix theme template is properly installed.',
            },
          ],
        };
      }

      // Find matching Pug mixin files (case-insensitive)
      const matches = files.filter((f) => f.name.toLowerCase().includes(needle));

      if (matches.length === 0) {
        const available = files
          .map((f) => componentNameFromFilename(f.name))
          .slice(0, 20)
          .join(', ');
        return {
          content: [
            {
              type: 'text' as const,
              text:
                `No Pug mixin found matching "${input.name}" in src/pug/mixins/.\n\n` +
                `Available components (first 20): ${available}\n\n` +
                `Try a broader search term or use list_components to browse all available mixins.`,
            },
          ],
        };
      }

      const sections: string[] = [];

      for (const match of matches) {
        const pugSource = await readFileContent(match.absolutePath);
        const friendlyName = componentNameFromFilename(match.name);
        const kebabName = kebabCase(match.name);
        const bladeComponentName = suggestBladeComponentName(match.relativePath);
        const parsed = parseMixinParams(pugSource);
        const rootClasses = extractRootClasses(pugSource);
        const hasBlock = usesBlock(pugSource);
        const hasAttributes = usesAttributes(pugSource);
        const hints = convertPugToBladeHints(pugSource);

        // Generate Blade component
        let bladeComponent: string;
        if (parsed) {
          bladeComponent = generateBladeComponent(
            pugSource,
            parsed.params,
            rootClasses,
            hasBlock,
            hasAttributes,
          );
        } else if (hints.bladeTemplate) {
          bladeComponent = hints.bladeTemplate;
        } else {
          bladeComponent = `{{-- Could not auto-generate. Manual conversion needed. --}}\n${pugSource}`;
        }

        // Build the suggested file path
        const bladePath = `resources/views/components/phoenix/${match.relativePath.replace(/\.pug$/, '.blade.php').replace(/\\/g, '/')}`;

        // Build usage example
        const usageProps = parsed
          ? parsed.params
              .filter((p) => p.defaultValue === null)
              .map((p) => `:${p.name}="$${p.name}"`)
              .join(' ')
          : '';
        const usageTag = hasBlock
          ? `<x-phoenix.${kebabName} ${usageProps}>\n    {{-- Content here --}}\n</x-phoenix.${kebabName}>`
          : `<x-phoenix.${kebabName} ${usageProps} />`;

        sections.push(
          [
            `${'='.repeat(60)}`,
            `## ${friendlyName}`,
            `Pug Source: src/pug/mixins/${match.relativePath}`,
            `Blade Path: ${bladePath}`,
            `Usage:      <x-${bladeComponentName} />`,
            '',
            '### Original Pug Mixin',
            '```pug',
            pugSource,
            '```',
            '',
            '### Generated Blade Component',
            `File: \`${bladePath}\``,
            '```blade',
            bladeComponent,
            '```',
            '',
            '### Usage Example',
            '```blade',
            usageTag.trim(),
            '```',
            '',
            parsed && parsed.params.length > 0
              ? '### Props\n' +
                parsed.params
                  .map(
                    (p) =>
                      `- \`$${p.name}\`${p.defaultValue !== null ? ` (default: ${p.defaultValue})` : ' (required)'}`,
                  )
                  .join('\n')
              : '### Props\nNo parameters detected.',
          ].join('\n'),
        );
      }

      // Try to find HTML examples
      const htmlExample = await findHtmlExamples(input.name);
      if (htmlExample) {
        sections.push(
          [
            '',
            `${'='.repeat(60)}`,
            '## Compiled HTML Example',
            '```html',
            htmlExample,
            '```',
          ].join('\n'),
        );
      }

      return {
        content: [
          {
            type: 'text' as const,
            text:
              `Generated Blade component(s) for "${input.name}" (${matches.length} match(es)):\n\n` +
              sections.join('\n\n'),
          },
        ],
      };
    },
  );
}
