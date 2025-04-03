import { TransportType } from "./types.js";
import { DEFAULT_SENTRY_API_BASE } from "./constants.js";
import { createServer } from "./core.js";

/**
 * Runs the MCP Sentry server with the given auth token
 *
 * @param authToken Sentry authentication token
 * @param sentryApiBase Base URL for Sentry API, defaults to https://sentry.io/api/0/
 */
export async function runServer(
  authToken: string,
  sentryApiBase: string = DEFAULT_SENTRY_API_BASE,
  transportType: TransportType = "stdio",
  expressOptions?: { port?: number; host?: string }
): Promise<void> {
  try {
    const mcpServer = await createServer(authToken, sentryApiBase);

    if (transportType === "sse") {
      // Use Express server with SSE transport
      const { startExpressServer } = await import("./express-server.js");
      await startExpressServer(mcpServer, {
        cors: true,
      });
      console.log("MCP Server running with SSE transport");
    } else {
      // Default to stdio transport
      const { StdioServerTransport } = await import(
        "@modelcontextprotocol/sdk/server/stdio.js"
      );
      const transport = new StdioServerTransport();
      console.log("Using stdio transport");

      // Initialize and run the server with stdio transport
      await mcpServer.connect(transport);
    }
  } catch (error) {
    console.error(
      "Server error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
