import { Injectable } from '@angular/core';
import { MCPServerConfig } from '../mcp/mcp-server.interface';
import { LLMServiceConfig } from '../services/llm.service';

export interface ChatbotProductionConfig {
  // Environment control
  isDevelopment: boolean;
  allowUserConfiguration: boolean;
  
  // LLM Configuration (developer-controlled for production)
  llmConfig: {
    forcedProvider?: 'local' | 'openai' | 'gemini' | 'fallback';
    providers: {
      local?: {
        apiUrl: string;
        model: string;
        apiType: 'ollama' | 'openai-compatible';
        temperature?: number;
        maxTokens?: number;
      };
      openai?: {
        apiKey: string;
        model: string;
        temperature?: number;
        maxTokens?: number;
      };
      gemini?: {
        apiKey: string;
        model: string;
        temperature?: number;
        maxTokens?: number;
      };
    };
  };
  
  // MCP Configuration (developer-controlled)
  mcpServers: MCPServerConfig[];
  
  // UI Configuration
  ui: {
    showConfigButton: boolean;
    showLLMSettings: boolean;
    showMCPSettings: boolean;
    allowMCPServerAddition: boolean;
    allowLLMProviderChange: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotConfigService {
  private readonly config: ChatbotProductionConfig;

  constructor() {
    this.config = this.loadConfiguration();
  }

  private loadConfiguration(): ChatbotProductionConfig {
    // Check if we're in development mode
    const isDevelopment = this.isDevMode();
    
    return {
      isDevelopment,
      allowUserConfiguration: isDevelopment,
      
      llmConfig: {
        // Force specific provider in production (undefined = allow user choice in dev)
        forcedProvider: isDevelopment ? undefined : 'local', // Change this for production
        
        providers: {
          local: {
            apiUrl: 'http://192.168.10.111:1234', // Your LM Studio URL
            model: 'openai/gpt-oss-20b',
            apiType: 'openai-compatible',
            temperature: 0.7,
            maxTokens: 1000
          },
          // Add production API keys via environment variables or secure config
          openai: {
            apiKey: '', // Set via environment in production
            model: 'gpt-3.5-turbo',
            temperature: 0.7,
            maxTokens: 1000
          },
          gemini: {
            apiKey: '', // Set via environment in production
            model: 'gemini-pro',
            temperature: 0.7,
            maxTokens: 1000
          }
        }
      },
      
      // Developer-defined MCP servers
      mcpServers: [
        {
          id: 'gallo-commerce',
          name: 'SAP Commerce Tools Server',
          description: 'Product search, Order management, cart operations, and checkout tools',
          type: 'http',
          enabled: true,
          connection: {
            url: 'http://localhost:3001/mcp'
          },
          capabilities: {
            tools: true,
            resources: false,
            prompts: false,
            logging: false
          },
          timeout: 30000,
          retryAttempts: 3
        }
      ],
      
      ui: {
        showConfigButton: isDevelopment,
        showLLMSettings: isDevelopment,
        showMCPSettings: isDevelopment,
        allowMCPServerAddition: isDevelopment,
        allowLLMProviderChange: isDevelopment
      }
    };
  }

  private isDevMode(): boolean {
    // Multiple ways to detect development mode
    return (
      // Angular's isDevMode (requires import { isDevMode } from '@angular/core')
      typeof window !== 'undefined' && 
      (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('dev') ||
        window.location.port !== '' ||
        // Check for development flags
        localStorage.getItem('dev-mode') === 'true' ||
        // Check if running on dev server
        window.location.href.includes('4200')
      )
    );
  }

  // Public API for components
  public getConfig(): ChatbotProductionConfig {
    return { ...this.config }; // Return copy to prevent mutations
  }

  public isDevelopmentMode(): boolean {
    return this.config.isDevelopment;
  }

  public shouldShowConfigButton(): boolean {
    return this.config.ui.showConfigButton;
  }

  public shouldShowLLMSettings(): boolean {
    return this.config.ui.showLLMSettings;
  }

  public shouldShowMCPSettings(): boolean {
    return this.config.ui.showMCPSettings;
  }

  public canAddMCPServers(): boolean {
    return this.config.ui.allowMCPServerAddition;
  }

  public canChangeLLMProvider(): boolean {
    return this.config.ui.allowLLMProviderChange;
  }

  public getForcedLLMProvider(): string | undefined {
    return this.config.llmConfig.forcedProvider;
  }

  public getLLMConfiguration(): LLMServiceConfig {
    const forced = this.config.llmConfig.forcedProvider;
    
    return {
      primaryProvider: forced || 'local',
      fallbackProvider: 'fallback',
      enableFallback: true,
      providers: {
        local: this.config.llmConfig.providers.local,
        openai: this.config.llmConfig.providers.openai,
        gemini: this.config.llmConfig.providers.gemini
      }
    };
  }

  public getPredefinedMCPServers(): MCPServerConfig[] {
    return [...this.config.mcpServers]; // Return copy
  }

  // Method to override config for production deployment
  public updateProductionConfig(updates: Partial<ChatbotProductionConfig>): void {
    if (this.config.isDevelopment) {
      console.warn('Cannot update production config in development mode');
      return;
    }
    
    // In production, allow specific config updates
    Object.assign(this.config, updates);
  }

  // Environment-specific configurations
  public static createProductionConfig(): Partial<ChatbotProductionConfig> {
    return {
      isDevelopment: false,
      allowUserConfiguration: false,
      
      llmConfig: {
        forcedProvider: 'local', // Or 'openai', 'gemini' as needed
        providers: {
          local: {
            apiUrl: 'http://production-llm:1234', // Configure via environment variables in actual deployment
            model: 'production-model', // Configure via environment variables in actual deployment
            apiType: 'openai-compatible',
            temperature: 0.7,
            maxTokens: 1000
          }
        }
      },
      
      ui: {
        showConfigButton: false,
        showLLMSettings: false,
        showMCPSettings: false,
        allowMCPServerAddition: false,
        allowLLMProviderChange: false
      }
    };
  }
}
