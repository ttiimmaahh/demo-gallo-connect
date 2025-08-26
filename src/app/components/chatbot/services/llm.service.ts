import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, catchError, map, switchMap, timer, startWith, shareReplay } from 'rxjs';
import { LLMProvider, LLMMessage, LLMResponse, LLMConfig, LLMFunctionDefinition, LLMToolCall } from '../providers/llm-provider.interface';
import { LocalLLMProvider } from '../providers/local-llm.provider';
import { OpenAIProvider } from '../providers/openai.provider';
import { GeminiProvider } from '../providers/gemini.provider';
import { MCPSDKService } from '../mcp/mcp-sdk.service';
import { MCPToolCall, MCPToolResult } from '../mcp/mcp-server.interface';
import { ChatbotConfigService } from '../config/chatbot-config.service';
import { SiteContextParamsService } from '@spartacus/core';


export type LLMProviderType = 'local' | 'openai' | 'gemini' | 'fallback';

export interface LLMServiceConfig {
  primaryProvider: LLMProviderType;
  fallbackProvider?: LLMProviderType;
  enableFallback: boolean;
  providers: {
    [key in LLMProviderType]?: LLMConfig;
  };
}

@Injectable({
  providedIn: 'root'
})
export class LLMService {
  private providers: Map<LLMProviderType, LLMProvider> = new Map();
  private currentProviderSubject = new BehaviorSubject<LLMProviderType>('fallback');
  private configSubject = new BehaviorSubject<LLMServiceConfig | null>(null);
  
  // Cache for provider availability checks to prevent loops
  private availabilityCache = new Map<LLMProviderType, { available: boolean; lastCheck: number; observable?: Observable<boolean> }>();
  private readonly CACHE_DURATION = 30000; // 30 seconds
  private readonly LOG_PREFIX = '[LLMService]';
  private isInitialized = false;

  // System prompt for grounding the LLM
  private readonly SYSTEM_PROMPT = `You are a helpful AI assistant for Gallo Connect, a modern SAP Commerce (Spartacus) based e-commerce platform. You are knowledgeable, professional, and focused on helping customers with their shopping and account needs.

**Your Role & Personality:**
- You are the official Gallo Connect AI shopping assistant
- Be helpful, friendly, and professional
- Provide accurate information about products, orders, and services
- When you don't know something specific, acknowledge it and offer alternative ways to help
- Always prioritize customer satisfaction and security

**Your Capabilities:**
- Access real-time product information from the SAP Commerce backend
- Retrieve order status and history for authenticated users
- Provide shipping and delivery information
- Help with account management (when user is logged in)
- Assist with product recommendations and comparisons
- Guide users through the shopping process
- Answer questions about policies (returns, shipping, etc.)

**Important Guidelines:**
- Always verify user authentication before accessing personal data (orders, account info)
- Never share or request sensitive information like passwords or payment details
- If you encounter errors or cannot access information, explain clearly and offer alternatives
- Use the available tools to get real-time data rather than making assumptions
- Format responses clearly with bullet points, lists, or structured information when helpful
- Keep responses conversational but informative
- When providing links to the user, make sure to include the full URL in the response.  The tools may return a URL, but it may not be the full URL.  You can use the baseSiteUrl to construct the full URL.  If providing links to products, you can simply create a "View Product" link that will open the product page in a new tab using the constructed URL.

**Order Placement Process:**
When a user wants to place an order, follow this structured 4-step process to collect all required information:

**Step 1 - Payment Information:**
- Ask for payment type: "Account" or "Credit Card"
- Ask for purchase order number (optional): "Would you like to add a purchase order number for this order?"
- If user says Account payment, proceed to Step 2
- If user says Credit Card, inform them that credit card processing will be handled during checkout

**Step 2 - Shipping Address:**
- Use "get-organization-addresses" tool to retrieve saved addresses for the organization
- Present options: "Please select a shipping address" with numbered list of saved addresses, or "Would you like to use a saved address or enter a new one?"
- If user wants new address, collect: street, city, state/province, postal code, country
- If no saved addresses available, collect new address information

**Step 3 - Delivery Mode:**
- Use "get-delivery-modes" tool to retrieve available delivery options
- Present options: "Please select your preferred delivery method" with numbered list showing delivery modes and any associated costs
- Common options are usually "Standard" and "Premium" delivery

**Step 4 - Order Confirmation:**
- Summarize all collected information: payment method, PO number (if provided), shipping address, delivery mode
- Ask for final confirmation: "I have all the information needed. Shall I proceed to place your order?"
- Only call the place order tool after receiving explicit confirmation

**Important Order Flow Rules:**
- Always collect information in this exact order (Payment → Address → Delivery → Confirmation)
- Don't skip steps even if user provides information out of order - confirm each step
- If user provides information for multiple steps at once, acknowledge it but still walk through each step for confirmation
- Use available tools to provide real options rather than asking open-ended questions
- If any step fails or user changes their mind, restart from that step

**Terms and Conditions Handling:**
- If a place order operation fails due to terms and conditions requirements, ask the user if they agree to the terms
- When the user responds with "yes", "I agree", "accept", or similar affirmative responses, retry the place order tool with "termsChecked": true parameter
- When the user responds with "no", "decline", or similar negative responses, inform them that the order cannot be placed without accepting the terms
- Always be clear about what terms they are agreeing to if that information is available from the error response

**Context Information:**
- You have access to the current user's site context and authentication status
- You can search products, check inventory, create carts, place orders, and retrieve order information through integrated tools
- The current site is powered by SAP Commerce Cloud with Spartacus storefront
- Base site: {{baseSite}}
- Current URL: {{baseSiteUrl}}
- The current site is a B2B site so when using tools, you need to make sure that the B2B versions of tools are used.  For example, if you need to create a cart, you need to use the B2B create cart tool.
- ONLY use the B2B tools.  Do not use the B2C tools.

Remember: Always aim to solve the customer's needs efficiently while maintaining a positive, helpful tone. If you need to use tools to get information, explain what you're doing so the user understands the process.`;

  // Enhanced conversation history management
  private conversationHistory = new Map<string, LLMMessage[]>();
  private readonly MAX_CONVERSATION_LENGTH = 20; // Keep last 20 messages for context
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes

  // Context tracking for special scenarios
  private sessionContext = new Map<string, {
    pendingOrderOperation?: {
      originalToolCall: any;
      waitingForTermsAcceptance: boolean;
      termsMessage?: string;
    };
    orderFlow?: {
      isActive: boolean;
      currentStep: 'payment' | 'address' | 'delivery' | 'confirmation' | 'complete';
      collectedData: {
        paymentType?: 'Account' | 'Credit Card';
        purchaseOrderNumber?: string;
        shippingAddress?: {
          id?: string;
          street?: string;
          city?: string;
          state?: string;
          postalCode?: string;
          country?: string;
          isNew?: boolean;
        };
        deliveryMode?: {
          code: string;
          name: string;
          cost?: string;
        };
      };
      availableOptions?: {
        addresses?: any[];
        deliveryModes?: any[];
      };
    };
  }>();

  public currentProvider$ = this.currentProviderSubject.asObservable();
  public config$ = this.configSubject.asObservable();

  constructor(
    private localProvider: LocalLLMProvider,
    private openaiProvider: OpenAIProvider,
    private geminiProvider: GeminiProvider,
    private mcpService: MCPSDKService,
    private configService: ChatbotConfigService,
    private siteContextParamsService: SiteContextParamsService
  ) {
    console.log(`${this.LOG_PREFIX} Initializing LLM service...`);
    if (!this.isInitialized) {
      this.initializeProviders();
      this.initializeConfiguration();
      this.initializeMCPServers();
      this.isInitialized = true;
      console.log(`${this.LOG_PREFIX} LLM service initialization completed`);
    } else {
      console.log(`${this.LOG_PREFIX} LLM service already initialized, skipping`);
    }
  }

  private initializeProviders(): void {
    console.log(`${this.LOG_PREFIX} Initializing LLM providers...`);
    this.providers.set('local', this.localProvider);
    this.providers.set('openai', this.openaiProvider);
    this.providers.set('gemini', this.geminiProvider);
    console.log(`${this.LOG_PREFIX} Providers initialized:`, Array.from(this.providers.keys()));
  }

  private initializeConfiguration(): void {
    // Load configuration from the centralized config service
    const centralConfig = this.configService.getLLMConfiguration();
    console.log(`${this.LOG_PREFIX} Loading configuration from chatbot-config service:`, centralConfig);
    this.configSubject.next(centralConfig);
    
    // Configure providers with the loaded configuration
    this.configureProviders();
    
    // Set forced provider if in production mode
    const forcedProvider = this.configService.getForcedLLMProvider();
    console.log(`${this.LOG_PREFIX} Forced provider from config service:`, forcedProvider);
    
    if (forcedProvider && (forcedProvider === 'local' || forcedProvider === 'openai' || forcedProvider === 'gemini' || forcedProvider === 'fallback')) {
      console.log(`${this.LOG_PREFIX} Using forced provider:`, forcedProvider);
      this.currentProviderSubject.next(forcedProvider);
    } else {
      console.log(`${this.LOG_PREFIX} Auto-selecting provider...`);
      this.autoSelectProvider();
    }
  }

  private initializeMCPServers(): void {
    console.log(`${this.LOG_PREFIX} Initializing MCP server...`);
    
    // Get MCP configuration from config service
    const mcpConfig = this.configService.getPredefinedMCPServers();
    
    if (mcpConfig && mcpConfig.length > 0) {
      // Use the first configured server for simplicity
      const serverConfig = mcpConfig[0];
      console.log(`${this.LOG_PREFIX} Configuring MCP server:`, serverConfig.name);
      
      // Configure the simplified MCP service
      this.mcpService.configureServer(serverConfig);
      
      // Initialize connection asynchronously
      this.mcpService.initializeConnection().then(success => {
        if (success) {
          console.log(`${this.LOG_PREFIX} MCP server initialized successfully`);
        } else {
          console.warn(`${this.LOG_PREFIX} MCP server initialization failed`);
        }
      }).catch(error => {
        console.error(`${this.LOG_PREFIX} MCP server initialization error:`, error);
      });
    } else {
      console.warn(`${this.LOG_PREFIX} No MCP servers configured`);
    }
  }

  public updateConfig(config: Partial<LLMServiceConfig>): void {
    const currentConfig = this.configSubject.value;
    if (!currentConfig) {
      console.warn('Cannot update config before initialization');
      return;
    }
    
    const newConfig = { ...currentConfig, ...config };
    this.configSubject.next(newConfig);
    this.configureProviders();
    
    if (config.primaryProvider) {
      this.switchProvider(config.primaryProvider);
    }
  }

  public switchProvider(providerType: LLMProviderType): Observable<boolean> {
    console.log(`${this.LOG_PREFIX} Attempting to switch to provider:`, providerType);
    
    if (providerType === 'fallback') {
      console.log(`${this.LOG_PREFIX} Switching to fallback provider`);
      this.currentProviderSubject.next('fallback');
      return of(true);
    }

    const provider = this.providers.get(providerType);
    if (!provider) {
      console.warn(`${this.LOG_PREFIX} Provider ${providerType} not found`);
      return of(false);
    }

    return this.checkProviderAvailabilityWithCache(providerType).pipe(
      map(available => {
        if (available) {
          this.currentProviderSubject.next(providerType);
          console.log(`${this.LOG_PREFIX} Successfully switched to ${provider.name} provider`);
        } else {
          console.warn(`${this.LOG_PREFIX} Provider ${providerType} is not available`);
        }
        return available;
      }),
      catchError((error) => {
        console.error(`${this.LOG_PREFIX} Failed to check availability for ${providerType}:`, error);
        return of(false);
      })
    );
  }

  /**
   * Check provider availability with caching to prevent repeated network calls
   */
  private checkProviderAvailabilityWithCache(providerType: LLMProviderType): Observable<boolean> {
    const cached = this.availabilityCache.get(providerType);
    const now = Date.now();
    
    // Return cached result if it's fresh
    if (cached && (now - cached.lastCheck) < this.CACHE_DURATION) {
      console.log(`${this.LOG_PREFIX} Using cached availability for ${providerType}:`, cached.available);
      return of(cached.available);
    }

    // If there's an ongoing check, return that observable
    if (cached?.observable) {
      console.log(`${this.LOG_PREFIX} Reusing ongoing availability check for ${providerType}`);
      return cached.observable;
    }

    console.log(`${this.LOG_PREFIX} Performing fresh availability check for ${providerType}`);
    const provider = this.providers.get(providerType);
    if (!provider) {
      return of(false);
    }

    // Create a shared observable for the availability check
    const availabilityObs = provider.isAvailable().pipe(
      map(available => {
        console.log(`${this.LOG_PREFIX} Availability check result for ${providerType}:`, available);
        // Cache the result
        this.availabilityCache.set(providerType, {
          available,
          lastCheck: Date.now(),
          observable: undefined // Clear the ongoing observable
        });
        return available;
      }),
      catchError((error) => {
        console.error(`${this.LOG_PREFIX} Error checking availability for ${providerType}:`, error);
        // Cache negative result
        this.availabilityCache.set(providerType, {
          available: false,
          lastCheck: Date.now(),
          observable: undefined
        });
        return of(false);
      }),
      shareReplay(1)
    );

    // Cache the ongoing observable
    this.availabilityCache.set(providerType, {
      available: false, // Temporary value
      lastCheck: now,
      observable: availabilityObs
    });

    return availabilityObs;
  }

  /**
   * Clear the availability cache for all providers
   */
  public clearAvailabilityCache(): void {
    console.log(`${this.LOG_PREFIX} Clearing availability cache`);
    this.availabilityCache.clear();
  }

  /**
   * Clear the availability cache for a specific provider
   */
  public clearProviderAvailabilityCache(providerType: LLMProviderType): void {
    console.log(`${this.LOG_PREFIX} Clearing availability cache for ${providerType}`);
    this.availabilityCache.delete(providerType);
  }

  /**
   * Generate session ID for conversation tracking
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get or create conversation history for a session
   */
  private getConversationHistory(sessionId: string): LLMMessage[] {
    if (!this.conversationHistory.has(sessionId)) {
      this.conversationHistory.set(sessionId, []);
    }
    return this.conversationHistory.get(sessionId)!;
  }

  /**
   * Add message to conversation history
   */
  private addToConversationHistory(sessionId: string, message: LLMMessage): void {
    const history = this.getConversationHistory(sessionId);
    history.push(message);
    
    // Trim history if it gets too long, but preserve system message
    if (history.length > this.MAX_CONVERSATION_LENGTH) {
      const systemMessage = history.find(msg => msg.role === 'system');
      const recentMessages = history.slice(-this.MAX_CONVERSATION_LENGTH + 1);
      
      this.conversationHistory.set(sessionId, systemMessage ? [systemMessage, ...recentMessages] : recentMessages);
    }
  }

  /**
   * Clear conversation history for a session
   */
  public clearConversationHistory(sessionId: string): void {
    console.log(`${this.LOG_PREFIX} Clearing conversation history for session:`, sessionId);
    this.conversationHistory.delete(sessionId);
    this.sessionContext.delete(sessionId); // Also clear session context including order flow
  }

  /**
   * Set pending order operation context
   */
  private setPendingOrderContext(sessionId: string, toolCall: any, termsMessage?: string): void {
    if (!this.sessionContext.has(sessionId)) {
      this.sessionContext.set(sessionId, {});
    }
    const context = this.sessionContext.get(sessionId)!;
    context.pendingOrderOperation = {
      originalToolCall: toolCall,
      waitingForTermsAcceptance: true,
      termsMessage
    };
    console.log(`${this.LOG_PREFIX} Set pending order context for session:`, sessionId);
  }

  /**
   * Check if session is waiting for terms acceptance
   */
  private isWaitingForTermsAcceptance(sessionId: string): boolean {
    const context = this.sessionContext.get(sessionId);
    return context?.pendingOrderOperation?.waitingForTermsAcceptance ?? false;
  }

  /**
   * Clear pending order context
   */
  private clearPendingOrderContext(sessionId: string): void {
    const context = this.sessionContext.get(sessionId);
    if (context?.pendingOrderOperation) {
      delete context.pendingOrderOperation;
      console.log(`${this.LOG_PREFIX} Cleared pending order context for session:`, sessionId);
    }
  }

  /**
   * Initialize order flow for a session
   */
  private initializeOrderFlow(sessionId: string): void {
    if (!this.sessionContext.has(sessionId)) {
      this.sessionContext.set(sessionId, {});
    }
    const context = this.sessionContext.get(sessionId)!;
    context.orderFlow = {
      isActive: true,
      currentStep: 'payment',
      collectedData: {},
      availableOptions: {}
    };
    console.log(`${this.LOG_PREFIX} Initialized order flow for session:`, sessionId);
  }

  /**
   * Check if session has active order flow
   */
  private hasActiveOrderFlow(sessionId: string): boolean {
    const context = this.sessionContext.get(sessionId);
    return context?.orderFlow?.isActive ?? false;
  }

  /**
   * Get current order flow step
   */
  private getCurrentOrderStep(sessionId: string): string | null {
    const context = this.sessionContext.get(sessionId);
    return context?.orderFlow?.currentStep ?? null;
  }

  /**
   * Advance order flow to next step
   */
  private advanceOrderStep(sessionId: string): void {
    const context = this.sessionContext.get(sessionId);
    if (!context?.orderFlow) return;

    const stepOrder: Array<'payment' | 'address' | 'delivery' | 'confirmation' | 'complete'> = 
      ['payment', 'address', 'delivery', 'confirmation', 'complete'];
    
    const currentIndex = stepOrder.indexOf(context.orderFlow.currentStep);
    if (currentIndex >= 0 && currentIndex < stepOrder.length - 1) {
      context.orderFlow.currentStep = stepOrder[currentIndex + 1];
      console.log(`${this.LOG_PREFIX} Advanced order flow to step:`, context.orderFlow.currentStep);
    }
  }

  /**
   * Update order flow data
   */
  private updateOrderFlowData(sessionId: string, data: Partial<any>): void {
    const context = this.sessionContext.get(sessionId);
    if (!context?.orderFlow) return;

    context.orderFlow.collectedData = {
      ...context.orderFlow.collectedData,
      ...data
    };
    console.log(`${this.LOG_PREFIX} Updated order flow data:`, data);
  }

  /**
   * Clear order flow for a session
   */
  private clearOrderFlow(sessionId: string): void {
    const context = this.sessionContext.get(sessionId);
    if (context?.orderFlow) {
      delete context.orderFlow;
      console.log(`${this.LOG_PREFIX} Cleared order flow for session:`, sessionId);
    }
  }

  /**
   * Get order flow summary
   */
  private getOrderFlowSummary(sessionId: string): any {
    const context = this.sessionContext.get(sessionId);
    return {
      isActive: context?.orderFlow?.isActive ?? false,
      currentStep: context?.orderFlow?.currentStep ?? null,
      collectedData: context?.orderFlow?.collectedData ?? {},
      availableOptions: context?.orderFlow?.availableOptions ?? {}
    };
  }

  /**
   * Create system prompt with dynamic context
   */
  private createSystemPrompt(): LLMMessage {
    const currentBaseSite = this.siteContextParamsService.getValue('baseSite') || 'unknown';
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
    
    const contextualizedPrompt = this.SYSTEM_PROMPT
      .replace('{{baseSite}}', currentBaseSite)
      .replace('{{baseSiteUrl}}', currentOrigin);
    
    return {
      role: 'system',
      content: contextualizedPrompt,
      timestamp: new Date()
    };
  }

  public generateResponse(userMessage: string, conversationHistory: LLMMessage[] = []): Observable<string> {
    console.log(`${this.LOG_PREFIX} Generating response for message:`, userMessage.substring(0, 50) + '...');
    
    const config = this.configSubject.value;
    if (!config) {
      console.warn(`${this.LOG_PREFIX} LLM service not initialized, using fallback`);
      return of(this.getFallbackResponse(userMessage));
    }

    // Create messages with system prompt and conversation history
    const systemPrompt = this.createSystemPrompt();
    const userMsg: LLMMessage = { role: 'user', content: userMessage, timestamp: new Date() };
    
    const messages: LLMMessage[] = [
      systemPrompt,
      ...conversationHistory,
      userMsg
    ];

    const currentProvider = this.currentProviderSubject.value;
    
    if (currentProvider === 'fallback') {
      return of(this.getFallbackResponse(userMessage));
    }

    const provider = this.providers.get(currentProvider);
    if (!provider) {
      return of(this.getFallbackResponse(userMessage));
    }

    // Check MCP service health and re-initialize if needed
    return this.ensureMCPConnection().pipe(
      switchMap(() => {
        console.log(`${this.LOG_PREFIX} Getting MCP tools for LLM request...`);
        console.log(`${this.LOG_PREFIX} MCP service ready:`, this.mcpService.isReady());
        
        return this.mcpService.getToolsForLLM().pipe(
          switchMap(mcpTools => {
            console.log(`${this.LOG_PREFIX} Available MCP tools for LLM:`, {
              toolsCount: mcpTools?.length || 0,
              tools: mcpTools?.map(t => t.function.name) || [],
              mcpReady: this.mcpService.isReady()
            });
            
            return provider.generateResponse(messages, undefined, mcpTools).pipe(
              switchMap(response => this.handleLLMResponse(response, messages)),
              catchError(error => {
                console.error(`${provider.name} failed:`, error);
                
                // Try fallback if enabled
                if (config.enableFallback && config.fallbackProvider && config.fallbackProvider !== currentProvider) {
                  console.log('Attempting fallback provider...');
                  return this.tryFallbackProvider(messages, config.fallbackProvider);
                }
                
                return of(this.getFallbackResponse(userMessage, error.message));
              })
            );
          })
        );
      }),
      catchError(error => {
        console.error(`${this.LOG_PREFIX} MCP connection check/initialization failed:`, error);
        // Continue without MCP tools if connection fails
        return provider.generateResponse(messages, undefined, []).pipe(
          switchMap(response => this.handleLLMResponse(response, messages)),
          catchError(providerError => {
            console.error(`${provider.name} failed after MCP failure:`, providerError);
            return of(this.getFallbackResponse(userMessage, `${error.message}; ${providerError.message}`));
          })
        );
      })
    );
  }

  private handleLLMResponse(response: LLMResponse, messages: LLMMessage[]): Observable<string> {
    console.log(`${this.LOG_PREFIX} Handling LLM response:`, {
      hasContent: !!response.content,
      contentLength: response.content?.length || 0,
      hasToolCalls: !!response.tool_calls,
      toolCallsCount: response.tool_calls?.length || 0,
      toolCalls: response.tool_calls?.map(tc => tc.function.name) || [],
      fullResponse: response
    });

    // If the response contains tool calls, execute them
    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`${this.LOG_PREFIX} Executing ${response.tool_calls.length} tool calls...`);
      return this.executeToolCalls(response.tool_calls, messages, response);
    }
    
    // Otherwise, return the content directly
    console.log(`${this.LOG_PREFIX} No tool calls found, returning content directly`);
    return of(response.content);
  }

  private executeToolCalls(toolCalls: LLMToolCall[], messages: LLMMessage[], originalResponse: LLMResponse): Observable<string> {
    // Add the assistant's message with tool calls to conversation
    const assistantMessage: LLMMessage = {
      role: 'assistant',
      content: originalResponse.content || '',
      tool_calls: toolCalls,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, assistantMessage];

    // Execute all tool calls
    const toolExecutions = toolCalls.map(toolCall => {
      return this.executeMCPTool(toolCall).pipe(
        map(result => ({
          role: 'tool' as const,
          content: this.formatToolResult(result),
          tool_call_id: toolCall.id,
          timestamp: new Date()
        })),
        catchError(error => {
          return of({
            role: 'tool' as const,
            content: `Error executing tool ${toolCall.function.name}: ${error.message}`,
            tool_call_id: toolCall.id,
            timestamp: new Date()
          });
        })
      );
    });

    // Wait for all tool executions to complete
    return new Observable(observer => {
      Promise.all(toolExecutions.map(obs => obs.toPromise())).then(toolResults => {
        // Filter out any undefined results and add tool results to conversation
        const validToolResults = toolResults.filter(result => result !== undefined);
        const messagesWithToolResults = [...updatedMessages, ...validToolResults];
        
        // Get another LLM response with the tool results
        const currentProvider = this.currentProviderSubject.value;
        const provider = this.providers.get(currentProvider);
        
        if (!provider) {
          observer.next('Tool execution completed, but unable to generate follow-up response.');
          observer.complete();
          return;
        }

        provider.generateResponse(messagesWithToolResults).subscribe({
          next: (followupResponse) => {
            observer.next(followupResponse.content);
            observer.complete();
          },
          error: (error) => {
            observer.next(`Tools executed successfully, but follow-up response failed: ${error.message}`);
            observer.complete();
          }
        });
      }).catch(error => {
        observer.next(`Tool execution failed: ${error.message}`);
        observer.complete();
      });
    });
  }

  private executeMCPTool(toolCall: LLMToolCall): Observable<MCPToolResult> {
    try {
      console.log(`${this.LOG_PREFIX} Executing MCP tool:`, toolCall.function.name);
      
      // Extract tool name (remove mcp_ prefix)
      const functionName = toolCall.function.name;
      const mcpPrefix = 'mcp_';
      
      if (!functionName.startsWith(mcpPrefix)) {
        throw new Error(`Invalid MCP function name: ${functionName}`);
      }
      
      const originalName = functionName.substring(mcpPrefix.length);
      
      // Parse arguments
      let args: Record<string, any>;
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        args = {};
      }
      console.log(`${this.LOG_PREFIX} MCP tool call arguments:`, args);

      // Automatically inject current basesite from Spartacus configuration
      const currentBaseSite = this.siteContextParamsService.getValue('baseSite');
      console.log(`${this.LOG_PREFIX} Current basesite: ${currentBaseSite}`);

      if (currentBaseSite) {
        args['baseSiteId'] = currentBaseSite;
        console.log(`${this.LOG_PREFIX} Auto-injected basesite: ${currentBaseSite}`);
      }

      const mcpToolCall: MCPToolCall = {
        name: originalName,
        arguments: args,
        serverId: 'default' // Using default since we have simplified to single server
      };

      // Ensure MCP connection is healthy before executing tool
      return this.ensureMCPConnection().pipe(
        switchMap(connectionHealthy => {
          if (!connectionHealthy) {
            throw new Error('MCP connection could not be established');
          }
          
          return new Observable<MCPToolResult>(observer => {
            this.mcpService.callTool(mcpToolCall).then(result => {
              console.log(`${this.LOG_PREFIX} MCP tool execution result:`, result);
              
              // Check if this is a terms and conditions error for place order operations
              if (result.isError && originalName.includes('place-order')) {
                const errorText = result.content.map(c => c.text).join(' ').toLowerCase();
                if (errorText.includes('terms') && errorText.includes('condition')) {
                  console.log(`${this.LOG_PREFIX} Detected terms and conditions error, setting pending context`);
                  // Note: We need sessionId here, but it's not available in this method
                  // The enhanced system prompt will handle this case instead
                }
              }
              
              observer.next(result);
              observer.complete();
            }).catch(error => {
              console.error(`${this.LOG_PREFIX} MCP tool execution failed:`, error);
              observer.error(error);
            });
          });
        }),
        catchError(error => {
          console.error(`${this.LOG_PREFIX} MCP tool execution failed due to connection issues:`, error);
          return new Observable<MCPToolResult>(observer => {
            observer.error(error);
          });
        })
      );
    } catch (error) {
      console.error(`${this.LOG_PREFIX} Error preparing MCP tool call:`, error);
      return new Observable(observer => {
        observer.error(error);
      });
    }
  }

  private formatToolResult(result: MCPToolResult): string {
    if (result.isError) {
      return `❌ Tool Error: ${result.content.map(c => c.text).join('\n')}`;
    }
    
    if (!result.content || result.content.length === 0) {
      return '✅ Tool executed successfully (no output)';
    }
    
    const formattedContent = result.content.map(content => {
      switch (content.type) {
        case 'text':
          return content.text || '';
        case 'resource':
        case 'resource_link':
          return `📄 Resource: ${content.name || content.uri || 'Unknown'}\n${content.text || content.description || ''}`;
        default:
          // Try to format JSON nicely
          try {
            const parsed = typeof content === 'string' ? JSON.parse(content) : content;
            return JSON.stringify(parsed, null, 2);
          } catch {
            return JSON.stringify(content);
          }
      }
    }).join('\n\n');
    
    return `✅ Tool Result:\n${formattedContent}`;
  }

  public getProviderStatus(): Observable<{ [key: string]: any }> {
    const statusPromises = Array.from(this.providers.entries()).map(([type, provider]) => 
      provider.getHealthStatus().pipe(
        map(status => ({ [type]: { ...status, name: provider.name, type: provider.type } })),
        catchError(() => of({ [type]: { status: 'unknown', name: provider.name, type: provider.type } }))
      )
    );

    return new Observable(observer => {
      Promise.all(statusPromises.map(obs => 
        new Promise<any>(resolve => {
          obs.subscribe({
            next: (result) => resolve(result),
            error: () => resolve({})
          });
        })
      )).then((results: any[]) => {
        const combined: { [key: string]: any } = results.reduce((acc, result) => ({ ...acc, ...result }), {});
        observer.next(combined);
        observer.complete();
      });
    });
  }

  private autoSelectProvider(): void {
    const config = this.configSubject.value;
    if (!config) {
      console.warn(`${this.LOG_PREFIX} Cannot auto-select provider without configuration`);
      this.currentProviderSubject.next('fallback');
      return;
    }
    
    console.log(`${this.LOG_PREFIX} Auto-selecting provider, trying primary:`, config.primaryProvider);
    
    // Try primary provider first
    this.switchProvider(config.primaryProvider).pipe(
      switchMap(success => {
        if (success) {
          console.log(`${this.LOG_PREFIX} Primary provider ${config.primaryProvider} selected successfully`);
          return of(true);
        }
        
        // Try fallback if primary fails
        if (config.enableFallback && config.fallbackProvider) {
          console.log(`${this.LOG_PREFIX} Primary failed, trying fallback provider:`, config.fallbackProvider);
          return this.switchProvider(config.fallbackProvider);
        }
        
        console.log(`${this.LOG_PREFIX} No fallback provider configured`);
        return of(false);
      })
    ).subscribe(success => {
      if (!success) {
        console.warn(`${this.LOG_PREFIX} No LLM providers available, using fallback responses`);
        this.currentProviderSubject.next('fallback');
      }
    });
  }

  private configureProviders(): void {
    const config = this.configSubject.value;
    if (!config) {
      console.warn('Cannot configure providers without configuration');
      return;
    }
    
    this.providers.forEach((provider, type) => {
      const providerConfig = config.providers[type];
      if (providerConfig) {
        provider.configure(providerConfig);
      }
    });
  }

  private tryFallbackProvider(messages: LLMMessage[], fallbackType: LLMProviderType): Observable<string> {
    if (fallbackType === 'fallback') {
      return of(this.getFallbackResponse(messages[messages.length - 1]?.content || ''));
    }

    const fallbackProvider = this.providers.get(fallbackType);
    if (!fallbackProvider) {
      return of(this.getFallbackResponse(messages[messages.length - 1]?.content || ''));
    }

    return fallbackProvider.generateResponse(messages).pipe(
      map(response => response.content),
      catchError(() => of(this.getFallbackResponse(messages[messages.length - 1]?.content || '')))
    );
  }

  private getFallbackResponse(userMessage: string, error?: string): string {
    const message = userMessage.toLowerCase();
    
    // Enhanced rule-based responses with error context
    if (error) {
      return `I apologize, but I'm experiencing some technical difficulties with my AI assistant. However, I'm still here to help! You asked about "${userMessage}" - could you please rephrase your question or let me know how I can assist you?`;
    }
    
    if (message.includes('hello') || message.includes('hi')) {
      return 'Hello! Welcome to Gallo Connect. I\'m here to help you with any questions about our products, orders, or services. How can I assist you today?';
    }
    
    if (message.includes('help')) {
      return 'I\'m here to help! I can assist you with:\n• Product information and recommendations\n• Order status and tracking\n• Shipping and delivery questions\n• Returns and exchanges\n• Account support\n\nWhat would you like to know more about?';
    }
    
    if (message.includes('product') || message.includes('item') || message.includes('buy')) {
      return 'I\'d be happy to help you find the perfect product! You can browse our full catalog on the website, or tell me what specific type of item you\'re looking for and I\'ll guide you in the right direction.';
    }
    
    if (message.includes('order') || message.includes('shipping') || message.includes('delivery')) {
      return 'For order-related inquiries, you can check your order status in your account dashboard. If you need help tracking a shipment or have questions about delivery times, I can guide you through the process. What specific information do you need?';
    }
    
    if (message.includes('return') || message.includes('refund') || message.includes('exchange')) {
      return 'Our return policy allows returns within 30 days of purchase. I can help you start a return request or answer any questions about our return process. Would you like me to guide you through the steps?';
    }
    
    if (message.includes('contact') || message.includes('support') || message.includes('phone')) {
      return 'You can reach our customer support team at:\n• Email: support@galloconnect.com\n• Phone: 1-800-GALLO-1\n• Hours: Monday-Friday 9AM-6PM EST\n\nOr I can try to help you right here! What do you need assistance with?';
    }
    
    if (message.includes('bye') || message.includes('goodbye') || message.includes('thanks')) {
      return 'Thank you for choosing Gallo Connect! Have a wonderful day, and don\'t hesitate to reach out if you need any more assistance.';
    }
    
    // Default response
    return 'Thank you for your question! While I\'m working to understand your request better, I\'d be happy to help you find what you need. Could you provide a bit more detail about what you\'re looking for? You can also browse our website or contact our support team at support@galloconnect.com for immediate assistance.';
  }

  public getCurrentProviderName(): string {
    const currentType = this.currentProviderSubject.value;
    if (currentType === 'fallback') {
      return 'Built-in Assistant';
    }
    
    const provider = this.providers.get(currentType);
    return provider?.name || 'Unknown Provider';
  }

  public listAvailableProviders(): LLMProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Generate response with session-based conversation management
   */
  public generateResponseWithSession(userMessage: string, sessionId?: string): Observable<{response: string, sessionId: string}> {
    // Generate session ID if not provided
    if (!sessionId) {
      sessionId = this.generateSessionId();
      console.log(`${this.LOG_PREFIX} Generated new session ID:`, sessionId);
    }

    // Check if we're waiting for terms acceptance
    if (this.isWaitingForTermsAcceptance(sessionId)) {
      return this.handleTermsAcceptanceResponse(userMessage, sessionId);
    }

    // Check if user wants to start order process
    const userMessageLower = userMessage.toLowerCase();
    const orderKeywords = ['place order', 'place my order', 'checkout', 'complete order', 'finish order', 'buy now'];
    const isOrderRequest = orderKeywords.some(keyword => userMessageLower.includes(keyword));
    
    if (isOrderRequest && !this.hasActiveOrderFlow(sessionId)) {
      console.log(`${this.LOG_PREFIX} Detected order request, initializing order flow`);
      this.initializeOrderFlow(sessionId);
    }

    // Get conversation history for this session
    const conversationHistory = this.getConversationHistory(sessionId);
    console.log(`${this.LOG_PREFIX} Retrieved conversation history for session ${sessionId}:`, conversationHistory.length, 'messages');

    // Add user message to history
    const userMsg: LLMMessage = { role: 'user', content: userMessage, timestamp: new Date() };
    this.addToConversationHistory(sessionId, userMsg);

    // If we have active order flow, enhance system prompt with current step context
    let enhancedHistory = conversationHistory;
    if (this.hasActiveOrderFlow(sessionId)) {
      const orderContext = this.getOrderFlowSummary(sessionId);
      const orderContextMessage: LLMMessage = {
        role: 'system',
        content: `[ORDER FLOW CONTEXT] Current step: ${orderContext.currentStep}, Collected data: ${JSON.stringify(orderContext.collectedData)}, Available options: ${JSON.stringify(orderContext.availableOptions)}`,
        timestamp: new Date()
      };
      enhancedHistory = [...conversationHistory, orderContextMessage];
    }

    return this.generateResponse(userMessage, enhancedHistory).pipe(
      map(response => {
        // Add assistant response to history
        const assistantMsg: LLMMessage = { 
          role: 'assistant', 
          content: response, 
          timestamp: new Date() 
        };
        this.addToConversationHistory(sessionId!, assistantMsg);
        
        return { response, sessionId: sessionId! };
      }),
      catchError(error => {
        console.error(`${this.LOG_PREFIX} Error in session-based response generation:`, error);
        // Still add the error response to history for context
        const errorMsg: LLMMessage = { 
          role: 'assistant', 
          content: this.getFallbackResponse(userMessage, error.message), 
          timestamp: new Date() 
        };
        this.addToConversationHistory(sessionId!, errorMsg);
        
        return of({ response: this.getFallbackResponse(userMessage, error.message), sessionId: sessionId! });
      })
    );
  }

  /**
   * Handle user response when waiting for terms acceptance
   */
  private handleTermsAcceptanceResponse(userMessage: string, sessionId: string): Observable<{response: string, sessionId: string}> {
    const context = this.sessionContext.get(sessionId);
    const pendingOrder = context?.pendingOrderOperation;
    
    if (!pendingOrder) {
      console.warn(`${this.LOG_PREFIX} No pending order found for terms acceptance`);
      return this.generateResponseWithSession(userMessage, sessionId);
    }

    const userResponse = userMessage.toLowerCase().trim();
    const isAccepted = userResponse.includes('yes') || 
                      userResponse.includes('accept') || 
                      userResponse.includes('agree') || 
                      userResponse.includes('ok') ||
                      userResponse === 'y';

    if (isAccepted) {
      console.log(`${this.LOG_PREFIX} User accepted terms, retrying order with termsChecked: true`);
      
      // Clear the pending context
      this.clearPendingOrderContext(sessionId);
      
      // Add user message to history
      const userMsg: LLMMessage = { role: 'user', content: userMessage, timestamp: new Date() };
      this.addToConversationHistory(sessionId, userMsg);

      // Retry the original tool call with terms accepted
      const modifiedToolCall = {
        ...pendingOrder.originalToolCall,
        function: {
          ...pendingOrder.originalToolCall.function,
          arguments: JSON.stringify({
            ...JSON.parse(pendingOrder.originalToolCall.function.arguments),
            termsChecked: true
          })
        }
      };

      return this.executeMCPTool(modifiedToolCall).pipe(
        map(result => {
          const response = this.formatToolResult(result);
          const assistantMsg: LLMMessage = { 
            role: 'assistant', 
            content: `Thank you for accepting the terms and conditions. ${response}`,
            timestamp: new Date() 
          };
          this.addToConversationHistory(sessionId, assistantMsg);
          
          return { response: assistantMsg.content, sessionId };
        }),
        catchError(error => {
          const errorResponse = `I've processed your acceptance of the terms, but encountered an error while placing the order: ${error.message}`;
          const errorMsg: LLMMessage = { 
            role: 'assistant', 
            content: errorResponse,
            timestamp: new Date() 
          };
          this.addToConversationHistory(sessionId, errorMsg);
          
          return of({ response: errorResponse, sessionId });
        })
      );
    } else {
      console.log(`${this.LOG_PREFIX} User declined terms`);
      
      // Clear the pending context
      this.clearPendingOrderContext(sessionId);
      
      // Add user message to history
      const userMsg: LLMMessage = { role: 'user', content: userMessage, timestamp: new Date() };
      this.addToConversationHistory(sessionId, userMsg);

      const response = "I understand you don't wish to accept the terms and conditions. Unfortunately, I cannot proceed with placing the order without your acceptance of the terms. Is there anything else I can help you with?";
      
      const assistantMsg: LLMMessage = { 
        role: 'assistant', 
        content: response,
        timestamp: new Date() 
      };
      this.addToConversationHistory(sessionId, assistantMsg);
      
      return of({ response, sessionId });
    }
  }

  /**
   * Get conversation summary for a session (useful for debugging)
   */
  public getConversationSummary(sessionId: string): {messageCount: number, systemPrompt: boolean, lastActivity: Date | null} {
    const history = this.conversationHistory.get(sessionId) || [];
    const systemPrompt = history.some(msg => msg.role === 'system');
    const lastActivity = history.length > 0 ? history[history.length - 1].timestamp || null : null;
    
    return {
      messageCount: history.length,
      systemPrompt,
      lastActivity
    };
  }

  /**
   * Clean up old conversation sessions
   */
  public cleanupOldSessions(): void {
    const now = Date.now();
    let cleaned = 0;
    
    this.conversationHistory.forEach((history, sessionId) => {
      const lastMessage = history[history.length - 1];
      if (lastMessage?.timestamp) {
        const age = now - lastMessage.timestamp.getTime();
        if (age > this.SESSION_TIMEOUT) {
          this.conversationHistory.delete(sessionId);
          cleaned++;
        }
      }
    });
    
    if (cleaned > 0) {
      console.log(`${this.LOG_PREFIX} Cleaned up ${cleaned} expired conversation sessions`);
    }
  }

  /**
   * Ensure MCP connection is healthy, re-initialize if needed
   */
  private ensureMCPConnection(): Observable<boolean> {
    console.log(`${this.LOG_PREFIX} Checking MCP connection health...`);
    
    // Check if MCP service is ready
    if (this.mcpService.isReady()) {
      console.log(`${this.LOG_PREFIX} MCP service is ready, proceeding with request`);
      return of(true);
    }
    
    console.warn(`${this.LOG_PREFIX} MCP service not ready, attempting re-initialization...`);
    
    return this.reinitializeMCPConnection();
  }

  /**
   * Re-initialize MCP connection
   */
  private reinitializeMCPConnection(): Observable<boolean> {
    return new Observable(observer => {
      // Get MCP configuration from config service
      const mcpConfig = this.configService.getPredefinedMCPServers();
      
      if (!mcpConfig || mcpConfig.length === 0) {
        console.error(`${this.LOG_PREFIX} No MCP servers configured for re-initialization`);
        observer.next(false);
        observer.complete();
        return;
      }
      
      // Use the first configured server
      const serverConfig = mcpConfig[0];
      console.log(`${this.LOG_PREFIX} Re-configuring MCP server:`, serverConfig.name);
      
      // Configure the server
      this.mcpService.configureServer(serverConfig);
      
      // Initialize connection asynchronously
      this.mcpService.initializeConnection().then(success => {
        if (success) {
          console.log(`${this.LOG_PREFIX} MCP server re-initialization successful`);
          observer.next(true);
        } else {
          console.error(`${this.LOG_PREFIX} MCP server re-initialization failed`);
          observer.next(false);
        }
        observer.complete();
      }).catch(error => {
        console.error(`${this.LOG_PREFIX} MCP server re-initialization error:`, error);
        observer.next(false);
        observer.complete();
      });
    });
  }

  /**
   * Check if MCP service is ready
   */
  public isMCPReady(): boolean {
    return this.mcpService.isReady();
  }

  /**
   * Get MCP service health information
   */
  public getMCPHealth(): any {
    try {
      return this.mcpService.healthCheck();
    } catch (error: any) {
      console.error(`${this.LOG_PREFIX} Error getting MCP health status:`, error);
      return { error: error?.message || 'Unknown error' };
    }
  }

  /**
   * Force MCP reconnection (public method for manual reconnection)
   */
  public forceMCPReconnection(): Observable<boolean> {
    console.log(`${this.LOG_PREFIX} Forcing MCP reconnection...`);
    return this.reinitializeMCPConnection();
  }

  /**
   * Get order flow status for a session (public method for debugging)
   */
  public getOrderFlowStatus(sessionId: string): any {
    return this.getOrderFlowSummary(sessionId);
  }

  /**
   * Start order flow for a session (public method)
   */
  public startOrderFlow(sessionId: string): void {
    this.initializeOrderFlow(sessionId);
  }

  /**
   * Cancel order flow for a session (public method)
   */
  public cancelOrderFlow(sessionId: string): void {
    this.clearOrderFlow(sessionId);
  }
}
