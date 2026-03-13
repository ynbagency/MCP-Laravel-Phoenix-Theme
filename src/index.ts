#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Tools — Theme Browsing
import { register as registerListComponents } from './tools/list-components.js';
import { register as registerGetComponent } from './tools/get-component.js';
import { register as registerListLayouts } from './tools/list-layouts.js';
import { register as registerGetLayout } from './tools/get-layout.js';
import { register as registerListPages } from './tools/list-pages.js';
import { register as registerGetPage } from './tools/get-page.js';
import { register as registerSearchTheme } from './tools/search-theme.js';
import { register as registerGetThemeVariables } from './tools/get-theme-variables.js';
import { register as registerListApps } from './tools/list-apps.js';
import { register as registerGetAppStructure } from './tools/get-app-structure.js';

// Tools — Laravel Generation
import { register as registerGenerateBladeComponent } from './tools/generate-blade-component.js';
import { register as registerGenerateBladePage } from './tools/generate-blade-page.js';
import { register as registerGenerateLaravelScaffold } from './tools/generate-laravel-scaffold.js';
import { register as registerGetAssetSetup } from './tools/get-asset-setup.js';

// Resources
import { register as registerResources } from './resources/register-resources.js';

const server = new McpServer({
  name: 'phoenix-theme',
  version: '1.0.0',
});

// Register all tools
registerListComponents(server);
registerGetComponent(server);
registerListLayouts(server);
registerGetLayout(server);
registerListPages(server);
registerGetPage(server);
registerSearchTheme(server);
registerGetThemeVariables(server);
registerListApps(server);
registerGetAppStructure(server);
registerGenerateBladeComponent(server);
registerGenerateBladePage(server);
registerGenerateLaravelScaffold(server);
registerGetAssetSetup(server);

// Register resources
registerResources(server);

// Connect via stdio
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('Phoenix Theme MCP Server running on stdio');
