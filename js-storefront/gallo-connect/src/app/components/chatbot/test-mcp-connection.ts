import { MCPService } from './mcp/mcp.service';
import { ChatbotConfigService } from './config/chatbot-config.service';

/**
 * Simple test function to verify MCP connection
 * This can be called from browser console for debugging
 */
export async function testMCPConnection(mcpService: MCPService, configService: ChatbotConfigService): Promise<void> {
  console.log('🧪 Testing MCP Connection...');
  
  try {
    // Get server config
    const mcpServers = configService.getPredefinedMCPServers();
    if (mcpServers.length === 0) {
      console.log('❌ No MCP servers configured');
      return;
    }
    
    console.log(`📋 Found ${mcpServers.length} configured servers`);
    
    // Use first enabled server
    const serverConfig = mcpServers.find(s => s.enabled) || mcpServers[0];
    console.log(`🔧 Testing server: ${serverConfig.name} at ${serverConfig.connection.url}`);
    
    // Configure service
    mcpService.configureServer(serverConfig);
    
    // Initialize connection
    const success = await mcpService.initializeConnection();
    
    if (success) {
      console.log('✅ MCP Connection successful');
      
      // Get tools for LLM
      mcpService.getToolsForLLM().subscribe(tools => {
        console.log(`🔧 Available tools: ${tools.length}`);
        tools.forEach(tool => {
          console.log(`  - ${tool.function.name}: ${tool.function.description}`);
        });
      });
      
    } else {
      console.log('❌ MCP Connection failed');
    }
    
  } catch (error) {
    console.error('💥 MCP Test Error:', error);
  }
}

/**
 * Test tool execution
 */
export async function testMCPTool(mcpService: MCPService, toolName: string, args: any = {}): Promise<void> {
  console.log(`🧪 Testing tool: ${toolName}`);
  
  try {
    const result = await mcpService.callTool({
      name: toolName,
      arguments: args,
      serverId: 'default'
    });
    
    console.log('✅ Tool execution result:', result);
  } catch (error) {
    console.error('💥 Tool execution error:', error);
  }
}

// Make functions available globally for browser console debugging
if (typeof window !== 'undefined') {
  (window as any).testMCPConnection = testMCPConnection;
  (window as any).testMCPTool = testMCPTool;
}
