import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, timeout, catchError, map } from 'rxjs';
import { LLMProvider, LLMMessage, LLMResponse, LLMConfig, LLMFunctionDefinition } from './llm-provider.interface';

@Injectable({
  providedIn: 'root'
})
export class LocalLLMProvider implements LLMProvider {
  readonly name = 'Local LLM';
  readonly type = 'local' as const;
  
  private config: LLMConfig = {
    apiUrl: 'http://localhost:11434', // Default Ollama URL
    model: 'llama2', // Default model
    temperature: 0.7,
    maxTokens: 2048,
    timeout: 30000, // 30 seconds
    apiType: 'ollama' // 'ollama' or 'openai-compatible'
  };

  constructor(private http: HttpClient) {}

  configure(config: LLMConfig): void {
    console.log('LocalLLMProvider.configure called with:', config);
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };
    
    // Auto-detect API type based on URL if not specified
    if (!this.config.apiType) {
      if (this.config.apiUrl?.includes('1234') || this.config.apiUrl?.includes('lmstudio')) {
        this.config.apiType = 'openai-compatible';
      } else {
        this.config.apiType = 'ollama';
      }
    }
    
    console.log('LocalLLMProvider configuration updated:');
    console.log('  Old config:', oldConfig);
    console.log('  New config:', this.config);
  }

  isAvailable(): Observable<boolean> {
    if (!this.config.apiUrl) {
      return of(false);
    }

    // Use different endpoints based on API type
    const endpoint = this.config.apiType === 'openai-compatible' 
      ? `${this.config.apiUrl}/v1/models`
      : `${this.config.apiUrl}/api/tags`;

    return this.http.get(endpoint, { responseType: 'json' })
      .pipe(
        timeout(5000),
        map(() => true),
        catchError(() => of(false))
      );
  }

  generateResponse(messages: LLMMessage[], context?: any, tools?: LLMFunctionDefinition[]): Observable<LLMResponse> {
    console.log(`[LocalLLMProvider] Generating response with ${tools?.length || 0} tools available`);
    
    if (!this.config.apiUrl || !this.config.model) {
      return throwError(() => new Error('Local LLM not properly configured'));
    }

    if (this.config.apiType === 'openai-compatible') {
      return this.generateOpenAICompatibleResponse(messages, tools);
    } else {
      return this.generateOllamaResponse(messages, tools);
    }
  }

  private generateOpenAICompatibleResponse(messages: LLMMessage[], tools?: LLMFunctionDefinition[]): Observable<LLMResponse> {
    // Add system message for context
    const systemMessage: LLMMessage = {
      role: 'system',
      content: 'You are a helpful customer service assistant for Gallo Connect, an e-commerce platform. ' +
               'Provide helpful, friendly, and accurate responses to customer inquiries about products, orders, ' +
               'shipping, returns, and general support. Keep responses concise but informative. ' +
               'When available, use the provided tools to search for products, check inventory, or perform other actions.'
    };

    const requestBody: any = {
      model: this.config.model,
      messages: [systemMessage, ...messages],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: false
    };

    // Add tools if available and model supports them
    if (tools && tools.length > 0) {
      console.log(`[LocalLLMProvider] Adding ${tools.length} tools to request`);
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    return this.http.post<any>(`${this.config.apiUrl}/v1/chat/completions`, requestBody)
      .pipe(
        timeout(this.config.timeout || 30000),
        map(response => {
          const result: LLMResponse = {
            content: response.choices?.[0]?.message?.content || '',
            usage: response.usage,
            model: response.model,
            finish_reason: response.choices?.[0]?.finish_reason
          };

          // Handle tool calls if present
          const message = response.choices?.[0]?.message;
          if (message?.tool_calls && message.tool_calls.length > 0) {
            console.log(`[LocalLLMProvider] Response contains ${message.tool_calls.length} tool calls`);
            result.tool_calls = message.tool_calls;
          }

          return result;
        }),
        catchError(this.handleError.bind(this))
      );
  }

  private generateOllamaResponse(messages: LLMMessage[], tools?: LLMFunctionDefinition[]): Observable<LLMResponse> {
    // Convert messages to prompt format for Ollama
    let prompt = this.convertMessagesToPrompt(messages);
    
    // Add tools information to prompt if available (Ollama doesn't support native tool calling)
    if (tools && tools.length > 0) {
      console.log(`[LocalLLMProvider] Ollama doesn't support native tool calling, adding tools to prompt`);
      const toolsInfo = tools.map(tool => 
        `- ${tool.function.name}: ${tool.function.description}`
      ).join('\n');
      
      prompt = `${prompt}\n\nAvailable tools:\n${toolsInfo}\n\nNote: If you need to use any of these tools, please indicate which tool you would like to use and with what parameters.`;
    }
    
    const requestBody = {
      model: this.config.model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: this.config.temperature,
        num_predict: this.config.maxTokens
      }
    };

    return this.http.post<any>(`${this.config.apiUrl}/api/generate`, requestBody)
      .pipe(
        timeout(this.config.timeout || 30000),
        map(response => ({
          content: response.response || '',
          model: response.model,
          usage: {
            prompt_tokens: response.prompt_eval_count,
            completion_tokens: response.eval_count,
            total_tokens: (response.prompt_eval_count || 0) + (response.eval_count || 0)
          },
          finish_reason: response.done ? 'stop' : 'length'
        } as LLMResponse)),
        catchError(this.handleError.bind(this))
      );
  }

  streamResponse(messages: LLMMessage[]): Observable<string> {
    if (!this.config.apiUrl || !this.config.model) {
      return throwError(() => new Error('Local LLM not properly configured'));
    }

    const prompt = this.convertMessagesToPrompt(messages);
    
    const requestBody = {
      model: this.config.model,
      prompt: prompt,
      stream: true,
      options: {
        temperature: this.config.temperature,
        num_predict: this.config.maxTokens
      }
    };

    // Note: This is a simplified implementation. In a real scenario, you'd need
    // to handle Server-Sent Events (SSE) for streaming responses
    return this.http.post(`${this.config.apiUrl}/api/generate`, requestBody, { 
      responseType: 'text' 
    }).pipe(
      timeout(this.config.timeout || 30000),
      catchError(this.handleError.bind(this))
    );
  }

  getHealthStatus(): Observable<{ status: 'healthy' | 'unhealthy' | 'unknown'; details?: any }> {
    return this.isAvailable().pipe(
      map(available => ({
        status: available ? 'healthy' as const : 'unhealthy' as const,
        details: {
          url: this.config.apiUrl,
          model: this.config.model,
          available
        }
      })),
      catchError(() => of({
        status: 'unknown' as const,
        details: { error: 'Unable to check health status' }
      }))
    );
  }

  private convertMessagesToPrompt(messages: LLMMessage[]): string {
    // Convert conversation history to a prompt format suitable for local LLMs
    let prompt = "You are a helpful customer service assistant for Gallo Connect, an e-commerce platform. ";
    prompt += "Provide helpful, friendly, and accurate responses to customer inquiries.\n\n";
    
    messages.forEach(message => {
      if (message.role === 'user') {
        prompt += `Customer: ${message.content}\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n`;
      }
    });
    
    prompt += "Assistant: ";
    return prompt;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Local LLM request failed';
    
    if (error.status === 0) {
      errorMessage = 'Unable to connect to local LLM server. Please ensure it is running.';
    } else if (error.status >= 500) {
      errorMessage = 'Local LLM server error. Please check server logs.';
    } else if (error.status === 404) {
      errorMessage = 'Local LLM model not found. Please check model configuration.';
    }
    
    console.error('Local LLM Error:', error);
    return throwError(() => new Error(errorMessage));
  }
}
