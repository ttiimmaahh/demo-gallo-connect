import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { MarkdownModule } from 'ngx-markdown';

import { ChatbotComponent } from './chatbot.component';
import { ChatbotConfigComponent } from './components/chatbot-config.component';
import { MCPConfigComponent } from './components/mcp-config.component';
import { DebugMCPComponent } from './debug-mcp.component';
import { ChatbotService } from './chatbot.service';
import { LLMService } from './services/llm.service';
import { MCPSDKService } from './mcp/mcp-sdk.service';
import { ChatbotConfigService } from './config/chatbot-config.service';
import { ChatbotInitializationService } from './services/chatbot-initialization.service';
import { LocalLLMProvider } from './providers/local-llm.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';

@NgModule({
  declarations: [
    ChatbotComponent,
    ChatbotConfigComponent,
    MCPConfigComponent,
    DebugMCPComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    MarkdownModule.forChild()
  ],
  providers: [
    ChatbotService,
    LLMService,
    MCPSDKService,
    ChatbotConfigService,
    ChatbotInitializationService,
    LocalLLMProvider,
    OpenAIProvider,
    GeminiProvider
  ],
  exports: [
    ChatbotComponent,
    ChatbotConfigComponent,
    MCPConfigComponent
  ]
})
export class ChatbotModule { }
