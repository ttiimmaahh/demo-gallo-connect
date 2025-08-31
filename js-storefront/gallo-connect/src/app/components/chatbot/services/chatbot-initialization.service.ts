import { Injectable } from '@angular/core';
import { MCPSDKService } from '../mcp/mcp-sdk.service';
import { ChatbotConfigService } from '../config/chatbot-config.service';

@Injectable({
  providedIn: 'root'
})
export class ChatbotInitializationService {
  private readonly LOG_PREFIX = '[ChatbotInitialization]';
  private isInitialized = false;

  constructor(
    private mcpService: MCPSDKService,
    private configService: ChatbotConfigService
  ) {
    console.log(`${this.LOG_PREFIX} Chatbot initialization service created`);
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log(`${this.LOG_PREFIX} Already initialized, skipping`);
      return;
    }

    console.log(`${this.LOG_PREFIX} Starting chatbot initialization...`);

    try {
      await this.initializeMCPServers();
      this.isInitialized = true;
      console.log(`${this.LOG_PREFIX} Chatbot initialization completed successfully`);
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Initialization failed:`, error);
      // Don't throw - allow chatbot to work without MCP if needed
    }
  }

  private async initializeMCPServers(): Promise<void> {
    console.log(`${this.LOG_PREFIX} Initializing MCP servers...`);
    
    // Get predefined MCP server configurations
    const predefinedServers = this.configService.getPredefinedMCPServers();
    console.log(`${this.LOG_PREFIX} Found ${predefinedServers.length} predefined MCP servers`);

    if (predefinedServers.length === 0) {
      console.log(`${this.LOG_PREFIX} No predefined MCP servers to initialize`);
      return;
    }

    // Add all predefined servers to MCP service
    for (const serverConfig of predefinedServers) {
      console.log(`${this.LOG_PREFIX} Adding server configuration: ${serverConfig.name} (${serverConfig.id})`);
      this.mcpService.addServerConfiguration(serverConfig);
    }

    // Connect to all enabled servers
    const enabledServers = predefinedServers.filter(server => server.enabled);
    console.log(`${this.LOG_PREFIX} Connecting to ${enabledServers.length} enabled servers...`);

    for (const serverConfig of enabledServers) {
      try {
        console.log(`${this.LOG_PREFIX} Attempting to connect to ${serverConfig.name}...`);
        await this.mcpService.connect(serverConfig);
        console.log(`${this.LOG_PREFIX} Successfully connected to ${serverConfig.name}`);
      } catch (error) {
        console.error(`${this.LOG_PREFIX} Failed to connect to ${serverConfig.name}:`, error);
        // Continue with other servers even if one fails
      }
    }

    // Log final status
    const connections = this.mcpService.getAllConnections();
    const connectedCount = connections.filter(c => c.status === 'connected').length;
    console.log(`${this.LOG_PREFIX} MCP initialization complete: ${connectedCount}/${enabledServers.length} servers connected`);
    
    // Log available tools
    const allTools = await this.mcpService.listTools();
    console.log(`${this.LOG_PREFIX} Total available tools: ${allTools.length}`);
    allTools.forEach(tool => {
      console.log(`${this.LOG_PREFIX} - ${tool.name} (${tool.serverId}): ${tool.description}`);
    });
  }

  public isInitializationComplete(): boolean {
    return this.isInitialized;
  }

  public async reinitialize(): Promise<void> {
    console.log(`${this.LOG_PREFIX} Reinitializing...`);
    this.isInitialized = false;
    await this.initialize();
  }
}
