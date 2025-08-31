import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, of, throwError, timeout, catchError, map } from 'rxjs';
import { LLMProvider, LLMMessage, LLMResponse, LLMConfig, LLMFunctionDefinition } from './llm-provider.interface';

@Injectable({
  providedIn: 'root'
})
export class GeminiProvider implements LLMProvider {
  readonly name = 'Google Gemini';
  readonly type = 'cloud' as const;
  
  private config: LLMConfig = {
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-pro',
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

    // Simple health check - try to list models
    const url = `${this.config.apiUrl}/models?key=${this.config.apiKey}`;
    
    return this.http.get(url)
      .pipe(
        timeout(5000),
        map(() => true),
        catchError(() => of(false))
      );
  }

  generateResponse(messages: LLMMessage[], context?: any, tools?: LLMFunctionDefinition[]): Observable<LLMResponse> {
    console.log(`[GeminiProvider] Generating response with ${tools?.length || 0} tools available`);
    if (!this.config.apiKey) {
      return throwError(() => new Error('Google Gemini API key not configured'));
    }

    const url = `${this.config.apiUrl}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;
    
    // Convert messages to Gemini format
    const contents = this.convertMessagesToGeminiFormat(messages);
    
    const requestBody = {
      contents: contents,
      generationConfig: {
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxTokens,
        topP: 0.8,
        topK: 10
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    const headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });

    return this.http.post<any>(url, requestBody, { headers })
      .pipe(
        timeout(this.config.timeout || 30000),
        map(response => ({
          content: response.candidates?.[0]?.content?.parts?.[0]?.text || '',
          usage: {
            prompt_tokens: response.usageMetadata?.promptTokenCount,
            completion_tokens: response.usageMetadata?.candidatesTokenCount,
            total_tokens: response.usageMetadata?.totalTokenCount
          },
          model: this.config.model,
          finish_reason: response.candidates?.[0]?.finishReason
        } as LLMResponse)),
        catchError(this.handleError.bind(this))
      );
  }

  getHealthStatus(): Observable<{ status: 'healthy' | 'unhealthy' | 'unknown'; details?: any }> {
    return this.isAvailable().pipe(
      map(available => ({
        status: available ? 'healthy' as const : 'unhealthy' as const,
        details: {
          provider: 'Google Gemini',
          model: this.config.model,
          available,
          hasApiKey: !!this.config.apiKey
        }
      })),
      catchError(() => of({
        status: 'unknown' as const,
        details: { error: 'Unable to check Gemini API status' }
      }))
    );
  }

  private convertMessagesToGeminiFormat(messages: LLMMessage[]): any[] {
    const contents: any[] = [];
    
    // Add system instruction as the first user message
    const systemPrompt = "You are a helpful customer service assistant for Gallo Connect, an e-commerce platform. " +
      "Provide helpful, friendly, and accurate responses to customer inquiries about products, orders, " +
      "shipping, returns, and general support. Keep responses concise but informative.";
    
    contents.push({
      role: "user",
      parts: [{ text: systemPrompt }]
    });
    
    contents.push({
      role: "model",
      parts: [{ text: "I understand. I'm here to help customers with their Gallo Connect inquiries." }]
    });

    // Convert conversation messages
    messages.forEach(message => {
      if (message.role === 'user') {
        contents.push({
          role: "user",
          parts: [{ text: message.content }]
        });
      } else if (message.role === 'assistant') {
        contents.push({
          role: "model",
          parts: [{ text: message.content }]
        });
      }
    });

    return contents;
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Google Gemini API request failed';
    
    if (error.status === 400) {
      errorMessage = 'Invalid request to Gemini API. Please check your input.';
    } else if (error.status === 401 || error.status === 403) {
      errorMessage = 'Gemini API key is invalid or unauthorized';
    } else if (error.status === 429) {
      errorMessage = 'Gemini API rate limit exceeded. Please try again later.';
    } else if (error.status === 500 || error.status === 503) {
      errorMessage = 'Gemini API is currently unavailable. Please try again later.';
    } else if (error.status === 0) {
      errorMessage = 'Unable to connect to Gemini API. Please check your internet connection.';
    }
    
    console.error('Gemini API Error:', error);
    return throwError(() => new Error(errorMessage));
  }
}
