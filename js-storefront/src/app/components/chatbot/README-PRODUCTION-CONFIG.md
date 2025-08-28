# Production vs Development Configuration Guide

## Overview

The Gallo Connect chatbot now includes **environment-aware configuration** that automatically switches between development and production modes. This ensures that:

- **Development**: Full configuration access for developers
- **Production**: Locked-down, administrator-controlled settings

## Configuration Architecture

### 🔧 **Centralized Configuration Service**
- `chatbot-config.service.ts` - Single source of truth for all settings
- Environment detection based on hostname and port
- Automatic switching between dev/prod modes

### 🎛️ **Environment Detection**

The system automatically detects the environment using:

```typescript
private isDevMode(): boolean {
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.includes('dev') ||
    window.location.port !== '' ||
    localStorage.getItem('dev-mode') === 'true' ||
    window.location.href.includes('4200')
  );
}
```

## Development Mode Features

### ✅ **Full Access**
- **Config Button**: ⚙️ Gear icon visible in chat header
- **LLM Settings**: Choose between Local LLM, OpenAI, Gemini
- **MCP Servers**: Add, modify, remove MCP servers
- **Real-time Testing**: Test connections and configurations
- **Debug Features**: Access to all diagnostic tools

### 🎯 **Developer Experience**
```typescript
// Development configuration example
{
  isDevelopment: true,
  allowUserConfiguration: true,
  ui: {
    showConfigButton: true,
    showLLMSettings: true,
    showMCPSettings: true,
    allowMCPServerAddition: true,
    allowLLMProviderChange: true
  }
}
```

## Production Mode Features

### 🔒 **Locked Configuration**
- **No Config Button**: Settings gear icon hidden
- **Fixed LLM Provider**: Administrator-defined AI provider
- **Predefined MCP Servers**: Only company-approved tools
- **No User Modifications**: End users cannot change settings
- **Security Focus**: No exposure of internal configurations

### 🏭 **Production Configuration**
```typescript
// Production configuration example
{
  isDevelopment: false,
  allowUserConfiguration: false,
  llmConfig: {
    forcedProvider: 'local', // Locked to specific provider
    providers: {
      local: {
        apiUrl: 'http://production-llm:1234',
        model: 'company-approved-model',
        apiType: 'openai-compatible'
      }
    }
  },
  mcpServers: [
    // Only pre-approved company tools
    {
      id: 'gallo-database',
      name: 'Gallo Database Server',
      type: 'http',
      enabled: true,
      connection: {
        url: 'http://internal-api:3001/mcp/database'
      }
    }
  ],
  ui: {
    showConfigButton: false,
    showLLMSettings: false,
    showMCPSettings: false,
    allowMCPServerAddition: false,
    allowLLMProviderChange: false
  }
}
```

## Developer Configuration

### 🎯 **LLM Provider Settings**

Configure your preferred AI providers in `chatbot-config.service.ts`:

```typescript
llmConfig: {
  forcedProvider: undefined, // Allow choice in dev mode
  providers: {
    local: {
      apiUrl: 'http://192.168.20.22:1234', // Your LM Studio
      model: 'openai/gpt-oss-120b',
      apiType: 'openai-compatible',
      temperature: 0.7,
      maxTokens: 1000
    },
    openai: {
      apiKey: '', // Set for testing
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 1000
    },
    gemini: {
      apiKey: '', // Set for testing
      model: 'gemini-pro',
      temperature: 0.7,
      maxTokens: 1000
    }
  }
}
```

### 🔌 **MCP Server Configuration**

Define your backend MCP servers:

```typescript
mcpServers: [
  {
    id: 'gallo-database',
    name: 'Gallo Database Server',
    description: 'Access to product catalog, inventory, and customer data',
    type: 'http',
    enabled: true,
    connection: {
      url: 'http://localhost:3001/mcp/database',
      headers: {
        'Authorization': 'Bearer your-internal-token'
      }
    },
    capabilities: {
      tools: true,
      resources: true,
      prompts: false,
      logging: true
    }
  },
  {
    id: 'gallo-commerce',
    name: 'Commerce Tools Server',
    description: 'Order management, cart operations, and checkout tools',
    type: 'http',
    enabled: true,
    connection: {
      url: 'http://localhost:3002/mcp/commerce'
    }
  }
  // Add more MCP servers as needed
]
```

## Production Deployment

### 🚀 **For Production Mode**

1. **Update Configuration**:
   ```typescript
   // In chatbot-config.service.ts
   private loadConfiguration(): ChatbotProductionConfig {
     const isDevelopment = this.isDevMode();
     
     return {
       isDevelopment,
       allowUserConfiguration: isDevelopment,
       
       llmConfig: {
         // Force specific provider in production
         forcedProvider: isDevelopment ? undefined : 'local',
         providers: {
           local: {
             apiUrl: 'http://production-llm:1234',
             model: 'production-model',
             apiType: 'openai-compatible'
           }
         }
       },
       
       // Only include approved MCP servers
       mcpServers: [
         // Your production MCP servers
       ]
     };
   }
   ```

2. **Environment Variables**: 
   - Set production URLs and tokens
   - Configure authentication secrets
   - Define model names and endpoints

3. **Build for Production**:
   ```bash
   ng build --configuration production
   ```

### 🔐 **Security Considerations**

#### **API Keys & Secrets**
- Never hardcode production API keys
- Use environment variables or secret management
- Implement proper authentication headers

#### **Network Security**
- Use HTTPS/WSS for all production communications
- Implement proper CORS policies
- Validate all MCP server certificates

#### **Access Control**
- MCP servers should authenticate requests
- Implement rate limiting
- Log all tool executions for audit

## User Experience

### 👨‍💻 **Development Experience**
```
User opens chatbot → Sees ⚙️ button → Full configuration access
```

### 👤 **Production Experience**
```
User opens chatbot → Clean interface → No settings visible → Fixed capabilities
```

## Configuration Examples

### 🏢 **Enterprise Configuration**

```typescript
// For large organizations
{
  llmConfig: {
    forcedProvider: 'openai', // Use enterprise OpenAI
    providers: {
      openai: {
        apiKey: '${OPENAI_ENTERPRISE_KEY}',
        model: 'gpt-4',
        temperature: 0.3, // Conservative for business
        maxTokens: 500
      }
    }
  },
  mcpServers: [
    {
      id: 'enterprise-crm',
      name: 'CRM Integration',
      type: 'http',
      connection: {
        url: 'https://internal-api.company.com/mcp/crm',
        headers: { 'Authorization': 'Bearer ${CRM_TOKEN}' }
      }
    },
    {
      id: 'enterprise-database',
      name: 'Data Warehouse',
      type: 'http',
      connection: {
        url: 'https://data-api.company.com/mcp/warehouse',
        headers: { 'Authorization': 'Bearer ${DATA_TOKEN}' }
      }
    }
  ]
}
```

### 🏠 **Self-Hosted Configuration**

```typescript
// For self-hosted deployments
{
  llmConfig: {
    forcedProvider: 'local',
    providers: {
      local: {
        apiUrl: 'http://ollama-server:11434',
        model: 'llama2',
        apiType: 'ollama',
        temperature: 0.7,
        maxTokens: 1000
      }
    }
  },
  mcpServers: [
    {
      id: 'local-files',
      name: 'File System',
      type: 'http',
      connection: {
        url: 'http://file-server:3001/mcp'
      }
    }
  ]
}
```

## Deployment Checklist

### ✅ **Pre-Production**
- [ ] Configure production LLM provider
- [ ] Define approved MCP servers
- [ ] Set authentication tokens
- [ ] Test all tool integrations
- [ ] Verify network connectivity
- [ ] Review security settings

### ✅ **Production Deployment**
- [ ] Environment detection working
- [ ] Config button hidden
- [ ] LLM provider locked
- [ ] MCP servers auto-connected
- [ ] No user configuration access
- [ ] All tools functioning
- [ ] Monitoring enabled

## Troubleshooting

### 🔧 **Development Issues**
```bash
# Force development mode
localStorage.setItem('dev-mode', 'true');
```

### 🏭 **Production Issues**
```bash
# Check configuration detection
console.log(configService.isDevelopmentMode());
console.log(configService.getConfig());
```

### 🔍 **Debug Mode**
```typescript
// Enable debug logging
localStorage.setItem('debug-mcp', 'true');
localStorage.setItem('debug-llm', 'true');
```

## Benefits

### 🎯 **For Developers**
- **Flexibility**: Test different AI providers and tools
- **Rapid Development**: Quick configuration changes
- **Full Control**: Access to all settings and diagnostics

### 🏢 **For Organizations**
- **Security**: No end-user access to sensitive configurations
- **Consistency**: Standardized AI capabilities across all users
- **Control**: Administrator-managed tool sets and providers
- **Compliance**: Audit-friendly locked configurations

### 👥 **For End Users**
- **Simplicity**: Clean interface without configuration complexity
- **Reliability**: Stable, tested configurations
- **Performance**: Optimized settings for production workloads

The configuration system ensures your chatbot works perfectly in both development and production environments while maintaining security and usability! 🚀
