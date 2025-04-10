import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import { build } from 'esbuild';

/**
 * Generate an MCP server that serves the content of markdown files
 * @param docsPattern Glob pattern to find markdown files
 * @param packageName Name of the MCP server
 * @param outDir Output directory for the bundled server
 */
export async function generateServer(docsPattern: string, packageName: string, outDir: string) {
  const filePaths = await glob(docsPattern, { nodir: true, absolute: false });

  if (filePaths.length === 0) {
    console.warn(`⚠️ No files found matching pattern: ${docsPattern}`);
    // Continue to generate an empty server
  } else {
    console.log(`Found ${filePaths.length} files.`);
  }

  const docs: Record<string, string> = {};
  for (const filePath of filePaths) {
    try {
      // Use relative path as the key for clarity within the server
      const relativePath = path.relative(process.cwd(), filePath);
      docs[relativePath] = fs.readFileSync(filePath, 'utf-8');
    } catch (readError) {
      console.warn(`⚠️ Skipping file ${filePath} due to read error: ${readError}`);
    }
  }

  // Escape backticks and backslashes in content for template literal safety
  const escapeTemplateLiteral = (str: string) => 
    str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${');

  const docsEntries = Object.entries(docs)
    .map(([name, content]) => `  '${escapeTemplateLiteral(name)}': \`${escapeTemplateLiteral(content)}\``)
    .join(',\n');

  const serverCode = `
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Fuse from 'fuse.js';
import { z } from "zod";

// Embedded markdown files - populated by make-mcp-docs-server
const docs: Record<string, string> = {
${docsEntries}
};

// --- Server Configuration ---
const SERVER_NAME = '${packageName}';
const SERVER_VERSION = '1.0.0';
const FUSE_OPTIONS = {
  keys: ['content'], // Search within the document content
  threshold: 0.3,   // Fuzzy search sensitivity (0=exact, 1=match anything)
  includeScore: false, // Set to true to see search scores
};
const LIST_DOCS_PREVIEW_LINES = 20;

// --- Initialize Fuse ---
const fuse = new Fuse(
  Object.entries(docs).map(([name, content]) => ({ name, content })),
  FUSE_OPTIONS
);

// --- Initialize MCP Server ---
const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION
});

// --- Define Tools ---

server.tool(
  'list_docs',
  {},
  async () => {
    const list = Object.entries(docs).map(([name, content]) => {
      const lines = content.split('\\n').slice(0, LIST_DOCS_PREVIEW_LINES).join('\\n');
      return \`--- \${name} ---\\n\${lines}\`;
    }).join('\\n\\n');

    if (!list) {
      return { content: [{type: "text", text: 'No documents found.'}] };
    }
    return { content: [{type: "text", text: list}] };
  }
);

server.tool(
  'get_doc',
  {
    name: z.string().describe('The relative path of the document (e.g., "src/readme.md").')
  },
  async ({ name }) => {
    const content = docs[name];
    if (content === undefined) { // Check for undefined explicitly
      throw new Error(\`Document '\${name}' not found. Use list_docs to see available documents.\`);
    }
    return { content: [{type: "text", text: content}] };
  }
);

server.tool(
  'search_docs',
  {
    query: z.string().describe('The search term or query.')
  },
  async ({ query }) => {
    const results = fuse.search(query);
    if (results.length === 0) {
      return { content: [{type: "text", text: \`No matches found for query: "\${query}"\`}] };
    }
    const matches = results.map(result => result.item.name);
    return { content: [{type: "text", text: \`Matches for "\${query}":\\n\${matches.join('\\n')}\`}] };
  }
);

// --- Start the Server ---
async function main() {
  console.log(\`[\${SERVER_NAME}] MCP Server starting...\`);
  const transport = new StdioServerTransport();
  try {
    await server.connect(transport);
    console.log(\`[\${SERVER_NAME}] MCP Server connected via stdio.\`);
    // Keep alive indefinitely until transport closes or process exits
    await new Promise(() => {}); // Keep node process running
  } catch (error) {
    console.error(\`[\${SERVER_NAME}] Failed to start or connect server: \${error}\`);
    process.exit(1); // Exit if connection fails
  }
}

main();
`;

  const tempFilePath = path.join(outDir, `_temp_server_${Date.now()}.ts`);
  const outputFilePath = path.join(outDir, 'index.js');

  // Ensure output directory exists
  fs.mkdirSync(outDir, { recursive: true });

  // Write temporary TS file
  fs.writeFileSync(tempFilePath, serverCode, 'utf-8');

  try {
    // Bundle using esbuild
    await build({
      entryPoints: [tempFilePath],
      bundle: true,
      outfile: outputFilePath,
      platform: 'node',
      format: 'cjs', // CommonJS for broad Node compatibility
      external: ['@modelcontextprotocol/sdk', 'zod', 'fuse.js'], // External dependencies 
      minify: false, // Keep readable for debugging
      sourcemap: false,
      logLevel: 'info',
      target: 'node18',
    });

    console.log(`Bundled server written to ${outputFilePath}`);

    // Create package.json for the output directory
    const packageJsonPath = path.join(outDir, 'package.json');
    fs.writeFileSync(packageJsonPath, JSON.stringify({
      name: packageName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      version: "1.0.0",
      description: `MCP server for ${packageName} documentation`,
      main: "index.js",
      dependencies: {
        "@modelcontextprotocol/sdk": "^1.9.0",
        "fuse.js": "^7.1.0",
        "zod": "^3.22.4"
      }
    }, null, 2));
    
    console.log(`Generated package.json in ${outDir}`);

  } catch (bundleError) {
    console.error('❌ esbuild bundling failed:', bundleError);
    throw bundleError;
  } finally {
    // Clean up temporary file
    try {
      fs.unlinkSync(tempFilePath);
    } catch (cleanupError) {
      console.warn(`⚠️ Could not delete temporary file ${tempFilePath}: ${cleanupError}`);
    }
  }
} 