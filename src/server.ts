import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  SentryIssueData,
  SentryError,
  SentryIssuesListData,
  SentryIssueListItem,
} from "./types";
import { extractIssueId, createStacktrace, extractIssuesApiUrl } from "./utils";

// Constants
const DEFAULT_SENTRY_API_BASE = "https://sentry.io/api/0/";
export const MISSING_AUTH_TOKEN_MESSAGE =
  "Sentry authentication token not found. Please specify your Sentry auth token.";

/**
 * Handles retrieving a Sentry issue by ID or URL
 *
 * @param authToken Sentry authentication token
 * @param issueIdOrUrl Sentry issue ID or URL
 * @param sentryApiBase Base URL for Sentry API, defaults to https://sentry.io/api/0/
 * @returns SentryIssueData containing issue information
 */
async function handleSentryIssue(
  authToken: string,
  issueIdOrUrl: string,
  sentryApiBase: string = DEFAULT_SENTRY_API_BASE
): Promise<SentryIssueData> {
  try {
    const issueId = extractIssueId(issueIdOrUrl);
    const axiosInstance = axios.create({
      baseURL: sentryApiBase,
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    // Get issue data
    try {
      const issueResponse = await axiosInstance.get(`issues/${issueId}/`);
      const issueData = issueResponse.data;

      // Get issue hashes for stack trace
      const hashesResponse = await axiosInstance.get(
        `issues/${issueId}/hashes/`
      );
      const hashes = hashesResponse.data;

      if (!hashes || hashes.length === 0) {
        throw new Error("No Sentry events found for this issue");
      }

      const latestEvent = hashes[0].latestEvent;
      const stacktrace = createStacktrace(latestEvent);

      return new SentryIssueData(
        issueData.title,
        issueId,
        issueData.status,
        issueData.level,
        issueData.firstSeen,
        issueData.lastSeen,
        issueData.count,
        stacktrace
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new Error("Error: Unauthorized. Please check your SENTRY_TOKEN.");
      }
      throw error;
    }
  } catch (error) {
    if (error instanceof SentryError) {
      throw error;
    } else if (error instanceof Error) {
      throw new Error(`Error fetching Sentry issue: ${error.message}`);
    } else {
      throw new Error(`An unknown error occurred: ${String(error)}`);
    }
  }
}

/**
 * Handles retrieving a list of Sentry issues from a URL
 *
 * @param authToken Sentry authentication token
 * @param url Sentry URL in any format (API or web interface)
 * @returns SentryIssuesListData containing issues information
 */
async function handleSentryIssuesList(
  authToken: string,
  url: string
): Promise<SentryIssuesListData> {
  try {
    // Extract standard API URL with all necessary parameters
    const apiUrl = extractIssuesApiUrl(url);
    
    // Create axios instance with auth token
    const axiosInstance = axios.create({
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    // Make request to the standardized API URL
    const response = await axiosInstance.get(apiUrl);

    if (!Array.isArray(response.data) || response.data.length === 0) {
      throw new Error("No issues found or invalid response format");
    }

    // Extract only the fields we need
    const issues: SentryIssueListItem[] = response.data.map((issue: any) => ({
      id: issue.id,
      title: issue.title,
      issueType: issue.issueType,
      level: issue.level,
      userCount: parseInt(issue.userCount) || 0,
      lastSeen: issue.lastSeen,
      count: parseInt(issue.count) || 0,
    }));

    return new SentryIssuesListData(issues);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      throw new Error("Error: Unauthorized. Please check your SENTRY_TOKEN.");
    }
    throw new Error(
      `Error fetching Sentry issues list: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Creates and configures the MCP Sentry server
 *
 * @param authToken Sentry authentication token
 * @param sentryApiBase Base URL for Sentry API, defaults to https://sentry.io/api/0/
 * @returns Configured Server instance
 */
export async function createServer(
  authToken: string,
  sentryApiBase: string = DEFAULT_SENTRY_API_BASE
): Promise<McpServer> {
  const server = new McpServer({
    name: "sentry",
    version: "1.8.0",
  });

  // Register prompt handler
  server.prompt(
    "sentry-issue",
    "Retrieve a Sentry issue by ID or URL",
    {
      issue_id_or_url: z.string().describe("Sentry issue ID or URL"),
    },
    async ({ issue_id_or_url }) => {
      const issueData = await handleSentryIssue(
        authToken,
        issue_id_or_url,
        sentryApiBase
      );
      return issueData.toPromptResult();
    }
  );

  // Register tool handler
  server.tool(
    "get_sentry_issue",
    `Retrieve and analyze a Sentry issue by ID or URL. Use this tool when you need to:
    - Investigate production errors and crashes
    - Access detailed stacktraces from Sentry
    - Analyze error patterns and frequencies
    - Get information about when issues first/last occurred
    - Review error counts and status`,
    {
      issue_id_or_url: z.string().describe("Sentry issue ID or URL to analyze"),
    },
    async ({ issue_id_or_url }) => {
      const issueData = await handleSentryIssue(
        authToken,
        issue_id_or_url,
        sentryApiBase
      );
      return {
        content: issueData.toToolResult(),
      };
    }
  );

  // Register new tool for getting issues list
  server.tool(
    "get_sentry_issues_list",
    `Retrieve a list of Sentry issues from any Sentry URL format. Use this tool when you need to:
    - Get a list of recent issues with their details
    - View issues sorted by frequency or other criteria
    - Access information about issue types, levels, and affected users
    - Works with API URLs or web interface URLs (automatically extracts organization & project)`,
    {
      url: z.string().describe("Any Sentry URL containing organization and project information"),
    },
    async ({ url }) => {
      const issuesList = await handleSentryIssuesList(authToken, url);
      return {
        content: issuesList.toToolResult(),
      };
    }
  );

  // Register new prompt for most triggered issue
  server.prompt(
    "most-triggered-issue",
    "Find the issue affecting the most users from any Sentry URL format",
    {
      url: z.string().describe("Any Sentry URL containing organization and project information"),
    },
    async ({ url }) => {
      const issuesList = await handleSentryIssuesList(authToken, url);
      return issuesList.toMostTriggeredPromptResult();
    }
  );

  return server;
}

/**
 * Runs the MCP Sentry server with the given auth token
 *
 * @param authToken Sentry authentication token
 * @param sentryApiBase Base URL for Sentry API, defaults to https://sentry.io/api/0/
 */
export async function runServer(
  authToken: string,
  sentryApiBase: string = DEFAULT_SENTRY_API_BASE
): Promise<void> {
  try {
    const server = await createServer(authToken, sentryApiBase);

    // Connect to stdio for MCP communication
    const { StdioServerTransport } = await import(
      "@modelcontextprotocol/sdk/server/stdio.js"
    );
    const transport = new StdioServerTransport();

    // Initialize and run the server
    await server.connect(transport);
  } catch (error) {
    console.error("Server error:", error);
    process.exit(1);
  }
}
