# MCP Sentry Server (Node.js)

This is a Node.js + TypeScript implementation of the Model Context Protocol (MCP) Sentry server. It provides integration with Sentry for retrieving error reports and stacktraces through MCP.

[中文文档](./README_CN.md)

## Features

- Integration with Sentry API for error tracking and monitoring
- Support for both standard MCP over stdin/stdout and SSE (Server-Sent Events) transport
- Configurable port for the SSE server (default: 3579)

## Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.5.2

## Installation

Clone the repository and install dependencies:

```bash
pnpm install
```

## Configuration

Create a `.env` file in the root directory with your Sentry authentication token:

```
SENTRY_TOKEN=your_sentry_auth_token_here
```

You can obtain your Sentry authentication token from your Sentry account settings.

## Usage

### Build the Project

```bash
pnpm build
```

### Run the Server

```bash
pnpm start
```

Alternatively, you can specify the Sentry authentication token and API base as command-line arguments:

```bash
pnpm start --auth-token your_sentry_auth_token_here --api-base your_sentry_api_base_here
```

### Run with SSE Support

```bash
pnpm start:sse
```

This will start an Express server with SSE support on port 3579 (default). You can access the SSE endpoint at:
```
http://localhost:3579/sse
```

You can also customize the environment variables using a `.env.local` file.

### Development Mode

```bash
pnpm dev
```

### MCP Configuration

```json
{
  "mcpServers": {
    "sentry-server": {
      "command": "npx",
      "args": ["-y","@weekit/mcp-sentry@1.0.8"],
      "env": {
        "SENTRY_TOKEN": "your_sentry_auth_token_here",
        "SENTRY_API_BASE": "https://your_sentry_api_base_here"
      }
    }
  }
}
```

Using local build:

```json
{
  "mcpServers": {
    "my-sentry": {
      "command": "node",
      "args": ["path/to/dist/index.js"],
      "env": {
        "SENTRY_TOKEN": "your_sentry_auth_token_here",
        "SENTRY_API_BASE": "https://your_sentry_api_base_here"
      }
    }
  }
}
```

## Communication Protocols

The MCP Sentry server supports two communication protocols:

1. **Standard MCP Protocol**: Communication over standard input/output streams
2. **SSE Transport**: Server-Sent Events for web-based communication via HTTP (port 3579)

## MCP Features

The MCP Sentry server provides the following features through the MCP protocol:

### Prompts

- `sentry-issue`: Retrieve a Sentry issue by ID or URL
- `most-triggered-issue`: Find the issue affecting the most users from a Sentry issues list URL

### Tools

- `get_sentry_issue`: Retrieve and analyze a Sentry issue by ID or URL
- `get_sentry_issues_list`: Retrieve and analyze a list of Sentry issues from a URL

## API

The server communicates using the Model Context Protocol over standard input/output streams and provides the following functionalities:

1. Listing available prompts and tools
2. Retrieving Sentry issue information including:
   - Issue title and ID
   - Status and severity level
   - First and last seen timestamps
   - Event count
   - Detailed stacktrace

## MCP Workflow

Below is the workflow diagram of the MCP Sentry server:

```mermaid
flowchart TD
    A[Client/LLM] -->|1. Send MCP Request| B[MCP Sentry Server]
    B -->|2. Parse Request Type| C{Determine Request Type}

    C -->|Prompt Request| D[Handle Prompt\nsentry-issue]
    C -->|Tool Request| E[Handle Tool\nget_sentry_issue]

    D -->|3. Extract Issue ID| F[Call Sentry API]
    E -->|3. Extract Issue ID| F

    F -->|4. Get Issue Data| G[Sentry API]
    G -->|5. Return Issue Data| F
    F -->|6. Get Event Data| G
    G -->|7. Return Event Data| F

    F -->|8. Parse Data| H[Create SentryIssueData Object]
    H -->|9. Format Data| I{Response Type}

    I -->|Prompt Response| J[Convert to PromptResult Format]
    I -->|Tool Response| K[Convert to ToolResult Format]

    J -->|10. Return Response| B
    K -->|10. Return Response| B

    B -->|11. Send MCP Response| A
```

## Testing

Run all tests:

```bash
pnpm test
```

Run unit tests:

```bash
pnpm test test/unit.test.ts
```

Run integration tests:

```bash
pnpm test test/integration.test.ts
```

View test coverage:

```bash
pnpm test -- --coverage
```
