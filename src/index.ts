#!/usr/bin/env node

import { Command } from 'commander';
import { generateServer } from './generator';

const program = new Command();

program
  .name('make-mcp-docs-server')
  .description('Generates an MCP server from markdown documentation files.')
  .version('1.0.0');

program
  .requiredOption('-d, --docs <pattern>', 'Glob pattern for markdown files (e.g., "**/*.md")')
  .requiredOption('-p, --packageName <name>', 'Name for the generated MCP server (e.g., MyDocsServer)')
  .option('-o, --outDir <dir>', 'Output directory for the bundled server', 'dist')
  .action(async (options) => {
    try {
      console.log(`Scanning for files matching: ${options.docs}`);
      console.log(`Generating server named: ${options.packageName}`);
      await generateServer(options.docs, options.packageName, options.outDir);
      console.log(`✅ MCP server successfully generated in ${options.outDir}/index.js`);
      console.log(`   Run it with: node ${options.outDir}/index.js`);
    } catch (error) {
      console.error('❌ Error generating MCP server:', error);
      process.exit(1);
    }
  });

program.parse(process.argv); 