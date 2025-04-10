# @tiberriver256/docs-to-mcp-cli

A CLI tool that generates a self-contained, runnable MCP (Model Context Protocol) server that exposes markdown documentation via specific tools.

## Project Goal

Create a Node.js CLI tool that generates a self-contained, runnable MCP server (`dist/index.js`) exposing markdown documentation via specific tools. The generated server will make your documentation available to AI assistants through the Model Context Protocol.

## Installation

You can install the tool globally:

```bash
npm install -g @tiberriver256/docs-to-mcp-cli
```

Or use it directly with npx:

```bash
npx @tiberriver256/docs-to-mcp-cli --docs "path/to/docs/**/*.md" --packageName MyDocsServer
```

## Usage

```bash
docs-to-mcp-cli --docs <pattern> --packageName <name> [--outDir <dir>]
```

### Options

- `-d, --docs <pattern>`: Glob pattern for markdown files (required)
- `-p, --packageName <name>`: Name for the generated MCP server (required)
- `-o, --outDir <dir>`: Output directory for the bundled server (default: "dist")

### Example

```bash
# Generate a server from all markdown files in the docs directory
docs-to-mcp-cli --docs "docs/**/*.md" --packageName ProjectDocs

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
