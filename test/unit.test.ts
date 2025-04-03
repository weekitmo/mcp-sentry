import { extractIssueId, createStacktrace } from "../src/utils.js";
import { SentryIssueData } from "../src/types.js";
import * as dotenv from "dotenv";

// 加载环境变量，优先使用.env.local
dotenv.config({ path: ".env.local" });
dotenv.config(); // 如果在.env.local中找不到某些变量，则回退到.env

describe("Utils", () => {
  describe("extractIssueId", () => {
    it("should extract ID from a Sentry URL", () => {
      // 使用环境变量中的Sentry URL
      const baseUrl =
        process.env.SENTRY_API_BASE?.replace("/api/0/", "") ||
        "https://sentry.io";
      const url = `${baseUrl}/organizations/lightgame/issues/${process.env.TEST_SENTRY_ISSUE_ID || "12345"}/`;
      expect(extractIssueId(url)).toEqual(
        process.env.TEST_SENTRY_ISSUE_ID || "12345"
      );
    });

    it("should return the ID directly if not a URL", () => {
      const id = "67890";
      expect(extractIssueId(id)).toEqual("67890");
    });

    it("should throw error for invalid URL format", () => {
      const invalidUrl = "https://example.com/not-a-sentry-url";
      expect(() => extractIssueId(invalidUrl)).toThrow();
    });
  });

  describe("createStacktrace", () => {
    it("should create stacktrace from event data", () => {
      // 模拟Sentry事件数据
      const mockEvent = {
        entries: [
          {
            type: "exception",
            data: {
              values: [
                {
                  type: "Error",
                  value: "Test error",
                  stacktrace: {
                    frames: [
                      {
                        filename: "test.js",
                        function: "testFunction",
                        lineno: 10,
                        colno: 5,
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      };

      const stacktrace = createStacktrace(mockEvent);
      expect(stacktrace).toContain("Error: Test error");
      expect(stacktrace).toContain("test.js");
      expect(stacktrace).toContain("testFunction");
    });

    it("should handle missing exception data", () => {
      const mockEvent = { entries: [] };
      expect(createStacktrace(mockEvent)).toEqual("No stacktrace found");
    });
  });
});

describe("SentryIssueData", () => {
  it("should format data correctly", () => {
    const issueData = new SentryIssueData(
      "Test Error",
      "12345",
      "unresolved",
      "error",
      "2023-01-01T00:00:00Z",
      "2023-01-02T00:00:00Z",
      10,
      "Error: Test error\n  at testFunction (test.js:10:5)"
    );

    // 测试toText方法
    const text = issueData.toText();
    expect(text).toContain("Test Error");
    expect(text).toContain("12345");
    expect(text).toContain("unresolved");
    expect(text).toContain("error");

    // 测试toPromptResult方法
    const promptResult = issueData.toPromptResult();
    expect(promptResult.description).toContain("Test Error");
    expect(promptResult.messages[0].role).toBe("user");
    expect(promptResult.messages[0].content.type).toBe("text");

    // 测试toToolResult方法
    const toolResult = issueData.toToolResult();
    expect(toolResult[0].type).toBe("text");
    expect(toolResult[0].text).toContain("Test Error");
  });
});
