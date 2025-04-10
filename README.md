# MCP Server Maker

A CLI tool that generates a self-contained, runnable MCP (Model Context Protocol) server that exposes markdown documentation via specific tools.

## Installation

You can install the tool globally:

```bash
npm install -g mcp-server-maker
```

Or use it directly with npx:

```bash
npx mcp-server-maker --docs "path/to/docs/**/*.md" --packageName MyDocsServer
```

## Usage

```bash
make-mcp-docs-server --docs <pattern> --packageName <name> [--outDir <dir>]
```

### Options

- `-d, --docs <pattern>`: Glob pattern for markdown files (required)
- `-p, --packageName <name>`: Name for the generated MCP server (required)
- `-o, --outDir <dir>`: Output directory for the bundled server (default: "dist")

### Example

```bash
# Generate a server from all markdown files in the docs directory
make-mcp-docs-server --docs "docs/**/*.md" --packageName ProjectDocs

# Run the generated server
node dist/index.js
```

## Generated Server Tools

The generated MCP server provides the following tools:

- `list_docs`: Lists all available documents with a preview of their content
- `get_doc`: Gets the full content of a specific document by its path
- `search_docs`: Searches across all documents using fuzzy matching

## Development

To build the CLI tool:

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Link for local development
npm link
``` 