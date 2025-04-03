import { TextContent, GetPromptResult, PromptMessage, ImageContent, EmbeddedResource } from '@modelcontextprotocol/sdk/types.js';

/**
 * Defines the available transport types for MCP server communication
 */
export type TransportType = 'stdio' | 'sse';

/**
 * Represents the data structure for a Sentry issue
 */
export class SentryIssueData {
  constructor(
    public title: string,
    public issueId: string,
    public status: string,
    public level: string,
    public firstSeen: string,
    public lastSeen: string,
    public count: number,
    public stacktrace: string
  ) {}

  /**
   * Converts the issue data to a human-readable text format
   */
  toText(): string {
    return `
Sentry Issue: ${this.title}
Issue ID: ${this.issueId}
Status: ${this.status}
Level: ${this.level}
First Seen: ${this.firstSeen}
Last Seen: ${this.lastSeen}
Event Count: ${this.count}

${this.stacktrace}
    `;
  }

  /**
   * Converts the issue data to a GetPromptResult object for MCP
   */
  toPromptResult(): GetPromptResult {
    return {
      description: `Sentry Issue: ${this.title}`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: this.toText(),
          } as TextContent,
        } as PromptMessage,
      ],
    };
  }

  /**
   * Converts the issue data to a tool result format for MCP
   */
  toToolResult(): Array<TextContent | ImageContent | EmbeddedResource> {
    return [
      {
        type: 'text',
        text: this.toText(),
      } as TextContent,
    ];
  }
}

/**
 * Custom error class for Sentry related errors
 */
export class SentryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SentryError';
  }
}

/**
 * Represents a single Sentry issue in a list of issues
 */
export interface SentryIssueListItem {
  id: string;
  title: string;
  issueType: string;
  level: string;
  userCount: number;
  lastSeen: string;
  count: number;
}

/**
 * Represents a list of Sentry issues with associated methods
 */
export class SentryIssuesListData {
  constructor(
    public issues: SentryIssueListItem[]
  ) {}

  /**
   * Converts the issues list to a human-readable text format
   */
  toText(): string {
    return `Sentry Issues List (Top ${this.issues.length}):\n\n` +
      this.issues.map((issue, index) => 
        `${index + 1}. [${issue.id}] ${issue.title}\n` +
        `   Type: ${issue.issueType}, Level: ${issue.level}\n` +
        `   Users Affected: ${issue.userCount}, Events: ${issue.count}\n` +
        `   Last Seen: ${issue.lastSeen}\n`
      ).join('\n');
  }

  /**
   * Finds the issue with the highest user count
   */
  findMostTriggeredIssue(): SentryIssueListItem | null {
    if (!this.issues || this.issues.length === 0) {
      return null;
    }

    return this.issues.reduce((max, current) => 
      (current.userCount > max.userCount) ? current : max, 
      this.issues[0]
    );
  }

  /**
   * Converts the issues list to a GetPromptResult object for MCP
   */
  toPromptResult(): GetPromptResult {
    return {
      description: `Sentry Issues List (${this.issues.length} issues)`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: this.toText(),
          } as TextContent,
        } as PromptMessage,
      ],
    };
  }

  /**
   * Creates a prompt result for the most triggered issue
   */
  toMostTriggeredPromptResult(): GetPromptResult {
    const mostTriggeredIssue = this.findMostTriggeredIssue();
    
    if (!mostTriggeredIssue) {
      return {
        description: 'No issues found',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'No issues were found in the list.',
            } as TextContent,
          } as PromptMessage,
        ],
      };
    }
    
    return {
      description: `Most Triggered Issue: ${mostTriggeredIssue.title}`,
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `The issue affecting the most users (${mostTriggeredIssue.userCount} users) is:\n\n` +
              `ID: ${mostTriggeredIssue.id}\n` +
              `Title: ${mostTriggeredIssue.title}\n` +
              `Type: ${mostTriggeredIssue.issueType}, Level: ${mostTriggeredIssue.level}\n` +
              `Last Seen: ${mostTriggeredIssue.lastSeen}\n` +
              `Event Count: ${mostTriggeredIssue.count}`
          } as TextContent,
        } as PromptMessage,
      ],
    };
  }

  /**
   * Converts the issues list to a tool result format for MCP
   */
  toToolResult(): Array<TextContent | ImageContent | EmbeddedResource> {
    return [
      {
        type: 'text',
        text: this.toText(),
      } as TextContent,
    ];
  }
}
