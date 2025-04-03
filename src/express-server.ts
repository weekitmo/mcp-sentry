import express, { Request, Response } from "express";
import cors from "cors";
import http from "http";
import { IncomingMessage, ServerResponse } from "http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { DEFAULT_PORT } from "./constants.js";

/**
 * Configuration options for the Express server
 */
export interface ExpressServerOptions {
  /**
   * Port to run the server on
   */
  port?: number;

  /**
   * Enable CORS
   */
  cors?: boolean;
}

/**
 * Default configuration for the Express server
 */
const DEFAULT_OPTIONS: ExpressServerOptions = {
  port: 3000,
  cors: true,
};

/**
 * Creates and configures an Express server with SSE capability for MCP
 * @param mcpServer The MCP server instance
 * @param options Configuration options
 * @returns The configured HTTP server instance
 */
export async function createExpressServer(
  mcpServer: McpServer,
  options: ExpressServerOptions = DEFAULT_OPTIONS
): Promise<{ mcpServer: McpServer; server: http.Server }> {
  const app = express();
  const server = http.createServer(app);
  let sseTransport: SSEServerTransport | undefined;

  if (options.cors) {
    app.use(cors());
  }

  // Basic health check endpoint
  app.get("/health", (req: Request, res: Response) => {
    res.status(200).json({ status: "ok", server: "mcp-sentry" });
  });

  // SSE endpoint
  app.get("/sse", async (req: Request, res: Response) => {
    // Configure SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    console.log("New SSE connection established");

    // 确保流是可读的

    sseTransport = new SSEServerTransport(
      "/messages",
      res as unknown as ServerResponse<IncomingMessage>
    );
    await mcpServer.connect(sseTransport).catch((error) => {
      console.error("Error connecting MCP server to SSE transport:", error);

      sseTransport?.close();
      sseTransport = undefined;
    });
    console.log("SSE transport initialized");
  });

  app.post("/messages", async (req: Request, res: Response) => {
    if (!sseTransport) {
      res.status(400).send("SSE transport not initialized");
      return;
    }

    await sseTransport.handlePostMessage(
      req as unknown as IncomingMessage,
      res as unknown as ServerResponse<IncomingMessage>
    );
  });

  return { mcpServer, server };
}

/**
 * Checks if an error is a port in use error
 * @param error The error to check
 * @returns Whether the error is a port in use error
 */
function isPortInUseError(error: unknown): boolean {
  if (error instanceof Error) {
    // Different systems may return different error messages for port in use
    return (
      error.message.includes("EADDRINUSE") ||
      error.message.includes("address already in use") ||
      error.message.includes("port is already in use")
    );
  }
  return false;
}

/**
 * Starts the Express server for MCP with SSE support
 * @param mcpServer The MCP server instance
 * @param options Configuration options
 */
export async function startExpressServer(
  mcpServer: McpServer,
  options: ExpressServerOptions = DEFAULT_OPTIONS
): Promise<void> {
  let currentPort = options.port || DEFAULT_PORT;
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    let server: http.Server | undefined;

    try {
      // Create express server with the current port
      const result = await createExpressServer(mcpServer, {
        ...options,
        port: currentPort,
      });

      server = result.server;

      // Wrap server.listen in a promise to catch its errors
      await new Promise<void>((resolve, reject) => {
        server!.once("error", (err) => {
          reject(err);
        });

        server!.listen(currentPort, () => {
          console.log(
            `MCP Server running with SSE at http://localhost:${currentPort}/sse`
          );
          console.log(
            `Health check available at http://localhost:${currentPort}/health`
          );
          resolve();
        });
      });

      // If we reach here, server started successfully
      return;
    } catch (error) {
      console.error(
        `Failed to start Express server on port ${currentPort}:`,
        error
      );

      // Properly close the server if it was created
      if (server) {
        // Check if server is listening before attempting to close
        if (server.listening) {
          server.close();
          server = undefined;
        }
      }

      if (isPortInUseError(error) && retries < maxRetries - 1) {
        retries++;
        currentPort++; // Increment port by 1 for the next attempt
        console.log(
          `Port ${currentPort - 1} is in use. Trying port ${currentPort}...`
        );
      } else {
        // Either not a port conflict or we've exceeded max retries
        if (isPortInUseError(error)) {
          throw new Error(
            `Failed to start server after ${maxRetries} attempts due to port conflicts. ` +
              `Last attempted port: ${currentPort}. Error: ${error instanceof Error ? error.message : String(error)}`
          );
        } else {
          // Some other error occurred
          throw error;
        }
      }
    }
  }
}
