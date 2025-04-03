#!/usr/bin/env node
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import dotenv from "dotenv";
import { runServer } from "./server.js";
import { TransportType } from "./types.js";
import { MISSING_AUTH_TOKEN_MESSAGE } from "./constants.js";

// Load environment variables from .env file
dotenv.config();

export async function runCommand() {
  try {
    // Create command-line interface with yargs
    const argv = yargs(hideBin(process.argv))
      .scriptName("mcp-sentry")
      .usage("$0 [options]")
      .version("1.8.0")
      .option("t", {
        alias: "auth-token",
        describe: "Sentry authentication token",
        type: "string",
      })
      .option("b", {
        alias: "api-base",
        describe: "Sentry API base URL",
        type: "string",
      })
      .option("sse", {
        describe: "Use SSE transport instead of stdio",
        type: "boolean",
        default: false,
      })
      .option("port", {
        describe: "Port to run the server on",
        type: "number",
        default: 3579,
      })
      .help()
      .alias("h", "help")
      .epilog(
        "For more information visit https://github.com/weekitmo/mcp-sentry"
      )
      .parseSync();
    // Use command line arg or fallback to environment variable
    const authToken = argv.t || process.env.SENTRY_TOKEN;
    // Use command line arg or fallback to environment variable for API base URL
    const sentryApiBase = argv.b || process.env.SENTRY_API_BASE;

    if (!authToken) {
      console.error(MISSING_AUTH_TOKEN_MESSAGE);
      process.exit(1);
    }

    // Determine transport type based on command line flags
    const transportType: TransportType = argv.sse ? "sse" : "stdio";

    // Pass port and host if using SSE transport
    if (transportType === "sse") {
      await runServer(authToken, sentryApiBase, transportType, {
        port: argv.port as number,
      });
    } else {
      await runServer(authToken, sentryApiBase, transportType);
    }
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

runCommand().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
