import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ChatbotService } from '../chatbot.service';
import { ChatbotConfigService } from '../config/chatbot-config.service';

@Component({
  selector: 'app-chatbot-config',
  standalone: false,
  template: `
    <div class="chatbot-config-panel">
      <h4>AI Assistant Configuration</h4>
      
      <!-- Production Mode Notice -->
      <div *ngIf="!canChangeLLMProvider()" class="production-mode-notice">
        <div class="notice-header">
          <i class="fas fa-lock"></i>
          <span>Production Mode</span>
        </div>
        <p>AI provider is configured by system administrators. Current provider: <strong>{{ getCurrentProviderName() }}</strong></p>
      </div>
      
      <form *ngIf="canChangeLLMProvider()" [formGroup]="configForm" (ngSubmit)="onSubmit()">
        <!-- Provider Selection -->
        <div class="config-section">
          <label for="provider">AI Provider:</label>
          <select id="provider" formControlName="provider" class="config-select">
            <option value="local">Local LLM (Ollama)</option>
            <option value="openai">OpenAI ChatGPT</option>
            <option value="gemini">Google Gemini</option>
            <option value="fallback">Built-in Assistant</option>
          </select>
        </div>

        <!-- Local LLM Configuration -->
        <div class="config-section" *ngIf="configForm.get('provider')?.value === 'local'">
          <label for="localUrl">Local API URL:</label>
          <input 
            id="localUrl" 
            type="url" 
            formControlName="localUrl" 
            placeholder="http://localhost:11434"
            class="config-input">
          
          <label for="localModel">Model:</label>
          <input 
            id="localModel" 
            type="text" 
            formControlName="localModel" 
            placeholder="llama2"
            class="config-input">
          
          <label for="localApiType">API Type:</label>
          <select id="localApiType" formControlName="localApiType" class="config-select">
            <option value="ollama">Ollama API</option>
            <option value="openai-compatible">OpenAI-Compatible (LM Studio)</option>
          </select>
        </div>

        <!-- OpenAI Configuration -->
        <div class="config-section" *ngIf="configForm.get('provider')?.value === 'openai'">
          <label for="openaiKey">OpenAI API Key:</label>
          <input 
            id="openaiKey" 
            type="password" 
            formControlName="openaiKey" 
            placeholder="sk-..."
            class="config-input">
          
          <label for="openaiModel">Model:</label>
          <select id="openaiModel" formControlName="openaiModel" class="config-select">
            <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            <option value="gpt-4">GPT-4</option>
            <option value="gpt-4-turbo">GPT-4 Turbo</option>
          </select>
        </div>

        <!-- Gemini Configuration -->
        <div class="config-section" *ngIf="configForm.get('provider')?.value === 'gemini'">
          <label for="geminiKey">Gemini API Key:</label>
          <input 
            id="geminiKey" 
            type="password" 
            formControlName="geminiKey" 
            placeholder="Your Gemini API key"
            class="config-input">
          
          <label for="geminiModel">Model:</label>
          <select id="geminiModel" formControlName="geminiModel" class="config-select">
            <option value="gemini-pro">Gemini Pro</option>
            <option value="gemini-pro-vision">Gemini Pro Vision</option>
          </select>
        </div>

        <!-- Common Settings -->
        <div class="config-section">
          <label for="temperature">Temperature (Creativity): {{ configForm.get('temperature')?.value }}</label>
          <input 
            id="temperature" 
            type="range" 
            min="0" 
            max="1" 
            step="0.1" 
            formControlName="temperature"
            class="config-range">
          
          <label for="maxTokens">Max Tokens:</label>
          <input 
            id="maxTokens" 
            type="number" 
            min="100" 
            max="4000" 
            formControlName="maxTokens"
            class="config-input">
        </div>

        <div class="config-actions">
          <button type="submit" [disabled]="!configForm.valid" class="config-save-btn">
            Save Configuration
          </button>
          <button type="button" (click)="testConnection()" class="config-test-btn">
            Test Connection
          </button>
        </div>
      </form>

      <!-- Always show provider status -->
      <div class="provider-status-section">
        <h5>Provider Status:</h5>
        <div *ngFor="let status of providerStatuses | keyvalue" class="status-item">
          <span class="status-name">{{ status.value.name }} ({{ status.key }}):</span>
          <span class="status-indicator" [ngClass]="'status-' + status.value.status">
            {{ status.value.status | titlecase }}
          </span>
        </div>
      </div>

      <!-- Status Messages -->
      <div class="config-status" *ngIf="statusMessage">
        <div [class]="'status-' + statusType">{{ statusMessage }}</div>
      </div>

      <!-- Current Provider Info -->
      <div class="config-info">
        <small>Current Provider: {{ currentProvider }}</small>
      </div>
    </div>
  `,
  styles: [`
    .chatbot-config-panel {
      padding: 16px;
      background: white;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
      max-width: 400px;
    }

    .chatbot-config-panel h4 {
      margin: 0 0 16px 0;
      color: #333;
    }

    .config-section {
      margin-bottom: 16px;
    }

    .config-section label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
      color: #555;
    }

    .config-input,
    .config-select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      margin-bottom: 8px;
    }

    .config-range {
      width: 100%;
      margin-bottom: 8px;
    }

    .config-actions {
      display: flex;
      gap: 8px;
      margin-top: 16px;
    }

    .config-save-btn,
    .config-test-btn {
      flex: 1;
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    .config-save-btn {
      background: #0066cc;
      color: white;
    }

    .config-save-btn:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .config-test-btn {
      background: #28a745;
      color: white;
    }

    .config-status {
      margin-top: 12px;
    }

    .status-success {
      color: #28a745;
      background: #d4edda;
      padding: 8px;
      border-radius: 4px;
    }

    .status-error {
      color: #dc3545;
      background: #f8d7da;
      padding: 8px;
      border-radius: 4px;
    }

    .config-info {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #eee;
    }

    .config-info small {
      color: #666;
    }
  `]
})
export class ChatbotConfigComponent implements OnInit, OnDestroy {
  configForm: FormGroup;
  currentProvider = '';
  providerStatuses: { [key: string]: any } = {};
  statusMessage = '';
  statusType: 'success' | 'error' = 'success';
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private chatbotService: ChatbotService,
    private configService: ChatbotConfigService
  ) {
    this.configForm = this.fb.group({
      provider: ['local', Validators.required],
      localUrl: ['http://192.168.20.22:1234'],
      localModel: ['openai/gpt-oss-120b'],
      localApiType: ['openai-compatible'],
      openaiKey: [''],
      openaiModel: ['gpt-3.5-turbo'],
      geminiKey: [''],
      geminiModel: ['gemini-pro'],
      temperature: [0.7, [Validators.min(0), Validators.max(1)]],
      maxTokens: [1000, [Validators.min(100), Validators.max(4000)]]
    });
  }

  ngOnInit(): void {
    this.loadConfiguration();
    this.updateCurrentProvider();
    this.loadProviderStatuses();
    
    // Watch for provider changes to validate fields
    this.configForm.get('provider')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateValidators();
      });
  }

  private loadConfiguration(): void {
    const config = this.configService.getLLMConfiguration();
    console.log('[ChatbotConfig] Loading saved configuration:', config);
    
    if (config) {
      // Update form with saved configuration
      const formValues: any = {
        provider: config.primaryProvider || 'local',
        temperature: 0.7,
        maxTokens: 1000
      };

      // Load provider-specific settings
      if (config.providers.local) {
        formValues.localUrl = config.providers.local.apiUrl || 'http://localhost:11434';
        formValues.localModel = config.providers.local.model || 'llama2';
        formValues.localApiType = config.providers.local.apiType || 'ollama';
        formValues.temperature = config.providers.local.temperature || 0.7;
        formValues.maxTokens = config.providers.local.maxTokens || 1000;
      }

      if (config.providers.openai) {
        formValues.openaiKey = config.providers.openai.apiKey || '';
        formValues.openaiModel = config.providers.openai.model || 'gpt-3.5-turbo';
        formValues.temperature = config.providers.openai.temperature || 0.7;
        formValues.maxTokens = config.providers.openai.maxTokens || 1000;
      }

      if (config.providers.gemini) {
        formValues.geminiKey = config.providers.gemini.apiKey || '';
        formValues.geminiModel = config.providers.gemini.model || 'gemini-pro';
        formValues.temperature = config.providers.gemini.temperature || 0.7;
        formValues.maxTokens = config.providers.gemini.maxTokens || 1000;
      }

      console.log('[ChatbotConfig] Setting form values:', formValues);
      this.configForm.patchValue(formValues);
    }
  }

  private loadProviderStatuses(): void {
    // Only load provider statuses once on initialization to avoid repeated requests
    this.chatbotService.getLLMProviderStatus().subscribe(statuses => {
      this.providerStatuses = statuses;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSubmit(): void {
    if (!this.configForm.valid) return;

    const formValue = this.configForm.value;
    const providerType = formValue.provider;
    
    // Build configuration based on selected provider
    const config: any = {
      primaryProvider: providerType,
      enableFallback: true,
      providers: {}
    };

    switch (providerType) {
      case 'local':
        config.providers.local = {
          apiUrl: formValue.localUrl,
          model: formValue.localModel,
          apiType: formValue.localApiType,
          temperature: formValue.temperature,
          maxTokens: formValue.maxTokens
        };
        break;
      
      case 'openai':
        config.providers.openai = {
          apiKey: formValue.openaiKey,
          model: formValue.openaiModel,
          temperature: formValue.temperature,
          maxTokens: formValue.maxTokens
        };
        break;
      
      case 'gemini':
        config.providers.gemini = {
          apiKey: formValue.geminiKey,
          model: formValue.geminiModel,
          temperature: formValue.temperature,
          maxTokens: formValue.maxTokens
        };
        break;
    }

    this.chatbotService.updateLLMConfig(config);
    this.showStatus('Configuration saved successfully!', 'success');
    
    setTimeout(() => {
      this.updateCurrentProvider();
    }, 1000);
  }

  testConnection(): void {
    const providerType = this.configForm.get('provider')?.value;
    
    this.chatbotService.switchLLMProvider(providerType).subscribe({
      next: (success) => {
        if (success) {
          this.showStatus('Connection successful!', 'success');
        } else {
          this.showStatus('Connection failed. Please check your configuration.', 'error');
        }
      },
      error: () => {
        this.showStatus('Connection test failed.', 'error');
      }
    });
  }

  private updateCurrentProvider(): void {
    this.currentProvider = this.chatbotService.getCurrentLLMProvider();
  }

  private updateValidators(): void {
    const provider = this.configForm.get('provider')?.value;
    
    // Reset all validators
    this.configForm.get('openaiKey')?.clearValidators();
    this.configForm.get('geminiKey')?.clearValidators();
    this.configForm.get('localUrl')?.clearValidators();
    
    // Add validators based on selected provider
    switch (provider) {
      case 'openai':
        this.configForm.get('openaiKey')?.setValidators([Validators.required]);
        break;
      case 'gemini':
        this.configForm.get('geminiKey')?.setValidators([Validators.required]);
        break;
      case 'local':
        this.configForm.get('localUrl')?.setValidators([Validators.required]);
        break;
    }
    
    // Update form validation
    this.configForm.get('openaiKey')?.updateValueAndValidity();
    this.configForm.get('geminiKey')?.updateValueAndValidity();
    this.configForm.get('localUrl')?.updateValueAndValidity();
  }

  private showStatus(message: string, type: 'success' | 'error'): void {
    this.statusMessage = message;
    this.statusType = type;
    
    setTimeout(() => {
      this.statusMessage = '';
    }, 3000);
  }

  // Helper methods for template
  public canChangeLLMProvider(): boolean {
    return this.configService.canChangeLLMProvider();
  }

  public getCurrentProviderName(): string {
    const forcedProvider = this.configService.getForcedLLMProvider();
    if (forcedProvider) {
      switch (forcedProvider) {
        case 'local': return 'Local LLM';
        case 'openai': return 'OpenAI (ChatGPT)';
        case 'gemini': return 'Google Gemini';
        case 'fallback': return 'Built-in Assistant';
        default: return 'Unknown Provider';
      }
    }
    return this.currentProvider || 'No Provider Selected';
  }
}
