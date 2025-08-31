import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, timeout, catchError, map } from 'rxjs';
import { LLMProvider, LLMMessage, LLMResponse, LLMConfig, LLMFunctionDefinition } from './llm-provider.interface';

@Injectable({
  providedIn: 'root'
})
export class OpenAIProvider implements LLMProvider {
  readonly name = 'OpenAI ChatGPT';
  readonly type = 'cloud' as const;
  
  private config: LLMConfig = {
    apiUrl: 'https://api.openai.com/v1',
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    maxTokens: 1000,
    timeout: 30000
  };

  constructor(private http: HttpClient) {}

  configure(config: LLMConfig): void {
    this.config = { ...this.config, ...config };
  }

  isAvailable(): Observable<boolean> {
    if (!this.config.apiKey) {
      return of(false);
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json'
    });

    return this.http.get(`${this.config.apiUrl}/models`, { headers })
      .pipe(
        timeout(5000),
        map(() => true),
        catchError(() => of(false))
      );
  }

  generateResponse(messages: LLMMessage[], context?: any, tools?: LLMFunctionDefinition[]): Observable<LLMResponse> {
    console.log(`[OpenAIProvider] Generating response with ${tools?.length || 0} tools available`);
    
    if (!this.config.apiKey) {
      return throwError(() => new Error('OpenAI API key not configured'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json'
    });

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
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    };

    // Add tools if available
    if (tools && tools.length > 0) {
      console.log(`[OpenAIProvider] Adding ${tools.length} tools to request`);
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
    }

    return this.http.post<any>(`${this.config.apiUrl}/chat/completions`, requestBody, { headers })
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
            console.log(`[OpenAIProvider] Response contains ${message.tool_calls.length} tool calls`);
            result.tool_calls = message.tool_calls;
          }

          return result;
        }),
        catchError(this.handleError.bind(this))
      );
  }

  streamResponse(messages: LLMMessage[]): Observable<string> {
    if (!this.config.apiKey) {
      return throwError(() => new Error('OpenAI API key not configured'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json'
    });

    const systemMessage: LLMMessage = {
      role: 'system',
      content: 'You are a helpful customer service assistant for Gallo Connect, an e-commerce platform. ' +
               'Provide helpful, friendly, and accurate responses to customer inquiries.'
    };

    const requestBody = {
      model: this.config.model,
      messages: [systemMessage, ...messages],
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: true
    };

    // Note: This is a simplified implementation. In a real scenario, you'd need
    // to handle Server-Sent Events (SSE) for streaming responses
    return this.http.post(`${this.config.apiUrl}/chat/completions`, requestBody, { 
      headers,
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
          provider: 'OpenAI',
          model: this.config.model,
          available,
          hasApiKey: !!this.config.apiKey
        }
      })),
      catchError(() => of({
        status: 'unknown' as const,
        details: { error: 'Unable to check OpenAI API status' }
      }))
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'OpenAI API request failed';
    
    if (error.status === 401) {
      errorMessage = 'OpenAI API key is invalid or expired';
    } else if (error.status === 429) {
      errorMessage = 'OpenAI API rate limit exceeded. Please try again later.';
    } else if (error.status === 500 || error.status === 503) {
      errorMessage = 'OpenAI API is currently unavailable. Please try again later.';
    } else if (error.status === 0) {
      errorMessage = 'Unable to connect to OpenAI API. Please check your internet connection.';
    }
    
    console.error('OpenAI API Error:', error);
    return throwError(() => new Error(errorMessage));
  }
}
