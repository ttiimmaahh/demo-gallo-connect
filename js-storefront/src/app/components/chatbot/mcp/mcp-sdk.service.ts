import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, from, of, firstValueFrom } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { MCPServerConfig, MCPTool, MCPToolCall, MCPToolResult } from './mcp-server.interface';
import { AuthStorageService, WindowRef } from '@spartacus/core';
import { ActiveCartFacade } from '@spartacus/cart/base/root';

@Injectable({
  providedIn: 'root'
})
export class MCPSDKService {
  private client: Client | null = null;
  private transport: StreamableHTTPClientTransport | null = null;
  private serverConfig: MCPServerConfig | null = null;
  private availableTools: MCPTool[] = [];
  private readonly LOG_PREFIX = '[MCPSDKService]';
  private connectionsSubject = new BehaviorSubject<any[]>([]);
  
  // Observable for components that need to watch connections
  public connections$ = this.connectionsSubject.asObservable();

  constructor(
    private authStorageService: AuthStorageService,
    private windowRef: WindowRef,
    private activeCartFacade: ActiveCartFacade
  ) {
    console.log(`${this.LOG_PREFIX} MCP SDK service initialized`);
  }

  /**
   * Configure the MCP server connection
   */
  public configureServer(config: MCPServerConfig): void {
    console.log(`${this.LOG_PREFIX} Configuring server:`, { id: config.id, url: config.connection.url });
    this.serverConfig = config;
  }

  /**
   * Initialize connection using the official MCP SDK
   */
  public async initializeConnection(): Promise<boolean> {
    if (!this.serverConfig) {
      console.error(`${this.LOG_PREFIX} No server configuration found`);
      return false;
    }

    try {
      console.log(`${this.LOG_PREFIX} Initializing connection to ${this.serverConfig.connection.url}`);
      
      // Create client
      this.client = new Client({
        name: 'gallo-connect-chatbot',
        version: '1.0.0'
      });

      // Create transport
      this.transport = new StreamableHTTPClientTransport(
        new URL(this.serverConfig.connection.url!)
      );

      // Connect
      await this.client.connect(this.transport);
      console.log(`${this.LOG_PREFIX} Successfully connected to MCP server`);

      // Discover tools
      await this.discoverTools();

      // Update connections subject
      this.updateConnectionsSubject();

      return this.availableTools.length > 0;
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Failed to initialize connection:`, error);
      return false;
    }
  }

  /**
   * Discover available tools from the MCP server
   */
  private async discoverTools(): Promise<void> {
    if (!this.client) {
      console.error(`${this.LOG_PREFIX} No client available for tools discovery`);
      return;
    }

    try {
      console.log(`${this.LOG_PREFIX} Discovering tools...`);
      
      const response = await this.client.listTools();
      console.log(`${this.LOG_PREFIX} Tools response:`, response);

      this.availableTools = response.tools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        serverId: this.serverConfig!.id,
        inputSchema: {
          type: 'object',
          properties: (tool.inputSchema as any)?.properties || {},
          required: (tool.inputSchema as any)?.required || []
        }
      }));

      console.log(`${this.LOG_PREFIX} Discovered ${this.availableTools.length} tools:`, 
        this.availableTools.map(t => t.name));
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Failed to discover tools:`, error);
      this.availableTools = [];
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
   * Execute an MCP tool call using the SDK
   */
  public async callTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    if (!this.client) {
      throw new Error('MCP client not initialized');
    }

    // Inject site context and authentication from Spartacus services
    let enhancedArguments = { ...toolCall.arguments };
    
    // Automatically inject current site base URL
    try {
      const currentOrigin = this.windowRef.nativeWindow?.location?.origin;
      if (currentOrigin) {
        enhancedArguments['baseSiteUrl'] = currentOrigin;
        console.log(`${this.LOG_PREFIX} Auto-injected baseSiteUrl: ${currentOrigin}`);
      }
    } catch (error) {
      console.warn(`${this.LOG_PREFIX} Failed to get site base URL:`, error);
    }

    // Inject authorization token from Spartacus auth service
    try {
      const authToken = await firstValueFrom(this.authStorageService.getToken());
      if (authToken?.access_token) {
        enhancedArguments['access_token'] = `${authToken.access_token}`;
        console.log(`${this.LOG_PREFIX} Injected access_token`);
      } else {
        console.log(`${this.LOG_PREFIX} No access_token available`);
      }
    } catch (error) {
      console.warn(`${this.LOG_PREFIX} Failed to get access_token:`, error);
    }

    // If the tool call is for a B2B cart or place order tool, inject the cartId
    const isCartOperation = toolCall.name.includes('add-to-cart') || 
                           toolCall.name.includes('place-order') || 
                           toolCall.name.includes('cart') ||
                           toolCall.name.includes('checkout');
    
    if (isCartOperation) {
      try {
        const activeCart = await firstValueFrom(this.activeCartFacade.getActive());
        if (activeCart?.code) {
          enhancedArguments['cartId'] = activeCart.code;
          console.log(`${this.LOG_PREFIX} Auto-injected cartId for B2B cart operation: ${activeCart.code}`);
        } else {
          console.log(`${this.LOG_PREFIX} No active cart found for B2B cart operation - will create new cart if needed`);
        }
      } catch (error) {
        console.warn(`${this.LOG_PREFIX} Failed to get active cart for B2B operation:`, error);
      }
    }

    console.log(`${this.LOG_PREFIX} Executing tool call:`, {
      name: toolCall.name,
      arguments: enhancedArguments
    });

    try {
      const result = await this.client.callTool({
        name: toolCall.name,
        arguments: enhancedArguments
      });

      console.log(`${this.LOG_PREFIX} Tool call successful:`, result);
      return this.formatToolResult(result);
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
   * Check if MCP service is ready
   */
  public isReady(): boolean {
    return this.client !== null && this.availableTools.length > 0;
  }

  /**
   * Get current server configuration
   */
  public getServerConfig(): MCPServerConfig | null {
    return this.serverConfig;
  }

  /**
   * Disconnect from the MCP server
   */
  public async disconnect(): Promise<void> {
    try {
      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }
      if (this.client) {
        this.client = null;
      }
      this.availableTools = [];
      this.updateConnectionsSubject();
      console.log(`${this.LOG_PREFIX} Disconnected from MCP server`);
    } catch (error) {
      console.warn(`${this.LOG_PREFIX} Error during disconnect:`, error);
    }
  }

  // Legacy compatibility methods for existing components
  
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
      this.disconnect();
    }
  }

  public async connect(config: MCPServerConfig): Promise<any> {
    console.log(`${this.LOG_PREFIX} Legacy method connect called - using configureServer + initializeConnection`);
    this.configureServer(config);
    await this.initializeConnection();
    return { id: config.id, status: 'connected' };
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
    await this.disconnect();
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

  private updateConnectionsSubject(): void {
    const connections = this.getAllConnections();
    this.connectionsSubject.next(connections);
  }
}
