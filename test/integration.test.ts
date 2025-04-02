import { McpTestClient } from "./test-client";
import * as dotenv from "dotenv";

// 加载环境变量，优先使用.env.local
dotenv.config({ path: ".env.local" });
dotenv.config(); // 如果在.env.local中找不到某些变量，则回退到.env

// 替换为真实的Sentry问题ID或使用模拟
const MOCK_ISSUE_ID = process.env.TEST_SENTRY_ISSUE_ID || "12345";

describe("MCP Sentry Server Integration Tests", () => {
  let client: McpTestClient;

  beforeAll(() => {
    // 使用环境变量中的SENTRY_TOKEN和SENTRY_API_BASE创建客户端

    client = new McpTestClient(
      process.env.SENTRY_TOKEN || "",
      process.env.SENTRY_API_BASE || ""
    );
  });

  afterAll(() => {
    // 测试结束后关闭客户端连接
    client.close();
  });

  it("应该成功初始化连接", async () => {
    const response = await client.initialize();
    expect(response).toBeDefined();
    expect(response.result).toBeDefined();
    expect(response.result.serverInfo.name).toBe("sentry");
  }, 10000);

  it("应该列出所有可用工具", async () => {
    const response = await client.listTools();
    expect(response).toBeDefined();
    expect(response.result.tools).toBeInstanceOf(Array);

    // 验证get_sentry_issue工具是否存在
    const tool = response.result.tools.find(
      (t: any) => t.name === "get_sentry_issue"
    );
    expect(tool).toBeDefined();
    expect(tool.description).toContain("Retrieve and analyze a Sentry issue");
  }, 5000);

  it("应该列出所有可用提示", async () => {
    const response = await client.listPrompts();
    expect(response).toBeDefined();
    expect(response.result.prompts).toBeInstanceOf(Array);

    // 验证sentry-issue提示是否存在
    const prompt = response.result.prompts.find(
      (p: any) => p.name === "sentry-issue"
    );
    expect(prompt).toBeDefined();
    expect(prompt.description).toContain("Retrieve a Sentry issue");
  }, 5000);

  it("应该能够使用sentry-issue提示", async () => {
    // 注意: 此测试可能需要有效的Sentry Token和Issue ID
    try {
      const response = await client.getPrompt(MOCK_ISSUE_ID);

      // 如果使用有效的Sentry Token和Issue ID
      if (process.env.SENTRY_TOKEN && process.env.TEST_SENTRY_ISSUE_ID) {
        expect(response).toBeDefined();
        expect(response.result).toBeDefined();
        expect(response.result.messages).toBeInstanceOf(Array);
      } else {
        // 如果使用模拟数据，可能会失败，这是预期的
        console.log("使用模拟的Issue ID，预期会失败");
      }
    } catch (error) {
      // 如果没有提供有效的凭据，测试可能会失败
      if (!process.env.SENTRY_TOKEN || !process.env.TEST_SENTRY_ISSUE_ID) {
        console.warn("此测试需要有效的Sentry Token和Issue ID才能完全通过");
      } else {
        throw error;
      }
    }
  }, 10000);

  it("应该能够调用get_sentry_issue工具", async () => {
    // 注意: 此测试可能需要有效的Sentry Token和Issue ID
    try {
      const response = await client.callTool(MOCK_ISSUE_ID);

      // 如果使用有效的Sentry Token和Issue ID
      if (process.env.SENTRY_TOKEN && process.env.TEST_SENTRY_ISSUE_ID) {
        expect(response).toBeDefined();
        expect(response.result).toBeDefined();
        expect(response.result.content).toBeInstanceOf(Array);
        expect(response.result.content[0].type).toBe("text");
      } else {
        // 如果使用模拟数据，可能会失败，这是预期的
        console.log("使用模拟的Issue ID，预期会失败");
      }
    } catch (error) {
      // 如果没有提供有效的凭据，测试可能会失败
      if (!process.env.SENTRY_TOKEN || !process.env.TEST_SENTRY_ISSUE_ID) {
        console.warn("此测试需要有效的Sentry Token和Issue ID才能完全通过");
      } else {
        throw error;
      }
    }
  }, 10000);

  // 测试 Issues 列表相关功能
  const TEST_SENTRY_URL = process.env.TEST_SENTRY_ISSUES_URL || "https://sentry.example.com/organizations/exampleorg/projects/example-project/?project=123";
  
  it("应该列出get_sentry_issues_list工具", async () => {
    const response = await client.listTools();
    expect(response).toBeDefined();
    expect(response.result.tools).toBeInstanceOf(Array);

    // 验证get_sentry_issues_list工具是否存在
    const tool = response.result.tools.find(
      (t: any) => t.name === "get_sentry_issues_list"
    );
    expect(tool).toBeDefined();
    expect(tool.description).toContain("Retrieve a list of Sentry issues");
  }, 5000);

  it("应该列出most-triggered-issue提示", async () => {
    const response = await client.listPrompts();
    expect(response).toBeDefined();
    expect(response.result.prompts).toBeInstanceOf(Array);

    // 验证most-triggered-issue提示是否存在
    const prompt = response.result.prompts.find(
      (p: any) => p.name === "most-triggered-issue"
    );
    expect(prompt).toBeDefined();
    expect(prompt.description).toContain("affecting the most users");
  }, 5000);

  it("应该能够调用get_sentry_issues_list工具", async () => {
    // 注意: 此测试可能需要有效的Sentry Token和URL
    try {
      const response = await client.getSentryIssuesList(TEST_SENTRY_URL);

      // 如果使用有效的Sentry Token和URL
      if (process.env.SENTRY_TOKEN && process.env.TEST_SENTRY_ISSUES_URL) {
        expect(response).toBeDefined();
        expect(response.result).toBeDefined();
        expect(response.result.content).toBeInstanceOf(Array);
        expect(response.result.content[0].type).toBe("text");
        expect(response.result.content[0].text).toContain("Sentry Issues List");
      } else {
        // 如果使用模拟数据，可能会失败，这是预期的
        console.log("使用模拟的URL，预期会失败");
      }
    } catch (error) {
      // 如果没有提供有效的凭据，测试可能会失败
      if (!process.env.SENTRY_TOKEN || !process.env.TEST_SENTRY_ISSUES_URL) {
        console.warn("此测试需要有效的Sentry Token和Issues URL才能完全通过");
      } else {
        throw error;
      }
    }
  }, 10000);

  it("应该能够使用most-triggered-issue提示", async () => {
    // 注意: 此测试可能需要有效的Sentry Token和URL
    try {
      const response = await client.getMostTriggeredIssue(TEST_SENTRY_URL);

      // 如果使用有效的Sentry Token和URL
      if (process.env.SENTRY_TOKEN && process.env.TEST_SENTRY_ISSUES_URL) {
        expect(response).toBeDefined();
        expect(response.result).toBeDefined();
        expect(response.result.messages).toBeInstanceOf(Array);
        expect(response.result.description).toContain("Most Triggered Issue");
        expect(response.result.messages[0].content.text).toContain("users");
      } else {
        // 如果使用模拟数据，可能会失败，这是预期的
        console.log("使用模拟的URL，预期会失败");
      }
    } catch (error) {
      // 如果没有提供有效的凭据，测试可能会失败
      if (!process.env.SENTRY_TOKEN || !process.env.TEST_SENTRY_ISSUES_URL) {
        console.warn("此测试需要有效的Sentry Token和Issues URL才能完全通过");
      } else {
        throw error;
      }
    }
  }, 10000);

  it("应该能够处理不同格式的Sentry URL", async () => {
    // 这个测试针对URL解析功能，不需要实际调用API
    try {
      // 使用utils.extractIssuesApiUrl直接测试而不是通过API调用
      const { extractIssuesApiUrl } = require("../dist/utils");
      
      // 测试API格式的URL
      const apiUrl = "https://sentry.example.com/api/0/organizations/exampleorg/issues/?project=123";
      const parsedApiUrl = extractIssuesApiUrl(apiUrl);
      expect(parsedApiUrl).toContain("/api/0/organizations/exampleorg/issues/");
      expect(parsedApiUrl).toContain("project=123");
      expect(parsedApiUrl).toContain("limit=5");
      
      // 测试Web界面格式的URL
      const webUrl = "https://sentry.example.com/organizations/exampleorg/projects/example-project/?project=123";
      const parsedWebUrl = extractIssuesApiUrl(webUrl);
      expect(parsedWebUrl).toContain("/api/0/organizations/exampleorg/issues/");
      expect(parsedWebUrl).toContain("project=123");
      expect(parsedWebUrl).toContain("limit=5");
      
    } catch (error) {
      // 如果目录结构有问题，告知用户
      console.warn("测试URL解析功能前需要先构建项目: pnpm build");
      throw error;
    }
  }, 5000);
});
