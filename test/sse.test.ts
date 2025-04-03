import { EventSource } from "eventsource";
import * as http from "http";
import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

// ES模块中创建 __dirname 等效替代
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量，优先使用.env.local
dotenv.config({ path: ".env.local" });
dotenv.config(); // 如果在.env.local中找不到某些变量，则回退到.env

// 测试端口
const TEST_PORT = 3579;

// 等待服务器启动的辅助函数
async function waitForServerToStart(url: string, maxRetries = 10, delay = 500): Promise<boolean> {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // 服务器可能还没启动，等待后重试
    }
    
    await new Promise((resolve) => setTimeout(resolve, delay));
    retries++;
  }
  return false;
}

// 等待指定时间
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("MCP Sentry Server SSE Tests", () => {
  let serverProcess: ChildProcess | null = null;
  let eventSources: EventSource[] = [];
  
  // 启动服务器
  beforeAll(async () => {
    // 检查环境变量
    if (!process.env.SENTRY_TOKEN) {
      console.warn("警告: 缺少SENTRY_TOKEN环境变量，测试可能会失败");
    }
    
    // 启动带有SSE选项的服务器进程
    serverProcess = spawn("node", [
      path.resolve(__dirname, "../dist/index.js"),
      "--sse",
      `--port=${TEST_PORT}`
    ], {
      env: { 
        ...process.env,
        // 确保使用环境变量中的凭据
        SENTRY_TOKEN: process.env.SENTRY_TOKEN || "",
        SENTRY_API_BASE: process.env.SENTRY_API_BASE || "" 
      },
      stdio: "pipe"
    });
    
    // 捕获输出以便调试
    if (serverProcess.stdout) {
      serverProcess.stdout.on("data", (data) => {
        // 减少日志输出，避免干扰
        // console.log(`服务器标准输出: ${data}`);
      });
    }
    
    if (serverProcess.stderr) {
      serverProcess.stderr.on("data", (data) => {
        console.error(`服务器错误输出: ${data}`);
      });
    }
    
    // 等待服务器启动
    const healthCheckUrl = `http://localhost:${TEST_PORT}/health`;
    const isServerRunning = await waitForServerToStart(healthCheckUrl);
    
    if (!isServerRunning) {
      throw new Error("服务器未能在预期时间内启动");
    }
    
    // 给服务器一些额外时间来完全初始化
    await wait(1000);
  }, 20000); // 设置较长的超时时间
  
  // 存储所有定时器以便清理
  let timeouts: NodeJS.Timeout[] = [];
  
  // 创建可跟踪的setTimeout
  function createTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    const timeout = setTimeout(callback, delay);
    timeouts.push(timeout);
    return timeout;
  }

  // 每个测试后清理EventSource连接和定时器
  afterEach(() => {
    // 清理所有定时器
    timeouts.forEach(timeout => {
      clearTimeout(timeout);
    });
    timeouts = [];
    
    // 关闭所有打开的EventSource连接
    eventSources.forEach(es => {
      try {
        es.close();
      } catch (e) {
        // 忽略关闭错误
      }
    });
    eventSources = [];
  });
  
  // 测试结束后关闭服务器
  afterAll(async () => {
    // 确保所有EventSource连接都已关闭
    eventSources.forEach(es => {
      try {
        es.close();
      } catch (e) {
        // 忽略关闭错误
      }
    });
    eventSources = [];
    
    if (serverProcess) {
      // 使用SIGTERM信号终止进程
      serverProcess.kill('SIGTERM');
      
      // 等待一段时间确保进程有机会退出
      await wait(1000);
      
      // 如果进程仍然存在，则强制终止
      if (serverProcess.exitCode === null) {
        serverProcess.kill('SIGKILL');
      }
      
      serverProcess = null;
    }
    
    // 等待一段时间，确保资源完全释放
    await wait(1000);
  }, 10000);
  
  // 创建跟踪的EventSource
  function createEventSource(url: string): EventSource {
    const es = new EventSource(url);
    eventSources.push(es);
    return es;
  }

  // 测试健康检查端点
  it("应该通过健康检查端点返回正确的状态", async () => {
    const response = await fetch(`http://localhost:${TEST_PORT}/health`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty("status", "ok");
    expect(data).toHaveProperty("server", "mcp-sentry");
  });
  
  // 测试SSE连接
  it("应该能够建立SSE连接", async () => {
    return new Promise<void>((resolve, reject) => {
      const eventSource = createEventSource(`http://localhost:${TEST_PORT}/sse`);
      
      // 设置连接超时
      const timeout = createTimeout(() => {
        reject(new Error("连接SSE超时"));
      }, 5000);
      
      // 监听连接打开事件
      eventSource.onopen = () => {
        clearTimeout(timeout);
        resolve();
      };
      
      // 监听错误
      eventSource.onerror = (err) => {
        clearTimeout(timeout);
        reject(new Error(`SSE连接错误: ${JSON.stringify(err)}`));
      };
    });
  });
  
  // 测试初始化请求
  it("应该能够通过SSE发送初始化请求并收到响应", async () => {
    // 建立SSE连接
    const eventSource = createEventSource(`http://localhost:${TEST_PORT}/sse`);
    
    // 准备一个Promise来等待响应
    const initializePromise = new Promise<any>((resolve, reject) => {
      const responseHandler = (event: MessageEvent) => {
        try {
          const response = JSON.parse(event.data);
          if (response.id === "1" && response.method === undefined) {
            eventSource.removeEventListener("message", responseHandler);
            resolve(response);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      eventSource.addEventListener("message", responseHandler);
      
      // 设置超时
      const timeout = createTimeout(() => {
        eventSource.removeEventListener("message", responseHandler);
        reject(new Error("等待初始化响应超时"));
      }, 10000);
      
      // 清理函数
      eventSource.addEventListener('error', () => {
        clearTimeout(timeout);
        eventSource.removeEventListener("message", responseHandler);
        reject(new Error("SSE连接错误"));
      });
    });
    
    // 发送初始化请求
    await fetch(`http://localhost:${TEST_PORT}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "1",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          clientInfo: {
            name: "test-client",
            version: "1.0.0",
          },
          capabilities: {},
        },
      }),
    });
    
    // 等待响应
    const response = await initializePromise;
    
    // 验证响应
    expect(response).toHaveProperty("result");
    expect(response.result).toHaveProperty("serverInfo");
    expect(response.result.serverInfo).toHaveProperty("name", "sentry");
  }, 15000);
  
  // 测试工具列表请求
  it("应该能够通过SSE请求工具列表并收到响应", async () => {
    // 建立SSE连接
    const eventSource = createEventSource(`http://localhost:${TEST_PORT}/sse`);
    
    // 先发送初始化请求
    await fetch(`http://localhost:${TEST_PORT}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "init-1",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          clientInfo: {
            name: "test-client",
            version: "1.0.0",
          },
          capabilities: {},
        },
      }),
    });
    
    // 等待一段时间，确保初始化完成
    await wait(1000);
    
    // 发送已初始化通知
    await fetch(`http://localhost:${TEST_PORT}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialized",
        params: {},
      }),
    });
    
    // 等待一段时间
    await wait(1000);
    
    // 准备一个Promise来等待工具列表响应
    const toolsListPromise = new Promise<any>((resolve, reject) => {
      const responseHandler = (event: MessageEvent) => {
        try {
          const response = JSON.parse(event.data);
          if (response.id === "2") {
            eventSource.removeEventListener("message", responseHandler);
            resolve(response);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      eventSource.addEventListener("message", responseHandler);
      
      // 设置超时
      const timeout = createTimeout(() => {
        eventSource.removeEventListener("message", responseHandler);
        reject(new Error("等待工具列表响应超时"));
      }, 10000);
      
      // 清理函数
      eventSource.addEventListener('error', () => {
        clearTimeout(timeout);
        eventSource.removeEventListener("message", responseHandler);
        reject(new Error("SSE连接错误"));
      });
    });
    
    // 发送工具列表请求
    await fetch(`http://localhost:${TEST_PORT}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "2",
        method: "tools/list",
        params: {},
      }),
    });
    
    // 等待响应
    const response = await toolsListPromise;
    
    // 验证响应
    expect(response).toHaveProperty("result");
    expect(response.result).toHaveProperty("tools");
    expect(Array.isArray(response.result.tools)).toBe(true);
    
    // 验证是否包含预期的工具
    const hasSentryIssueTool = response.result.tools.some(
      (tool: any) => tool.name === "get_sentry_issue"
    );
    expect(hasSentryIssueTool).toBe(true);
    
    const hasSentryIssuesListTool = response.result.tools.some(
      (tool: any) => tool.name === "get_sentry_issues_list"
    );
    expect(hasSentryIssuesListTool).toBe(true);
  }, 15000);
});
