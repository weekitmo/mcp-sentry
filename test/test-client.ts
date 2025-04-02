import * as readline from 'readline';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 加载环境变量，优先使用.env.local
dotenv.config({ path: '.env.local' });
dotenv.config(); // 如果在.env.local中找不到某些变量，则回退到.env

// 简单的MCP客户端模拟器
export class McpTestClient {
  private serverProcess: ChildProcess | null;
  private rl: readline.Interface;
  private requestId = 1;
  private responseHandlers: Map<string, (response: any) => void> = new Map();
  
  constructor(sentryToken: string = '', sentryApiBase: string = '') {
    // 使用提供的参数或环境变量
    const token = sentryToken || process.env.SENTRY_TOKEN || '';
    const apiBase = sentryApiBase || process.env.SENTRY_API_BASE || '';
    
    // 启动服务器进程
    this.serverProcess = spawn('node', [path.resolve(__dirname, '../dist/index.js')], {
      env: { 
        ...process.env, 
        SENTRY_TOKEN: token,
        SENTRY_API_BASE: apiBase 
      },
      stdio: ['pipe', 'pipe', process.stderr]
    });
    
    // 设置接收服务器响应的接口
    this.rl = readline.createInterface({
      input: this.serverProcess.stdout!,
      terminal: false
    });
    
    // 处理服务器响应
    this.rl.on('line', (line) => {
      try {
        const response = JSON.parse(line);
        // console.log('收到服务器响应:', JSON.stringify(response, null, 2));
        
        // 如果有响应处理器，调用它
        if (response.id && this.responseHandlers.has(response.id)) {
          const handler = this.responseHandlers.get(response.id);
          if (handler) {
            handler(response);
            this.responseHandlers.delete(response.id);
          }
        }
      } catch (error) {
        console.error('解析响应失败:', line);
      }
    });
  }
  
  // 发送初始化请求
  async initialize(): Promise<any> {
    const id = String(this.requestId++);
    const initRequest = {
      jsonrpc: '2.0',
      id,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        },
        capabilities: {}
      }
    };
    
    const response = await this.sendRequestWithResponse(initRequest);
    
    // 发送初始化完成通知
    const initializedNotification = {
      jsonrpc: '2.0',
      method: 'initialized',
      params: {}
    };
    
    this.sendRequest(initializedNotification);
    return response;
  }
  
  // 测试列出所有可用的工具
  async listTools(): Promise<any> {
    const id = String(this.requestId++);
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'tools/list',
      params: {}
    };
    
    return this.sendRequestWithResponse(request);
  }
  
  // 测试列出所有可用的提示
  async listPrompts(): Promise<any> {
    const id = String(this.requestId++);
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'prompts/list',
      params: {}
    };
    
    return this.sendRequestWithResponse(request);
  }
  
  // 测试执行工具
  async callTool(issueIdOrUrl: string): Promise<any> {
    const id = String(this.requestId++);
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: 'get_sentry_issue',
        arguments: {
          issue_id_or_url: issueIdOrUrl
        }
      }
    };
    
    return this.sendRequestWithResponse(request);
  }
  
  // 测试执行提示
  async getPrompt(issueIdOrUrl: string): Promise<any> {
    const id = String(this.requestId++);
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'prompts/get',
      params: {
        name: 'sentry-issue',
        arguments: {
          issue_id_or_url: issueIdOrUrl
        }
      }
    };
    
    return this.sendRequestWithResponse(request);
  }
  
  // 测试获取Sentry issues列表
  async getSentryIssuesList(url: string): Promise<any> {
    const id = String(this.requestId++);
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: 'get_sentry_issues_list',
        arguments: {
          url: url
        }
      }
    };
    
    return this.sendRequestWithResponse(request);
  }
  
  // 测试获取触发人数最多的issue
  async getMostTriggeredIssue(url: string): Promise<any> {
    const id = String(this.requestId++);
    const request = {
      jsonrpc: '2.0',
      id,
      method: 'prompts/get',
      params: {
        name: 'most-triggered-issue',
        arguments: {
          url: url
        }
      }
    };
    
    return this.sendRequestWithResponse(request);
  }
  
  // 发送JSON-RPC请求到服务器并等待响应
  private sendRequestWithResponse(request: any): Promise<any> {
    return new Promise((resolve) => {
      // 注册响应处理器
      if (request.id) {
        this.responseHandlers.set(request.id, resolve);
      }
      
      // 发送请求
      this.sendRequest(request);
    });
  }
  
  // 发送JSON-RPC请求到服务器
  private sendRequest(request: any) {
    // console.log('发送请求:', JSON.stringify(request, null, 2));
    if (this.serverProcess) {
      this.serverProcess.stdin!.write(JSON.stringify(request) + '\n');
    }
  }
  
  // 关闭客户端和服务器
  close() {
    if (this.serverProcess) {
      this.serverProcess.kill();
    }
    this.rl.close();
  }
}

// 仅当直接运行时才执行测试
if (require.main === module) {
  // 主测试函数
  async function runTests() {
    // 检查是否有Sentry Token
    if (!process.env.SENTRY_TOKEN) {
      console.error('请先设置SENTRY_TOKEN环境变量');
      process.exit(1);
    }
    
    const client = new McpTestClient(process.env.SENTRY_TOKEN);
    
    try {
      // 初始化连接
      console.log('测试1: 初始化');
      await client.initialize();
      
      // 列出所有工具
      console.log('\n测试2: 列出所有工具');
      await client.listTools();
      
      // 列出所有提示
      console.log('\n测试3: 列出所有提示');
      await client.listPrompts();
      
      // 测试示例Sentry Issue
      // 这里使用一个示例ID，您需要替换为有效的Sentry Issue ID或URL
      const sampleIssueId = '441592';
      
      // 测试Tool
      console.log(`\n测试4: 调用工具 get_sentry_issue (${sampleIssueId})`);
      await client.callTool(sampleIssueId);
      
      // 测试Prompt
      console.log(`\n测试5: 获取提示 sentry-issue (${sampleIssueId})`);
      await client.getPrompt(sampleIssueId);
      
    } finally {
      // 确保关闭客户端
      client.close();
    }
  }

  // 运行测试
  runTests().catch(error => {
    console.error('测试失败:', error);
    process.exit(1);
  });
}
