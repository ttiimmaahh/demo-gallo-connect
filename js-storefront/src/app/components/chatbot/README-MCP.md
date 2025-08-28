# Model Context Protocol (MCP) Integration

## Overview

The Gallo Connect chatbot now includes comprehensive support for the **Model Context Protocol (MCP)**, enabling your chatbot to connect to external MCP servers and leverage their tools, resources, and capabilities.

## What is MCP?

Model Context Protocol is an open protocol that standardizes how AI applications connect to external data sources and tools. It allows:

- **Tools**: Functions that AI can call to perform actions
- **Resources**: Data sources that AI can read for context
- **Prompts**: Reusable prompt templates
- **Real-time Updates**: Live notifications when tools/resources change

## Features Implemented

### 🔌 **MCP Server Management**
- Support for multiple MCP server types (HTTP, SSE, STDIO)
- Real-time connection monitoring and health checks
- Automatic reconnection and fallback handling
- Server configuration persistence

### 🔧 **Tool Integration**
- Automatic discovery of available tools from connected servers
- Seamless integration with LLM providers (OpenAI, Gemini, Local LLM)
- Tool execution with proper error handling
- Support for complex tool workflows and chaining

### 📚 **Resource Access**
- Dynamic resource discovery and access
- Support for various resource types (files, APIs, databases)
- URI-based resource identification
- Content type detection and handling

### 💬 **Prompt Templates**
- Server-provided prompt templates
- Parameter validation and completion
- Context-aware prompt generation

### 🎛️ **Configuration UI**
- Intuitive web interface for server management
- Real-time status monitoring
- Tool and resource browsing
- Connection testing and diagnostics

## Architecture

### Core Components

1. **MCP Service** (`mcp.service.ts`)
   - Central service for managing MCP server connections
   - Handles tool discovery, execution, and resource access
   - Provides observables for real-time updates

2. **MCP Server Interface** (`mcp-server.interface.ts`)
   - TypeScript interfaces for type safety
   - Comprehensive type definitions for all MCP entities
   - Provider contracts for extensibility

3. **LLM Integration** (`llm.service.ts`)
   - Enhanced to support function calling with MCP tools
   - Automatic tool discovery and registration
   - Tool execution orchestration

4. **Configuration UI** (`mcp-config.component.ts`)
   - Rich web interface for server management
   - Real-time connection status display
   - Tool and capability overview

## Supported Server Types

### 1. HTTP Servers
- Standard HTTP-based MCP servers
- JSON-RPC over HTTP protocol
- Custom header support for authentication

### 2. Server-Sent Events (SSE)
- Real-time bidirectional communication
- Live notifications for resource/tool updates
- Persistent connections with automatic reconnection

### 3. STDIO (via proxy)
- Command-line MCP servers
- Requires backend proxy service for browser compatibility
- Ideal for local development and desktop applications

## Configuration

### Basic Server Setup

```typescript
const serverConfig: MCPServerConfig = {
  id: 'my-server',
  name: 'My MCP Server',
  description: 'Custom tools and resources',
  type: 'http',
  enabled: true,
  connection: {
    url: 'http://localhost:3000/mcp',
    headers: {
      'Authorization': 'Bearer your-token'
    }
  },
  capabilities: {
    tools: true,
    resources: true,
    prompts: true,
    logging: false
  },
  timeout: 30000,
  retryAttempts: 3
};
```

### UI Configuration

1. **Navigate to Chatbot Settings** → Click the gear icon ⚙️
2. **Select MCP Servers Tab** → Click "🔌 MCP Servers"
3. **Add New Server** → Click "+ Add Server"
4. **Configure Connection**:
   - Set server type (HTTP/SSE/STDIO)
   - Enter server URL or command
   - Configure authentication headers
   - Set timeout and retry options
5. **Test Connection** → Use "Test Connection" button
6. **Save and Connect** → Save configuration and connect

## Usage Examples

### Example MCP Servers You Can Connect To

1. **File System Server**
   ```json
   {
     "name": "File System",
     "type": "http",
     "url": "http://localhost:3001/mcp",
     "capabilities": ["tools", "resources"]
   }
   ```

2. **Database Server**
   ```json
   {
     "name": "PostgreSQL",
     "type": "http", 
     "url": "http://localhost:3002/mcp",
     "headers": {"Authorization": "Bearer db-token"}
   }
   ```

3. **API Integration Server**
   ```json
   {
     "name": "Weather API",
     "type": "sse",
     "url": "http://localhost:3003/sse"
   }
   ```

### Chatbot Usage

Once configured, users can leverage MCP tools naturally in conversation:

**User:** "Can you check the weather in New York?"
**Chatbot:** *Automatically calls weather tool from connected MCP server*

**User:** "Show me the contents of config.json"
**Chatbot:** *Uses file system resource to read and display file*

**User:** "Run a database query to get user statistics"
**Chatbot:** *Executes SQL tool and returns formatted results*

## Tool Execution Flow

1. **User sends message** → Chatbot receives input
2. **LLM processes with tools** → OpenAI/Gemini/Local LLM sees available tools
3. **LLM decides to use tool** → Returns tool call instructions
4. **MCP service executes** → Calls appropriate MCP server
5. **Results returned** → Tool results added to conversation
6. **LLM generates response** → Final response incorporating tool results

## Security Considerations

### Authentication
- Support for Bearer tokens and custom headers
- Secure credential storage (not in localStorage)
- Per-server authentication configuration

### Network Security
- HTTPS/WSS enforcement for production
- CORS configuration for browser compatibility
- Request timeout and rate limiting

### Tool Safety
- User confirmation for sensitive operations
- Tool execution sandboxing
- Error handling and graceful failures

## Development Guide

### Creating Custom MCP Servers

Your backend can implement MCP servers using the TypeScript SDK:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer({
  name: "custom-server",
  version: "1.0.0"
});

// Register a tool
server.registerTool(
  "database-query",
  {
    title: "Database Query",
    description: "Execute SQL queries",
    inputSchema: {
      type: "object", 
      properties: {
        query: { type: "string" }
      }
    }
  },
  async ({ query }) => ({
    content: [{ type: "text", text: await executeQuery(query) }]
  })
);
```

### Adding New Server Types

Extend the `MCPService` to support additional transport types:

1. Add new type to `MCPServerConfig.type`
2. Implement initialization in `initializeConnection()`
3. Add connection handling in `makeServerRequest()`
4. Update UI to support new configuration options

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Verify server URL and port
   - Check network connectivity
   - Validate authentication credentials

2. **Tools Not Appearing**
   - Ensure server capabilities include "tools"
   - Check server logs for initialization errors
   - Verify tool registration in server code

3. **Tool Execution Errors**
   - Review tool argument validation
   - Check server-side error logs
   - Verify tool permissions and access

### Debug Mode

Enable debug logging:
```typescript
// In browser console
localStorage.setItem('debug-mcp', 'true');
```

## Performance

### Optimization Features
- Connection pooling and reuse
- Tool result caching
- Lazy loading of server capabilities
- Automatic health checking
- Request debouncing

### Monitoring
- Real-time connection status
- Tool execution metrics
- Error rate monitoring
- Performance analytics

## Future Enhancements

### Planned Features
- **Tool Composition**: Chaining multiple tools automatically
- **Resource Subscriptions**: Real-time resource change notifications
- **Advanced Authentication**: OAuth2, JWT, and SSO support
- **Tool Marketplace**: Discover and install community MCP servers
- **Visual Tool Builder**: Create simple tools via UI
- **Workflow Automation**: Save and replay tool sequences

### Extensibility
The MCP integration is designed to be:
- **Modular**: Easy to add new transport types
- **Configurable**: Extensive customization options
- **Observable**: Rich event system for monitoring
- **Type-safe**: Full TypeScript support
- **Testable**: Comprehensive testing interfaces

## API Reference

See the inline documentation in:
- `mcp-server.interface.ts` - Type definitions
- `mcp.service.ts` - Core service methods
- `llm.service.ts` - LLM integration methods
- `mcp-config.component.ts` - UI component

## Support

For MCP-specific issues:
1. Check server logs and connection status
2. Test individual tool calls
3. Verify server configuration
4. Review MCP protocol documentation
5. Contact support with connection details

The MCP integration transforms your chatbot from a simple conversational interface into a powerful AI agent capable of interacting with your entire technology stack!
