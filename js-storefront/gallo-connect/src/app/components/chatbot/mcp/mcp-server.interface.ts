export interface MCPServerConfig {
  id: string;
  name: string;
  description?: string;
  type: 'stdio' | 'http' | 'sse';
  enabled: boolean;
  connection: {
    // For stdio servers
    command?: string;
    args?: string[];
    // For HTTP/SSE servers
    url?: string;
    headers?: Record<string, string>;
  };
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    logging?: boolean;
  };
  timeout?: number;
  retryAttempts?: number;
}

export interface MCPTool {
  name: string;
  description: string;
  serverId: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
  outputSchema?: {
    type: string;
    properties: Record<string, any>;
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverId: string;
}

export interface MCPPrompt {
  name: string;
  description: string;
  serverId: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
    type: string;
  }>;
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
  serverId: string;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource' | 'resource_link';
    text?: string;
    data?: string;
    mimeType?: string;
    uri?: string;
    name?: string;
    description?: string;
  }>;
  isError?: boolean;
  metadata?: Record<string, any>;
}

export interface MCPServerConnection {
  id: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastConnected?: Date;
  lastError?: string;
  sessionId?: string; // For session-based MCP servers
  capabilities: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
    logging: boolean;
  };
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
}

export interface MCPNotification {
  method: string;
  params?: any;
  serverId: string;
  timestamp: Date;
}

export interface MCPServerProvider {
  /**
   * Connect to an MCP server
   */
  connect(config: MCPServerConfig): Promise<MCPServerConnection>;
  
  /**
   * Disconnect from an MCP server
   */
  disconnect(serverId: string): Promise<void>;
  
  /**
   * Get current connection status
   */
  getConnection(serverId: string): MCPServerConnection | null;
  
  /**
   * List all tools from connected servers
   */
  listTools(serverId?: string): Promise<MCPTool[]>;
  
  /**
   * Call a tool on an MCP server
   */
  callTool(toolCall: MCPToolCall): Promise<MCPToolResult>;
  
  /**
   * List all resources from connected servers
   */
  listResources(serverId?: string): Promise<MCPResource[]>;
  
  /**
   * Read a resource from an MCP server
   */
  readResource(uri: string, serverId: string): Promise<MCPToolResult>;
  
  /**
   * List all prompts from connected servers
   */
  listPrompts(serverId?: string): Promise<MCPPrompt[]>;
  
  /**
   * Get a prompt from an MCP server
   */
  getPrompt(name: string, promptArguments: Record<string, any>, serverId: string): Promise<any>;
  
  /**
   * Subscribe to notifications from MCP servers
   */
  onNotification(callback: (notification: MCPNotification) => void): void;
  
  /**
   * Health check for all connected servers
   */
  healthCheck(): Promise<Record<string, 'healthy' | 'unhealthy' | 'unknown'>>;
}
