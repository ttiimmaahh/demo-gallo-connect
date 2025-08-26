import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LLMService } from './services/llm.service';
import { LLMMessage } from './providers/llm-provider.interface';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export interface ChatbotState {
  isOpen: boolean;
  messages: ChatMessage[];
  isTyping: boolean;
  sessionId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private chatbotStateSubject = new BehaviorSubject<ChatbotState>({
    isOpen: false,
    messages: [],
    isTyping: false,
    sessionId: undefined
  });

  public chatbotState$: Observable<ChatbotState> = this.chatbotStateSubject.asObservable();
  private readonly LOG_PREFIX = '[ChatbotService]';

  constructor(private llmService: LLMService) {
    this.initializeChat();
    
    // Set up periodic cleanup of old sessions
    setInterval(() => {
      this.llmService.cleanupOldSessions();
    }, 5 * 60 * 1000); // Clean up every 5 minutes
  }

  private initializeChat(): void {
    // Add welcome message
    const welcomeMessage: ChatMessage = {
      id: this.generateMessageId(),
      text: 'Hello! How can I help you today?',
      sender: 'bot',
      timestamp: new Date()
    };
    
    this.addMessage(welcomeMessage);
  }

  public toggleChat(): void {
    const currentState = this.chatbotStateSubject.value;
    this.updateState({
      ...currentState,
      isOpen: !currentState.isOpen
    });
  }

  public closeChat(): void {
    const currentState = this.chatbotStateSubject.value;
    this.updateState({
      ...currentState,
      isOpen: false
    });
  }

  public sendMessage(text: string): void {
    if (!text.trim()) {
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: this.generateMessageId(),
      text: text.trim(),
      sender: 'user',
      timestamp: new Date()
    };

    this.addMessage(userMessage);
    this.setTyping(true);

    // Simulate bot response delay
    setTimeout(() => {
      this.generateBotResponse(text.trim());
    }, 1000);
  }

  private addMessage(message: ChatMessage): void {
    const currentState = this.chatbotStateSubject.value;
    this.updateState({
      ...currentState,
      messages: [...currentState.messages, message]
    });
  }

  private setTyping(isTyping: boolean): void {
    const currentState = this.chatbotStateSubject.value;
    this.updateState({
      ...currentState,
      isTyping
    });
  }

  private updateState(newState: ChatbotState): void {
    this.chatbotStateSubject.next(newState);
  }

  private generateBotResponse(userMessage: string): void {
    const currentState = this.chatbotStateSubject.value;
    
    // Use session-based conversation management
    this.llmService.generateResponseWithSession(userMessage, currentState.sessionId).subscribe({
      next: (result) => {
        console.log(`${this.LOG_PREFIX} Generated response for session:`, result.sessionId);
        
        const botMessage: ChatMessage = {
          id: this.generateMessageId(),
          text: result.response,
          sender: 'bot',
          timestamp: new Date()
        };
        
        // Update session ID in state if it was generated
        if (!currentState.sessionId) {
          this.updateState({
            ...currentState,
            sessionId: result.sessionId,
            isTyping: false,
            messages: [...currentState.messages, botMessage]
          });
        } else {
          this.setTyping(false);
          this.addMessage(botMessage);
        }
      },
      error: (error) => {
        console.error(`${this.LOG_PREFIX} LLM Error:`, error);
        const errorMessage: ChatMessage = {
          id: this.generateMessageId(),
          text: 'I apologize, but I\'m having trouble processing your request right now. Please try again or contact our support team at support@galloconnect.com.',
          sender: 'bot',
          timestamp: new Date()
        };
        
        this.setTyping(false);
        this.addMessage(errorMessage);
      }
    });
  }

  private getConversationHistory(): LLMMessage[] {
    const currentState = this.chatbotStateSubject.value;
    return currentState.messages
      .filter(msg => msg.sender !== 'bot' || !msg.text.includes('Hello! How can I help you today?')) // Skip welcome message
      .map(msg => ({
        role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.text,
        timestamp: msg.timestamp
      }));
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public clearMessages(): void {
    const currentState = this.chatbotStateSubject.value;
    
    // Clear the session history in LLM service
    if (currentState.sessionId) {
      console.log(`${this.LOG_PREFIX} Clearing conversation history for session:`, currentState.sessionId);
      this.llmService.clearConversationHistory(currentState.sessionId);
    }
    
    // Reset the chatbot state with a new session
    this.updateState({
      ...currentState,
      messages: [],
      sessionId: undefined
    });
    this.initializeChat();
  }

  public getCurrentState(): ChatbotState {
    return this.chatbotStateSubject.value;
  }

  public getCurrentLLMProvider(): string {
    return this.llmService.getCurrentProviderName();
  }

  public switchLLMProvider(providerType: 'local' | 'openai' | 'gemini' | 'fallback'): Observable<boolean> {
    return this.llmService.switchProvider(providerType);
  }

  public updateLLMConfig(config: any): void {
    this.llmService.updateConfig(config);
  }

  public getLLMProviderStatus(): Observable<any> {
    return this.llmService.getProviderStatus();
  }

  /**
   * Get current session information (useful for debugging)
   */
  public getSessionInfo(): {sessionId: string | undefined, conversationSummary: any} {
    const currentState = this.chatbotStateSubject.value;
    const sessionId = currentState.sessionId;
    const conversationSummary = sessionId ? this.llmService.getConversationSummary(sessionId) : null;
    
    return {
      sessionId,
      conversationSummary
    };
  }

  /**
   * Start a new conversation session
   */
  public startNewSession(): void {
    console.log(`${this.LOG_PREFIX} Starting new conversation session`);
    this.clearMessages();
  }

  /**
   * Get MCP service health status
   */
  public getMCPStatus(): {isReady: boolean, health: any} {
    return {
      isReady: this.llmService.isMCPReady(),
      health: this.llmService.getMCPHealth()
    };
  }

  /**
   * Force MCP reconnection
   */
  public reconnectMCP(): Observable<boolean> {
    console.log(`${this.LOG_PREFIX} Forcing MCP reconnection`);
    return this.llmService.forceMCPReconnection();
  }

  /**
   * Get order flow status for current session
   */
  public getOrderFlowStatus(): any {
    const currentState = this.chatbotStateSubject.value;
    if (currentState.sessionId) {
      return this.llmService.getOrderFlowStatus(currentState.sessionId);
    }
    return { isActive: false, currentStep: null, collectedData: {}, availableOptions: {} };
  }

  /**
   * Start order flow for current session
   */
  public startOrderFlow(): void {
    const currentState = this.chatbotStateSubject.value;
    if (currentState.sessionId) {
      this.llmService.startOrderFlow(currentState.sessionId);
      console.log(`${this.LOG_PREFIX} Started order flow for session:`, currentState.sessionId);
    }
  }

  /**
   * Cancel order flow for current session
   */
  public cancelOrderFlow(): void {
    const currentState = this.chatbotStateSubject.value;
    if (currentState.sessionId) {
      this.llmService.cancelOrderFlow(currentState.sessionId);
      console.log(`${this.LOG_PREFIX} Cancelled order flow for session:`, currentState.sessionId);
    }
  }
}
