import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ChatbotService, ChatbotState, ChatMessage } from './chatbot.service';
import { ChatbotConfigService } from './config/chatbot-config.service';

@Component({
  selector: 'app-chatbot',
  standalone: false,
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.scss'],
  animations: [
    trigger('chatboxAnimation', [
      state('closed', style({
        transform: 'translateY(100%)',
        opacity: 0
      })),
      state('open', style({
        transform: 'translateY(0)',
        opacity: 1
      })),
      transition('closed => open', [
        animate('300ms ease-out')
      ]),
      transition('open => closed', [
        animate('250ms ease-in')
      ])
    ]),
    trigger('fabAnimation', [
      state('visible', style({
        transform: 'scale(1)',
        opacity: 1
      })),
      state('hidden', style({
        transform: 'scale(0.8)',
        opacity: 0.8
      })),
      transition('visible <=> hidden', [
        animate('200ms ease-in-out')
      ])
    ]),
    trigger('messageAnimation', [
      transition(':enter', [
        style({ transform: 'translateY(20px)', opacity: 0 }),
        animate('200ms ease-out', style({ transform: 'translateY(0)', opacity: 1 }))
      ])
    ]),
    trigger('maximizeAnimation', [
      state('normal', style({
        width: '360px',
        height: '500px',
        bottom: '20px',
        right: '20px'
      })),
      state('maximized', style({
        width: '80vw',
        height: '80vh',
        bottom: '10vh',
        right: '10vw'
      })),
      transition('normal <=> maximized', [
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)')
      ])
    ]),
    trigger('typingAnimation', [
      transition(':enter', [
        style({ opacity: 0, transform: 'scale(0.8)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'scale(1)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'scale(0.8)' }))
      ])
    ])
  ]
})
export class ChatbotComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messageInput', { static: false }) messageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('messagesContainer', { static: false }) messagesContainer?: ElementRef<HTMLDivElement>;

  chatbotState: ChatbotState = {
    isOpen: false,
    messages: [],
    isTyping: false
  };
  currentMessage = '';
  showConfig = false;
  isMaximized = false;
  activeConfigTab: 'llm' | 'mcp' | 'debug' = 'llm';
  private destroy$ = new Subject<void>();
  private shouldScrollToBottom = false;

  constructor(
    private chatbotService: ChatbotService,
    private cdr: ChangeDetectorRef,
    private configService: ChatbotConfigService
  ) {}

  ngOnInit(): void {
    // Initialize currentMessage to ensure it's properly bound
    this.currentMessage = '';
    
    this.chatbotService.chatbotState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        const previousMessageCount = this.chatbotState?.messages?.length || 0;
        this.chatbotState = state;
        
        // Check if new message was added
        if (state.messages.length > previousMessageCount) {
          this.shouldScrollToBottom = true;
        }
        
        this.cdr.detectChanges();
      });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  public toggleChat(): void {
    this.chatbotService.toggleChat();
    
    // Focus input when opening chat
    if (!this.chatbotState.isOpen) {
      setTimeout(() => {
        this.focusInput();
      }, 350); // Wait for animation to complete
    }
  }

  public closeChat(): void {
    this.chatbotService.closeChat();
  }

  public sendMessage(): void {
    if (this.currentMessage?.trim()) {
      this.chatbotService.sendMessage(this.currentMessage.trim());
      this.currentMessage = '';
      this.cdr.detectChanges();
      
      // Also clear the input field directly
      setTimeout(() => {
        if (this.messageInput?.nativeElement) {
          this.messageInput.nativeElement.value = '';
        }
        this.focusInput();
      }, 10);
    }
  }

  public onInputChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.currentMessage = target.value;
    this.cdr.detectChanges();
  }

  public onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  public clearChat(): void {
    this.chatbotService.clearMessages();
  }

  public toggleConfig(): void {
    // Only allow config toggle in development mode
    if (this.configService.shouldShowConfigButton()) {
      this.showConfig = !this.showConfig;
    }
  }

  public shouldShowConfigButton(): boolean {
    return this.configService.shouldShowConfigButton();
  }

  public shouldShowLLMTab(): boolean {
    return this.configService.shouldShowLLMSettings();
  }

  public shouldShowMCPTab(): boolean {
    return this.configService.shouldShowMCPSettings();
  }

  public toggleMaximize(): void {
    this.isMaximized = !this.isMaximized;
    
    // Close config panel when maximizing to give more space for chat
    if (this.isMaximized) {
      this.showConfig = false;
    }
    
    // Trigger change detection to update the UI
    this.cdr.detectChanges();
    
    // Scroll to bottom after maximize state change
    setTimeout(() => {
      this.scrollToBottom();
    }, 300); // Wait for animation to complete
  }

  public get isSendDisabled(): boolean {
    return !this.currentMessage?.trim() || this.chatbotState.isTyping;
  }

  public getMessageClasses(message: ChatMessage): string {
    const baseClasses = 'message';
    const senderClass = message.sender === 'user' ? 'message-user' : 'message-bot';
    return `${baseClasses} ${senderClass}`;
  }

  public formatTimestamp(timestamp: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(timestamp);
  }

  private focusInput(): void {
    if (this.messageInput) {
      this.messageInput.nativeElement.focus();
    }
  }

  private scrollToBottom(): void {
    if (this.messagesContainer) {
      const container = this.messagesContainer.nativeElement;
      container.scrollTop = container.scrollHeight;
    }
  }

  public getFabAnimationState(): string {
    return this.chatbotState?.isOpen ? 'hidden' : 'visible';
  }

  public getChatboxAnimationState(): string {
    return this.chatbotState?.isOpen ? 'open' : 'closed';
  }

  public trackByMessageId(index: number, message: ChatMessage): string {
    return message.id;
  }

  public formatMessageText(text: string): string {
    // Enhanced text formatting for better readability
    return text
      // Convert bullet points to proper markdown
      .replace(/^• /gm, '- ')
      // Ensure proper line breaks for lists
      .replace(/\n•/g, '\n- ')
      // Format error messages
      .replace(/❌ Tool Error:/g, '\n**❌ Tool Error:**')
      // Format success messages  
      .replace(/✅ Tool Result:/g, '\n**✅ Tool Result:**')
      // Format resource indicators
      .replace(/📄 Resource:/g, '\n**📄 Resource:**')
      // Ensure proper spacing around headings
      .replace(/\n([#]{1,6})/g, '\n\n$1')
      // Clean up multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Get session information for debugging
   */
  getSessionInfo(): any {
    return this.chatbotService.getSessionInfo();
  }

  /**
   * Start a new conversation session
   */
  startNewSession(): void {
    this.chatbotService.startNewSession();
  }

  /**
   * Get MCP service health status
   */
  getMCPStatus(): any {
    return this.chatbotService.getMCPStatus();
  }

  /**
   * Force MCP reconnection
   */
  reconnectMCP(): void {
    this.chatbotService.reconnectMCP().subscribe(success => {
      console.log('MCP reconnection result:', success);
    });
  }

  /**
   * Get order flow status (for debugging)
   */
  getOrderFlowStatus(): any {
    return this.chatbotService.getOrderFlowStatus();
  }

  /**
   * Start order flow manually
   */
  startOrderFlow(): void {
    this.chatbotService.startOrderFlow();
  }

  /**
   * Cancel current order flow
   */
  cancelOrderFlow(): void {
    this.chatbotService.cancelOrderFlow();
  }
}
