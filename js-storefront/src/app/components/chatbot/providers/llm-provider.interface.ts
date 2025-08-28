import { Observable } from 'rxjs';

export interface LLMMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: Date;
  tool_calls?: LLMToolCall[];
  tool_call_id?: string;
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMFunctionDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: any;
    mcp_metadata?: {
      serverId: string;
      originalName: string;
    };
  };
}

export interface LLMResponse {
  content: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
  finish_reason?: string;
  tool_calls?: LLMToolCall[];
}

export interface LLMConfig {
  apiKey?: string;
  apiUrl?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  apiType?: 'ollama' | 'openai-compatible';
  [key: string]: any; // Allow additional provider-specific config
}

export interface LLMProvider {
  readonly name: string;
  readonly type: 'local' | 'cloud';
  
  /**
   * Configure the provider with necessary settings
   */
  configure(config: LLMConfig): void;
  
  /**
   * Check if the provider is properly configured and available
   */
  isAvailable(): Observable<boolean>;
  
  /**
   * Generate a response from the LLM
   */
  generateResponse(messages: LLMMessage[], context?: any, tools?: LLMFunctionDefinition[]): Observable<LLMResponse>;
  
  /**
   * Stream a response from the LLM (optional, for real-time streaming)
   */
  streamResponse?(messages: LLMMessage[], context?: any): Observable<string>;
  
  /**
   * Get provider-specific health status
   */
  getHealthStatus(): Observable<{ status: 'healthy' | 'unhealthy' | 'unknown'; details?: any }>;
}
