Okay, let's break down the plan to build this `make-mcp-docs-server` CLI tool. Your analysis of feasibility and the proposed workflow is spot on. Here's a refined plan focusing on the implementation details and structure for creating this tool.

**Project Goal:** Create a Node.js CLI tool (`make-mcp-docs-server`) that generates a self-contained, runnable MCP server (`dist/index.js`) exposing markdown documentation via specific tools.

**Core Technologies:**
*   **CLI Framework:** `commander` (or `yargs`)
*   **File System Globbing:** `glob`
*   **File System Operations:** Node.js `fs` module
*   **MCP Server:** `@modelcontextprotocol/sdk`
*   **Fuzzy Search:** `fuse.js`
*   **Bundler:** `esbuild`
*   **Language:** TypeScript (for both the CLI tool and the generated server)

---

### Step-by-Step Implementation Plan for `make-mcp-docs-server`

**1. Project Setup:**

*   Initialize a new Node.js project: `npm init -y`
*   Install TypeScript and necessary types: `npm install --save-dev typescript @types/node @types/glob @types/fuse.js`
*   Install runtime dependencies for the CLI tool: `npm install commander glob esbuild @modelcontextprotocol/sdk fuse.js`
    *   Note: `@modelcontextprotocol/sdk` and `fuse.js` are needed *by the CLI tool* to potentially reference types and are *also* dependencies of the *generated code*, which `esbuild` will bundle. `esbuild` is needed by the CLI to perform the bundling step.
*   Configure `tsconfig.json` for the CLI tool development.
*   Set up a `bin` entry in `package.json` to make the tool executable (e.g., `"bin": { "make-mcp-docs-server": "cli/index.js" }`).
*   Create a source directory (e.g., `src`) and an output directory for the compiled CLI tool (e.g., `cli`).

**2. CLI Argument Parsing (`src/index.ts`):**

*   Use `commander` to define the CLI interface.
    ```typescript
    import { Command } from 'commander';
    import { generateServer } from './generator'; // We'll create this

    const program = new Command();

    program
      .name('make-mcp-docs-server')
      .description('Generates an MCP server from markdown documentation files.')
      .version('0.1.0'); // Or read from package.json

    program
      .requiredOption('-d, --docs <pattern>', 'Glob pattern for markdown files (e.g., "**/*.md")')
      .requiredOption('-p, --packageName <name>', 'Name for the generated MCP server (e.g., MyDocsServer)')
      .option('-o, --outDir <dir>', 'Output directory for the bundled server', 'dist') // Default to 'dist'
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
    ```

**3. File Scanning and Content Reading (`src/generator.ts`):**

*   Use `glob` to find files.
*   Use `fs.readFileSync` to read content. Store relative paths.
    ```typescript
    import { glob } from 'glob';
    import * as fs from 'fs';
    import * as path from 'path';
    import { build } from 'esbuild'; // Import esbuild programmatic API

    // ... (generateServer function definition starts here)
    export async function generateServer(docsPattern: string, packageName: string, outDir: string) {
      const filePaths = await glob(docsPattern, { nodir: true, absolute: false }); // Use relative paths

      if (filePaths.length === 0) {
        console.warn(`⚠️ No files found matching pattern: ${docsPattern}`);
        // Decide if this should be an error or just generate an empty server
        // return; // Or proceed to generate an empty server
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

      // ... (Code generation and bundling steps follow)
    }
    ```

**4. MCP Server Code Generation (`src/generator.ts` continued):**

*   Create a template string or load a template file for the server code.
*   Inject the gathered `docs` data and `packageName`.
    ```typescript
    // (Inside generateServer function)

    // Escape backticks and backslashes in content for template literal safety
    const escapeTemplateLiteral = (str: string) => str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${');

    const docsEntries = Object.entries(docs)
      .map(([name, content]) => `  '${escapeTemplateLiteral(name)}': \`${escapeTemplateLiteral(content)}\``)
      .join(',\n');

    const serverCode = `
    import { Server } from '@modelcontextprotocol/sdk/server';
    import { StdioServerTransport } from '@modelcontextprotocol/sdk/stdio_server_transport'; // Correct import
    import Fuse from 'fuse.js';
    import process from 'process'; // Make sure process is available

    // Embedded markdown files - populated by make-mcp-docs-server
    const docs: Record<string, string> = {
    ${docsEntries}
    };

    // --- Server Configuration ---
    const SERVER_NAME = '${packageName}';
    const SERVER_VERSION = '1.0.0'; // Consider making this configurable
    const FUSE_OPTIONS = {
      keys: ['content'], // Search within the document content
      threshold: 0.3,   // Fuzzy search sensitivity (0=exact, 1=match anything)
      includeScore: false, // Set to true to see search scores
      // includeMatches: true, // Useful for highlighting results (more complex)
      // minMatchCharLength: 3, // Minimum query length for matching
    };
    const LIST_DOCS_PREVIEW_LINES = 50;

    // --- Initialize Fuse ---
    const fuse = new Fuse(
      Object.entries(docs).map(([name, content]) => ({ name, content })),
      FUSE_OPTIONS
    );

    // --- Initialize MCP Server ---
    const server = new Server({
      name: SERVER_NAME,
      version: SERVER_VERSION,
      tools: {}, // Tools will be added below
    });

    // --- Define Tools ---

    server.setTool('list_docs', {
      description: \`List available documents. Shows the relative path and the first \${LIST_DOCS_PREVIEW_LINES} lines of each.\`,
      parameters: {}, // No parameters needed
      handler: async () => {
        const list = Object.entries(docs).map(([name, content]) => {
          const lines = content.split('\\n').slice(0, LIST_DOCS_PREVIEW_LINES).join('\\n');
          return \`--- \${name} ---\\n\${lines}\`;
        }).join('\\n\\n');

        if (!list) {
          return { content: 'No documents found.' };
        }
        return { content: list };
      },
    });

    server.setTool('get_doc', {
      description: 'Get the full content of a specific document by its relative path.',
      parameters: {
        name: { type: 'string', description: 'The relative path of the document (e.g., "src/readme.md").', required: true },
      },
      handler: async (params) => {
        const { name } = params;
        if (!name || typeof name !== 'string') {
            throw new Error('Parameter "name" (string) is required.');
        }
        const content = docs[name];
        if (content === undefined) { // Check for undefined explicitly
          throw new Error(\`Document '\${name}' not found. Use list_docs to see available documents.\`);
        }
        return { content };
      },
    });

    server.setTool('search_docs', {
      description: 'Search across all documents using fuzzy matching (powered by Fuse.js). Returns a list of matching document names.',
      parameters: {
        query: { type: 'string', description: 'The search term or query.', required: true },
      },
      handler: async (params) => {
        const { query } = params;
         if (!query || typeof query !== 'string') {
            throw new Error('Parameter "query" (string) is required.');
        }
        const results = fuse.search(query);
        if (results.length === 0) {
          return { content: \`No matches found for query: "\${query}"\` };
        }
        const matches = results.map(result => result.item.name);
        return { content: \`Matches for "\${query}":\\n\${matches.join('\\n')}\` };
      },
    });

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
    ```

**5. Bundling with `esbuild` (`src/generator.ts` continued):**

*   Write the generated code to a temporary file.
*   Use `esbuild`'s programmatic API to bundle it.
*   Clean up the temporary file.
    ```typescript
    // (Inside generateServer function, after generating serverCode)

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
        external: ['canvas', 'jsdom', 'node-fetch', 'ws'], // Common externals needed by MCP SDK/dependencies
        minify: false, // Keep readable for debugging, set true for prod
        sourcemap: false, // Or 'inline'/'external' if needed
        logLevel: 'info', // Or 'warning', 'error', 'silent'
        target: 'node18', // Specify target Node version
      });

      console.log(`Bundled server written to ${outputFilePath}`);

    } catch (bundleError) {
      console.error('❌ esbuild bundling failed:', bundleError);
      throw bundleError; // Re-throw to be caught by the main CLI handler
    } finally {
      // Clean up temporary file
      try {
        fs.unlinkSync(tempFilePath);
      } catch (cleanupError) {
        console.warn(`⚠️ Could not delete temporary file ${tempFilePath}: ${cleanupError}`);
      }
    }
    ```

**6. Publishing and Usage:**

*   Compile your CLI tool: `tsc`
*   Make it executable globally: `npm link` (for local testing) or `npm publish` (to share).
*   Run it in a project with markdown files:
    ```bash
    cd /path/to/your/project/with/markdown
    npx make-mcp-docs-server --docs "docs/**/*.md" --packageName MyProjectDocs
    ```
*   Run the generated server:
    ```bash
    node dist/index.js
    ```

---

### Refinements and Considerations:

*   **Error Handling:** Add more robust error handling (file not found, permissions, bundling errors).
*   **Configuration:** Allow configuring Fuse.js options (`threshold`, `keys`) via CLI flags.
*   **Dependencies:** Ensure the `package.json` for `make-mcp-docs-server` correctly lists its dependencies. `esbuild` must be available when the CLI runs.
*   **Externals:** The `external` list for `esbuild` might need adjustment depending on the exact version of the MCP SDK and its transitive dependencies. These are often platform-specific or native addons that shouldn't be bundled.
*   **Server Versioning:** Allow passing a version for the generated server via a CLI flag (`--serverVersion`).
*   **Generated `package.json`:** Optionally, the CLI could also generate a basic `package.json` in the `dist` folder to make it easier to publish the generated server itself, although bundling aims to avoid needing this.
*   **Watching:** A `--watch` mode for the CLI could monitor the markdown files and regenerate the server on changes, useful during development.

This detailed plan provides a solid foundation for building the `make-mcp-docs-server` tool exactly as you envisioned. It leverages the specified technologies and creates a truly frictionless way to generate documentation-based MCP servers.