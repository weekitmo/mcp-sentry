#!/usr/bin/env node
import { Command } from "commander";
import dotenv from "dotenv";
import { runServer, MISSING_AUTH_TOKEN_MESSAGE } from "./server";

// Load environment variables from .env file
dotenv.config();

// Create command-line interface
const program = new Command();

program
  .name("mcp-sentry")
  .description("MCP Sentry Server - Node.js implementation")
  .version("1.8.0")
  .option("-t, --auth-token <token>", "Sentry authentication token")
  .option("-b, --api-base <url>", "Sentry API base URL");

program.parse(process.argv);

async function main() {
  try {
    const options = program.opts();
    // Use command line arg or fallback to environment variable
    const authToken = options.authToken || process.env.SENTRY_TOKEN;
    // Use command line arg or fallback to environment variable for API base URL
    const sentryApiBase = options.apiBase || process.env.SENTRY_API_BASE;

    if (!authToken) {
      console.error(MISSING_AUTH_TOKEN_MESSAGE);
      process.exit(1);
    }

    await runServer(authToken, sentryApiBase);
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

// Run the application
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
