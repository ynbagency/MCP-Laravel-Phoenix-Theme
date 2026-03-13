export function extractScssDescription(content: string): string {
  // Match //| section header comments
  const sectionMatch = content.match(/^\/\/\*[-]+\s*\n\/\/\|\s+(.+)\s*\n\/\/[-]+/m);
  if (sectionMatch) return sectionMatch[1].trim();

  // Match /* */ block comments at start
  const blockMatch = content.match(/^\/\*\s*\n?([\s\S]*?)\*\//);
  if (blockMatch) {
    const lines = blockMatch[1]
      .split('\n')
      .map(l => l.replace(/^\s*\*\s?/, '').trim())
      .filter(Boolean);
    return lines.slice(0, 2).join(' ');
  }

  // Match single-line // comments at start
  const lineMatch = content.match(/^\/\/\s+(.+)/);
  if (lineMatch) return lineMatch[1].trim();

  return '';
}

export function extractPugDescription(content: string): string {
  // Match //- comment blocks
  const match = content.match(/^\/\/-\s+={3,}\s*\n\/\/-\s+(.+)/m);
  if (match) return match[1].trim();

  const simpleMatch = content.match(/^\/\/-\s+(.+)/m);
  if (simpleMatch) return simpleMatch[1].trim();

  return '';
}

export function componentNameFromFilename(filename: string): string {
  // Strip leading underscore, convert kebab-case to Title Case
  const stripped = filename.replace(/^_/, '');
  return stripped
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
