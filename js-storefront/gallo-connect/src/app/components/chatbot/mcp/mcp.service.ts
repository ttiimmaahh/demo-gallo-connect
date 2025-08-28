import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, timeout, catchError } from 'rxjs/operators';
import { 
  MCPServerConfig, 
  MCPTool, 
  MCPToolCall, 
  MCPToolResult
} from './mcp-server.interface';

@Injectable({
  providedIn: 'root'
})
export class MCPService {
  private serverConfig: MCPServerConfig | null = null;
  private availableTools: MCPTool[] = [];
  private readonly LOG_PREFIX = '[MCPService]';
  private connectionsSubject = new BehaviorSubject<any[]>([]);
  private sessionId: string | null = null; // Track session ID for MCP server
  private requestIdCounter = 1; // Counter for unique request IDs
  
  // Observable for components that need to watch connections
  public connections$ = this.connectionsSubject.asObservable();

  constructor(private http: HttpClient) {
    console.log(`${this.LOG_PREFIX} Simplified MCP service initialized`);
  }

  /**
   * Get next unique request ID
   */
  private getNextRequestId(): number {
    return this.requestIdCounter++;
  }

  /**
   * Configure the MCP server connection
   */
  public configureServer(config: MCPServerConfig): void {
    console.log(`${this.LOG_PREFIX} Configuring server:`, { id: config.id, url: config.connection.url });
    this.serverConfig = config;
  }

  /**
   * Initialize connection and discover available tools
   */
  public async initializeConnection(): Promise<boolean> {
    if (!this.serverConfig) {
      console.error(`${this.LOG_PREFIX} No server configuration found`);
      return false;
    }

    try {
      console.log(`${this.LOG_PREFIX} Initializing connection to ${this.serverConfig.connection.url}`);
      
      // Step 1: Initialize session with the MCP server
      const sessionInitialized = await this.initializeSession();
      if (!sessionInitialized) {
        console.error(`${this.LOG_PREFIX} Failed to initialize session`);
        return false;
      }
      
      // Step 2: Discover available tools now that we have a session
      this.availableTools = await this.discoverTools();
      console.log(`${this.LOG_PREFIX} Discovered ${this.availableTools.length} tools:`, 
        this.availableTools.map(t => t.name));
      
      // Update connections subject
      this.updateConnectionsSubject();
      
      return this.availableTools.length > 0;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Failed to initialize connection:`, error);
      this.sessionId = null; // Clear session on failure
      return false;
    }
  }

  /**
   * Get all available tools formatted for LLM use
   */
  public getToolsForLLM(): Observable<any[]> {
    console.log(`${this.LOG_PREFIX} Getting ${this.availableTools.length} tools for LLM`);
    
    const llmTools = this.availableTools.map(tool => ({
      type: 'function',
      function: {
        name: `mcp_${tool.name}`,
        description: tool.description,
        parameters: tool.inputSchema || { type: 'object', properties: {} }
      }
    }));

    console.log(`${this.LOG_PREFIX} Formatted tools for LLM:`, llmTools.map(t => t.function.name));
    return of(llmTools);
  }

  /**
   * Execute an MCP tool call
   */
  public async callTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    if (!this.serverConfig) {
      throw new Error('MCP server not configured');
    }

    console.log(`${this.LOG_PREFIX} Executing tool call:`, {
      name: toolCall.name,
      arguments: toolCall.arguments
    });

    const request = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'tools/call',
      params: {
        name: toolCall.name,
        arguments: toolCall.arguments
      }
    };

    try {
      const response = await this.makeHttpRequest(request);
      
      if (response?.error) {
        console.error(`${this.LOG_PREFIX} Tool call error:`, response.error);
        return {
          content: [{
            type: 'text',
            text: `Error: ${response.error.message || 'Unknown error'}`
          }],
          isError: true
        };
      }

      console.log(`${this.LOG_PREFIX} Tool call successful:`, response?.result);
      return this.formatToolResult(response?.result);
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Tool call failed:`, error);
      return {
        content: [{
          type: 'text',
          text: `Error executing tool: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Initialize session with the MCP server
   */
  private async initializeSession(): Promise<boolean> {
    if (!this.serverConfig) {
      console.error(`${this.LOG_PREFIX} No server config available for initialization`);
      return false;
    }

    console.log(`${this.LOG_PREFIX} Initializing session with MCP server:`, {
      url: this.serverConfig.connection.url,
      id: this.serverConfig.id,
      name: this.serverConfig.name
    });

    const initRequest = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: {
            listChanged: true
          },
          sampling: {}
        },
        clientInfo: {
          name: 'gallo-connect-chatbot',
          version: '1.0.0'
        }
      }
    };

    try {
      const response = await this.makeHttpRequestWithSessionHandling(initRequest);
      
      if (response?.error) {
        console.error(`${this.LOG_PREFIX} Session initialization error:`, response.error);
        return false;
      }

      console.log(`${this.LOG_PREFIX} Session initialized successfully:`, response?.result);
      
      // Follow up with initialized notification (this is a notification, not a request)
      const initializedNotification = {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        // Notifications don't have an 'id' field and don't expect a response
      };
      
      console.log(`${this.LOG_PREFIX} About to send initialized notification with session ID:`, this.sessionId);
      await this.makeHttpRequestNotification(initializedNotification);
      console.log(`${this.LOG_PREFIX} Successfully sent initialized notification`);
      
      return true;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Failed to initialize session:`, error);
      return false;
    }
  }

  /**
   * Discover available tools from the MCP server
   */
  private async discoverTools(): Promise<MCPTool[]> {
    if (!this.serverConfig) {
      return [];
    }

    const request = {
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'tools/list'
    };

    try {
      const response = await this.makeHttpRequest(request);
      console.log(`${this.LOG_PREFIX} Discovered tools (response):`, response);

      if (response?.result?.tools) {
        return response.result.tools.map((tool: any) => ({
          name: tool.name,
          description: tool.description || '',
          serverId: this.serverConfig!.id,
          inputSchema: tool.inputSchema || { type: 'object', properties: {} }
        }));
      }
      
      return [];
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Failed to discover tools:`, error);
      return [];
    }
  }

  /**
   * Make HTTP request to MCP server with session handling (for initial requests)
   */
  private async makeHttpRequestWithSessionHandling(request: any): Promise<any> {
    if (!this.serverConfig) {
      throw new Error('MCP server not configured');
    }

    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    });

    // IMPORTANT: For initialization request, DO NOT include session ID
    // The server expects no session ID for the initial 'initialize' request
    
    // Add any additional headers from config
    if (this.serverConfig.connection.headers) {
      Object.entries(this.serverConfig.connection.headers).forEach(([key, value]) => {
        headers = headers.set(key, value);
      });
    }

    console.log(`${this.LOG_PREFIX} Making HTTP request with session handling (INITIAL):`, {
      url: this.serverConfig.connection.url,
      method: request.method,
      id: request.id,
      hasSessionId: !!this.sessionId,
      isInitializeRequest: request.method === 'initialize'
    });

    return this.http.post(this.serverConfig.connection.url!, request, { 
      headers, 
      observe: 'response' // Need full response to extract headers
    })
      .pipe(
        timeout(this.serverConfig.timeout || 30000),
        catchError(error => {
          console.error(`${this.LOG_PREFIX} HTTP request failed:`, error);
          throw error;
        }),
        map((response: any) => {
          // Extract session ID from response headers if present
          // Try multiple case variations since servers may use different formats
          const sessionId = response.headers.get('mcp-session-id') || 
                           response.headers.get('Mcp-Session-Id') || 
                           response.headers.get('MCP-SESSION-ID');
          
          if (sessionId && !this.sessionId) {
            console.log(`${this.LOG_PREFIX} Extracted session ID from headers:`, sessionId);
            this.sessionId = sessionId;
          } else if (!sessionId) {
            console.warn(`${this.LOG_PREFIX} No session ID found in response headers`);
            console.log(`${this.LOG_PREFIX} Available headers:`, Array.from(response.headers.keys()));
          }
          return response.body; // Return just the body for compatibility
        })
      )
      .toPromise();
  }

  /**
   * Make HTTP request to MCP server (includes session ID if available)
   */
  private async makeHttpRequest(request: any): Promise<any> {
    if (!this.serverConfig) {
      throw new Error('MCP server not configured');
    }

    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    });

    // Add session ID if we have one (using lowercase to match server format)
    if (this.sessionId) {
      headers = headers.set('mcp-session-id', this.sessionId);
      console.log(`${this.LOG_PREFIX} Adding session ID header:`, this.sessionId);
    } else {
      console.log(`${this.LOG_PREFIX} No session ID available yet`);
    }

    // Add any additional headers from config
    if (this.serverConfig.connection.headers) {
      Object.entries(this.serverConfig.connection.headers).forEach(([key, value]) => {
        headers = headers.set(key, value);
      });
    }

    console.log(`${this.LOG_PREFIX} Making HTTP request:`, {
      url: this.serverConfig.connection.url,
      method: request.method,
      id: request.id,
      sessionId: this.sessionId,
      hasSessionId: !!this.sessionId
    });

    return this.http.post(this.serverConfig.connection.url!, request, { headers })
      .pipe(
        timeout(this.serverConfig.timeout || 30000),
        catchError(error => {
          console.error(`${this.LOG_PREFIX} HTTP request failed:`, error);
          throw error;
        })
      )
      .toPromise();
  }

  /**
   * Send HTTP notification to MCP server (notifications don't expect responses)
   */
  private async makeHttpRequestNotification(notification: any): Promise<void> {
    if (!this.serverConfig) {
      throw new Error('MCP server not configured');
    }

    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    });

    // Add session ID if we have one (using lowercase to match server format)
    if (this.sessionId) {
      headers = headers.set('mcp-session-id', this.sessionId);
    }

    // Add any additional headers from config
    if (this.serverConfig.connection.headers) {
      Object.entries(this.serverConfig.connection.headers).forEach(([key, value]) => {
        headers = headers.set(key, value);
      });
    }

    console.log(`${this.LOG_PREFIX} Sending notification:`, {
      url: this.serverConfig.connection.url,
      method: notification.method,
      sessionId: this.sessionId,
      hasSessionId: !!this.sessionId
    });

    // Notifications don't return meaningful responses, just send and forget
    await this.http.post(this.serverConfig.connection.url!, notification, { headers })
      .pipe(
        timeout(this.serverConfig.timeout || 30000),
        catchError(error => {
          console.error(`${this.LOG_PREFIX} Notification failed:`, error);
          throw error;
        })
      )
      .toPromise();
  }

  /**
   * Format tool result for consistent output
   */
  private formatToolResult(result: any): MCPToolResult {
    if (!result) {
      return {
        content: [{
          type: 'text',
          text: 'No result returned from tool'
        }]
      };
    }

    // If result already has content array, use it
    if (result.content && Array.isArray(result.content)) {
      return {
        content: result.content,
        isError: result.isError || false
      };
    }

    // Handle string results
    if (typeof result === 'string') {
      return {
        content: [{
          type: 'text',
          text: result
        }]
      };
    }

    // Handle object results
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }

  /**
   * Get current server configuration
   */
  public getServerConfig(): MCPServerConfig | null {
    return this.serverConfig;
  }

  /**
   * Check if MCP service is ready
   */
  public isReady(): boolean {
    return this.serverConfig !== null && this.availableTools.length > 0;
  }

  // Legacy compatibility methods for existing components
  // These are temporary stubs to prevent build errors
  
  public getAllServerConfigurations(): any[] {
    return this.serverConfig ? [this.serverConfig] : [];
  }

  public addServerConfiguration(config: MCPServerConfig): void {
    console.log(`${this.LOG_PREFIX} Legacy method addServerConfiguration called - using configureServer instead`);
    this.configureServer(config);
    this.updateConnectionsSubject();
  }

  public removeServerConfiguration(serverId: string): void {
    console.log(`${this.LOG_PREFIX} Legacy method removeServerConfiguration called for ${serverId}`);
    if (this.serverConfig?.id === serverId) {
      this.sessionId = null; // Clear session
      this.serverConfig = null;
      this.availableTools = [];
      this.updateConnectionsSubject();
    }
  }

  public async connect(config: MCPServerConfig): Promise<any> {
    console.log(`${this.LOG_PREFIX} Legacy method connect called - using configureServer + initializeConnection`);
    this.configureServer(config);
    await this.initializeConnection();
    return { id: config.id, status: 'connected' };
  }

  public async disconnect(serverId: string): Promise<void> {
    console.log(`${this.LOG_PREFIX} Legacy method disconnect called for ${serverId}`);
    // In simplified version, just clear the config
    if (this.serverConfig?.id === serverId) {
      await this.cleanupSession(); // Properly cleanup session
      this.sessionId = null;
      this.serverConfig = null;
      this.availableTools = [];
      this.updateConnectionsSubject();
    }
  }

  public getAllConnections(): any[] {
    if (!this.serverConfig) return [];
    return [{
      id: this.serverConfig.id,
      status: this.isReady() ? 'connected' : 'disconnected',
      tools: this.availableTools
    }];
  }

  public getConnectedServers(): any[] {
    return this.isReady() ? this.getAllConnections() : [];
  }

  public async listTools(): Promise<MCPTool[]> {
    return this.availableTools;
  }

  public getAllAvailableTools(): Observable<MCPTool[]> {
    return of(this.availableTools);
  }

  public async disconnectAllServers(): Promise<void> {
    console.log(`${this.LOG_PREFIX} Legacy method disconnectAllServers called`);
    await this.cleanupSession(); // Properly cleanup session
    this.sessionId = null;
    this.serverConfig = null;
    this.availableTools = [];
    this.updateConnectionsSubject();
  }

  public async healthCheck(): Promise<Record<string, string>> {
    console.log(`${this.LOG_PREFIX} Legacy method healthCheck called`);
    const result: Record<string, string> = {};
    if (this.serverConfig) {
      result[this.serverConfig.id] = this.isReady() ? 'healthy' : 'unhealthy';
    }
    return result;
  }

  public getServerConfiguration(serverId: string): MCPServerConfig | undefined {
    console.log(`${this.LOG_PREFIX} Legacy method getServerConfiguration called - use getServerConfig instead`);
    return this.serverConfig?.id === serverId ? this.serverConfig : undefined;
  }

  /**
   * Cleanup session with MCP server
   */
  private async cleanupSession(): Promise<void> {
    if (!this.sessionId || !this.serverConfig) {
      return;
    }

    try {
      console.log(`${this.LOG_PREFIX} Cleaning up session: ${this.sessionId}`);
      
      // Send session termination request
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Mcp-Session-Id': this.sessionId
      });

      // Use HTTP DELETE to terminate the session
      await this.http.delete(this.serverConfig.connection.url!, { headers })
        .pipe(
          timeout(5000), // Shorter timeout for cleanup
          catchError(error => {
            console.warn(`${this.LOG_PREFIX} Session cleanup failed (non-critical):`, error);
            return of(null); // Don't throw on cleanup failure
          })
        )
        .toPromise();

      console.log(`${this.LOG_PREFIX} Session cleanup completed`);
    } catch (error) {
      console.warn(`${this.LOG_PREFIX} Session cleanup failed (non-critical):`, error);
    }
  }

  private updateConnectionsSubject(): void {
    const connections = this.getAllConnections();
    this.connectionsSubject.next(connections);
  }
}