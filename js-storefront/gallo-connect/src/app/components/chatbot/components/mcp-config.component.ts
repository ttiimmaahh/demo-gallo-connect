import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { MCPSDKService } from '../mcp/mcp-sdk.service';
import { MCPServerConfig, MCPServerConnection } from '../mcp/mcp-server.interface';
import { ChatbotConfigService } from '../config/chatbot-config.service';

@Component({
  selector: 'app-mcp-config',
  standalone: false,
  template: `
    <div class="mcp-config-panel">
      <h4>🔌 MCP Server Configuration</h4>
      <p class="mcp-description">Configure Model Context Protocol servers to extend the chatbot with tools, resources, and capabilities.</p>
      
      <!-- Server Status Overview -->
      <div class="mcp-status-overview" *ngIf="connections.length > 0">
        <h5>Connected Servers</h5>
        <div class="status-grid">
          <div 
            *ngFor="let connection of connections" 
            class="status-card"
            [class.connected]="connection.status === 'connected'"
            [class.error]="connection.status === 'error'"
            [class.connecting]="connection.status === 'connecting'">
            <div class="status-header">
              <span class="server-name">{{ getServerName(connection.id) }}</span>
              <span class="status-badge" [class]="'status-' + connection.status">
                {{ connection.status }}
              </span>
            </div>
            <div class="capabilities" *ngIf="connection.status === 'connected'">
              <span class="capability" *ngIf="connection.capabilities.tools">
                🔧 {{ connection.tools.length }} tools
              </span>
              <span class="capability" *ngIf="connection.capabilities.resources">
                📚 {{ connection.resources.length }} resources
              </span>
              <span class="capability" *ngIf="connection.capabilities.prompts">
                💬 {{ connection.prompts.length }} prompts
              </span>
            </div>
            <div class="error-message" *ngIf="connection.status === 'error' && connection.lastError">
              {{ connection.lastError }}
            </div>
          </div>
        </div>
      </div>

      <!-- Server Configuration Form -->
      <form [formGroup]="mcpForm" (ngSubmit)="onSubmit()">
        <div class="servers-section">
          <div class="section-header">
            <h5>Server Configurations</h5>
            <button 
              *ngIf="canAddMCPServers()" 
              type="button" 
              (click)="addServer()" 
              class="add-server-btn">
              + Add Server
            </button>
          </div>

          <div formArrayName="servers" class="servers-list">
            <div 
              *ngFor="let serverGroup of servers.controls; let i = index"
              [formGroupName]="i"
              class="server-config-card">
              
              <div class="server-header">
                <h6>Server {{ i + 1 }}</h6>
                <div class="server-actions">
                  <button 
                    type="button" 
                    (click)="toggleServer(i)" 
                    class="toggle-btn"
                    [class.enabled]="serverGroup.get('enabled')?.value">
                    {{ serverGroup.get('enabled')?.value ? 'Enabled' : 'Disabled' }}
                  </button>
                  <button 
                    type="button" 
                    (click)="connectServer(i)" 
                    class="connect-btn"
                    [disabled]="!serverGroup.get('enabled')?.value">
                    Connect
                  </button>
                  <button 
                    *ngIf="canAddMCPServers()"
                    type="button" 
                    (click)="removeServer(i)" 
                    class="remove-btn">
                    ✕
                  </button>
                </div>
              </div>

              <div class="server-fields">
                <!-- Basic Info -->
                <div class="field-row">
                  <div class="field">
                    <label>Name:</label>
                    <input 
                      type="text" 
                      formControlName="name" 
                      placeholder="My MCP Server"
                      class="config-input">
                  </div>
                  <div class="field">
                    <label>Type:</label>
                    <select formControlName="type" class="config-select">
                      <option value="http">HTTP</option>
                      <option value="sse">Server-Sent Events</option>
                      <option value="stdio">STDIO (requires proxy)</option>
                    </select>
                  </div>
                </div>

                <div class="field">
                  <label>Description:</label>
                  <input 
                    type="text" 
                    formControlName="description" 
                    placeholder="Optional description"
                    class="config-input">
                </div>

                <!-- Connection Settings -->
                <div class="connection-settings" [ngSwitch]="serverGroup.get('type')?.value">
                  <!-- HTTP/SSE Configuration -->
                  <div *ngSwitchCase="'http'" class="http-config">
                    <div class="field">
                      <label>Server URL:</label>
                      <input 
                        type="url" 
                        formControlName="url" 
                        placeholder="http://localhost:3000/mcp"
                        class="config-input">
                    </div>
                    <div class="field">
                      <label>Headers (JSON):</label>
                      <textarea 
                        formControlName="headers" 
                        placeholder='{"Authorization": "Bearer token"}'
                        class="config-textarea"
                        rows="2"></textarea>
                    </div>
                  </div>

                  <div *ngSwitchCase="'sse'" class="sse-config">
                    <div class="field">
                      <label>Server URL:</label>
                      <input 
                        type="url" 
                        formControlName="url" 
                        placeholder="http://localhost:3000/sse"
                        class="config-input">
                    </div>
                    <div class="field">
                      <label>Headers (JSON):</label>
                      <textarea 
                        formControlName="headers" 
                        placeholder='{"Authorization": "Bearer token"}'
                        class="config-textarea"
                        rows="2"></textarea>
                    </div>
                  </div>

                  <!-- STDIO Configuration -->
                  <div *ngSwitchCase="'stdio'" class="stdio-config">
                    <div class="field">
                      <label>Command:</label>
                      <input 
                        type="text" 
                        formControlName="command" 
                        placeholder="node"
                        class="config-input">
                    </div>
                    <div class="field">
                      <label>Arguments (JSON array):</label>
                      <textarea 
                        formControlName="args" 
                        placeholder='["server.js", "--port", "3000"]'
                        class="config-textarea"
                        rows="2"></textarea>
                    </div>
                    <div class="stdio-notice">
                      <strong>Note:</strong> STDIO connections require a backend proxy service to work from the browser.
                    </div>
                  </div>
                </div>

                <!-- Advanced Settings -->
                <details class="advanced-settings">
                  <summary>Advanced Settings</summary>
                  <div class="advanced-fields">
                    <div class="field-row">
                      <div class="field">
                        <label>Timeout (ms):</label>
                        <input 
                          type="number" 
                          formControlName="timeout" 
                          placeholder="30000"
                          class="config-input">
                      </div>
                      <div class="field">
                        <label>Retry Attempts:</label>
                        <input 
                          type="number" 
                          formControlName="retryAttempts" 
                          placeholder="3"
                          class="config-input">
                      </div>
                    </div>
                    
                    <div class="capabilities-checkboxes">
                      <label>Expected Capabilities:</label>
                      <div class="checkbox-group">
                        <label class="checkbox-label">
                          <input type="checkbox" formControlName="supportsTools">
                          🔧 Tools
                        </label>
                        <label class="checkbox-label">
                          <input type="checkbox" formControlName="supportsResources">
                          📚 Resources
                        </label>
                        <label class="checkbox-label">
                          <input type="checkbox" formControlName="supportsPrompts">
                          💬 Prompts
                        </label>
                        <label class="checkbox-label">
                          <input type="checkbox" formControlName="supportsLogging">
                          📝 Logging
                        </label>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>

        <!-- Form Actions -->
        <div class="config-actions">
          <button type="submit" [disabled]="!mcpForm.valid" class="save-btn">
            Save Configuration
          </button>
          <button type="button" (click)="connectAllServers()" class="connect-all-btn">
            Connect All Enabled
          </button>
          <button type="button" (click)="disconnectAllServers()" class="disconnect-all-btn">
            Disconnect All
          </button>
          <button type="button" (click)="testAllConnections()" class="test-btn">
            Test Connections
          </button>
        </div>
      </form>

      <!-- Available Tools Display -->
      <div class="available-tools" *ngIf="allTools.length > 0">
        <h5>🔧 Available Tools ({{ allTools.length }})</h5>
        <div class="tools-grid">
          <div *ngFor="let tool of allTools" class="tool-card">
            <div class="tool-header">
              <span class="tool-name">{{ tool.name }}</span>
              <span class="tool-server">{{ tool.serverId }}</span>
            </div>
            <div class="tool-description">{{ tool.description }}</div>
            <details class="tool-schema">
              <summary>Parameters</summary>
              <pre>{{ formatSchema(tool.inputSchema) }}</pre>
            </details>
          </div>
        </div>
      </div>

      <!-- Status Messages -->
      <div class="status-messages" *ngIf="statusMessage">
        <div [class]="'status-' + statusType">{{ statusMessage }}</div>
      </div>
    </div>
  `,
  styles: [`
    .mcp-config-panel {
      padding: 20px;
      max-width: 800px;
      background: white;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }

    .mcp-config-panel h4 {
      margin: 0 0 8px 0;
      color: #333;
      font-size: 18px;
    }

    .mcp-description {
      margin: 0 0 20px 0;
      color: #666;
      font-size: 14px;
    }

    .mcp-status-overview {
      margin-bottom: 24px;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 6px;
    }

    .status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }

    .status-card {
      padding: 12px;
      border-radius: 6px;
      border: 1px solid #ddd;
      background: white;
    }

    .status-card.connected {
      border-color: #28a745;
      background: #f8fff9;
    }

    .status-card.error {
      border-color: #dc3545;
      background: #fff8f8;
    }

    .status-card.connecting {
      border-color: #007bff;
      background: #f8fbff;
    }

    .status-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .server-name {
      font-weight: 500;
      color: #333;
    }

    .status-badge {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
    }

    .status-badge.status-connected {
      background: #28a745;
      color: white;
    }

    .status-badge.status-error {
      background: #dc3545;
      color: white;
    }

    .status-badge.status-connecting {
      background: #007bff;
      color: white;
    }

    .capabilities {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .capability {
      font-size: 12px;
      color: #666;
      background: #e9ecef;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .error-message {
      font-size: 12px;
      color: #dc3545;
      margin-top: 4px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .add-server-btn {
      padding: 6px 12px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    .servers-list {
      space: 16px;
    }

    .server-config-card {
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 16px;
      background: #fafafa;
    }

    .server-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e0e0e0;
    }

    .server-header h6 {
      margin: 0;
      color: #333;
    }

    .server-actions {
      display: flex;
      gap: 8px;
    }

    .toggle-btn,
    .connect-btn,
    .remove-btn {
      padding: 4px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      background: white;
    }

    .toggle-btn.enabled {
      background: #28a745;
      color: white;
      border-color: #28a745;
    }

    .connect-btn {
      background: #007bff;
      color: white;
      border-color: #007bff;
    }

    .connect-btn:disabled {
      background: #6c757d;
      border-color: #6c757d;
      cursor: not-allowed;
    }

    .remove-btn {
      background: #dc3545;
      color: white;
      border-color: #dc3545;
    }

    .field-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .field {
      margin-bottom: 12px;
    }

    .field label {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
      color: #555;
      font-size: 13px;
    }

    .config-input,
    .config-select,
    .config-textarea {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 13px;
      box-sizing: border-box;
    }

    .config-textarea {
      resize: vertical;
      font-family: monospace;
    }

    .stdio-notice {
      padding: 8px;
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 4px;
      font-size: 12px;
      margin-top: 8px;
    }

    .advanced-settings {
      margin-top: 16px;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }

    .advanced-settings summary {
      padding: 8px 12px;
      background: #f1f3f4;
      cursor: pointer;
      font-weight: 500;
      font-size: 13px;
    }

    .advanced-fields {
      padding: 12px;
    }

    .checkbox-group {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 8px;
      margin-top: 8px;
    }

    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      cursor: pointer;
    }

    .config-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
    }

    .save-btn,
    .connect-all-btn,
    .disconnect-all-btn,
    .test-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }

    .save-btn {
      background: #28a745;
      color: white;
    }

    .save-btn:disabled {
      background: #6c757d;
      cursor: not-allowed;
    }

    .connect-all-btn {
      background: #007bff;
      color: white;
    }

    .disconnect-all-btn {
      background: #6c757d;
      color: white;
    }

    .test-btn {
      background: #ffc107;
      color: #212529;
    }

    .available-tools {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
    }

    .tools-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }

    .tool-card {
      border: 1px solid #ddd;
      border-radius: 6px;
      padding: 12px;
      background: white;
    }

    .tool-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .tool-name {
      font-weight: 500;
      color: #333;
    }

    .tool-server {
      font-size: 12px;
      color: #666;
      background: #e9ecef;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .tool-description {
      color: #666;
      font-size: 13px;
      margin-bottom: 8px;
    }

    .tool-schema {
      border: 1px solid #e0e0e0;
      border-radius: 4px;
    }

    .tool-schema summary {
      padding: 6px 8px;
      background: #f8f9fa;
      cursor: pointer;
      font-size: 12px;
    }

    .tool-schema pre {
      margin: 0;
      padding: 8px;
      font-size: 11px;
      background: white;
      overflow-x: auto;
    }

    .status-messages {
      margin-top: 16px;
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
  `]
})
export class MCPConfigComponent implements OnInit, OnDestroy {
  mcpForm: FormGroup;
  connections: MCPServerConnection[] = [];
  allTools: any[] = [];
  statusMessage = '';
  statusType: 'success' | 'error' = 'success';
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private mcpService: MCPSDKService,
    private configService: ChatbotConfigService
  ) {
    this.mcpForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadConfigurations();
    this.subscribeToConnections();
    this.subscribeToTools();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get servers(): FormArray {
    return this.mcpForm.get('servers') as FormArray;
  }

  private createForm(): FormGroup {
    return this.fb.group({
      servers: this.fb.array([])
    });
  }

  private createServerFormGroup(config?: MCPServerConfig): FormGroup {
    return this.fb.group({
      id: [config?.id || this.generateId()],
      name: [config?.name || '', Validators.required],
      description: [config?.description || ''],
      type: [config?.type || 'http', Validators.required],
      enabled: [config?.enabled ?? true],
      url: [config?.connection?.url || ''],
      headers: [config?.connection?.headers ? JSON.stringify(config.connection.headers, null, 2) : ''],
      command: [config?.connection?.command || ''],
      args: [config?.connection?.args ? JSON.stringify(config.connection.args) : ''],
      timeout: [config?.timeout || 30000],
      retryAttempts: [config?.retryAttempts || 3],
      supportsTools: [config?.capabilities?.tools ?? true],
      supportsResources: [config?.capabilities?.resources ?? true],
      supportsPrompts: [config?.capabilities?.prompts ?? true],
      supportsLogging: [config?.capabilities?.logging ?? false]
    });
  }

  private loadConfigurations(): void {
    if (this.configService.canAddMCPServers()) {
      // Development mode: Load user configurations + predefined ones
      const userConfigs = this.mcpService.getAllServerConfigurations();
      const predefinedConfigs = this.configService.getPredefinedMCPServers();
      
      // Load user configs first
      userConfigs.forEach(config => {
        this.servers.push(this.createServerFormGroup(config));
      });
      
      // Add predefined configs if not already present
      predefinedConfigs.forEach(predefinedConfig => {
        const exists = userConfigs.some(userConfig => userConfig.id === predefinedConfig.id);
        if (!exists) {
          this.servers.push(this.createServerFormGroup(predefinedConfig));
          // Also add to MCP service
          this.mcpService.addServerConfiguration(predefinedConfig);
        }
      });

      if (this.servers.length === 0) {
        this.addServer(); // Add one empty server by default in dev mode
      }
    } else {
      // Production mode: Load only predefined configurations
      const predefinedConfigs = this.configService.getPredefinedMCPServers();
      
      // Clear any existing configurations and load predefined ones
      predefinedConfigs.forEach(config => {
        this.mcpService.addServerConfiguration(config);
        this.servers.push(this.createServerFormGroup(config));
      });
      
      // Auto-connect to all enabled predefined servers
      this.connectAllEnabledServers();
    }
  }

  private async connectAllEnabledServers(): Promise<void> {
    const configs = this.configService.getPredefinedMCPServers().filter(c => c.enabled);
    for (const config of configs) {
      try {
        await this.mcpService.connect(config);
      } catch (error: any) {
        console.error(`Failed to auto-connect to ${config.name}:`, error);
      }
    }
  }

  private subscribeToConnections(): void {
    this.mcpService.connections$
      .pipe(takeUntil(this.destroy$))
      .subscribe(connections => {
        this.connections = connections;
      });
  }

  private subscribeToTools(): void {
    this.mcpService.getAllAvailableTools()
      .pipe(takeUntil(this.destroy$))
      .subscribe(tools => {
        this.allTools = tools;
      });
  }

  addServer(): void {
    this.servers.push(this.createServerFormGroup());
  }

  removeServer(index: number): void {
    const serverGroup = this.servers.at(index);
    const serverId = serverGroup.get('id')?.value;
    
    if (serverId) {
      this.mcpService.removeServerConfiguration(serverId);
    }
    
    this.servers.removeAt(index);
  }

  toggleServer(index: number): void {
    const serverGroup = this.servers.at(index);
    const currentValue = serverGroup.get('enabled')?.value;
    serverGroup.get('enabled')?.setValue(!currentValue);
  }

  async connectServer(index: number): Promise<void> {
    const serverConfig = this.buildServerConfig(index);
    if (!serverConfig) return;

    try {
      await this.mcpService.connect(serverConfig);
      this.showStatus(`Successfully connected to ${serverConfig.name}`, 'success');
    } catch (error: any) {
      this.showStatus(`Failed to connect to ${serverConfig.name}: ${error.message}`, 'error');
    }
  }

  onSubmit(): void {
    if (!this.mcpForm.valid) return;

    const configs = this.buildAllServerConfigs();
    
    // Clear existing configurations
    const existingIds = this.mcpService.getAllServerConfigurations().map(c => c.id);
    existingIds.forEach(id => this.mcpService.removeServerConfiguration(id));

    // Add new configurations
    configs.forEach(config => {
      this.mcpService.addServerConfiguration(config);
    });

    this.showStatus('Configuration saved successfully!', 'success');
  }

  async connectAllServers(): Promise<void> {
    const configs = this.buildAllServerConfigs().filter(c => c.enabled);
    
    for (const config of configs) {
      try {
        await this.mcpService.connect(config);
      } catch (error: any) {
        console.error(`Failed to connect to ${config.name}:`, error);
      }
    }
    
    this.showStatus(`Connection attempts completed for ${configs.length} servers`, 'success');
  }

  async disconnectAllServers(): Promise<void> {
    await this.mcpService.disconnectAllServers();
    this.showStatus('All servers disconnected', 'success');
  }

  async testAllConnections(): Promise<void> {
    const healthStatus = await this.mcpService.healthCheck();
    const healthyCount = Object.values(healthStatus).filter(status => status === 'healthy').length;
    const totalCount = Object.keys(healthStatus).length;
    
    this.showStatus(`Health check completed: ${healthyCount}/${totalCount} servers healthy`, 'success');
  }

  private buildServerConfig(index: number): MCPServerConfig | null {
    const serverGroup = this.servers.at(index);
    if (!serverGroup.valid) return null;

    const formValue = serverGroup.value;
    
    let headers: Record<string, string> = {};
    if (formValue.headers) {
      try {
        headers = JSON.parse(formValue.headers);
      } catch {
        headers = {};
      }
    }

    let args: string[] = [];
    if (formValue.args) {
      try {
        args = JSON.parse(formValue.args);
      } catch {
        args = [];
      }
    }

    return {
      id: formValue.id,
      name: formValue.name,
      description: formValue.description,
      type: formValue.type,
      enabled: formValue.enabled,
      connection: {
        url: formValue.url || undefined,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        command: formValue.command || undefined,
        args: args.length > 0 ? args : undefined
      },
      capabilities: {
        tools: formValue.supportsTools,
        resources: formValue.supportsResources,
        prompts: formValue.supportsPrompts,
        logging: formValue.supportsLogging
      },
      timeout: formValue.timeout,
      retryAttempts: formValue.retryAttempts
    };
  }

  private buildAllServerConfigs(): MCPServerConfig[] {
    const configs: MCPServerConfig[] = [];
    
    for (let i = 0; i < this.servers.length; i++) {
      const config = this.buildServerConfig(i);
      if (config) {
        configs.push(config);
      }
    }
    
    return configs;
  }

  getServerName(serverId: string): string {
    const config = this.mcpService.getServerConfiguration(serverId);
    return config?.name || serverId;
  }

  formatSchema(schema: any): string {
    return JSON.stringify(schema, null, 2);
  }

  private generateId(): string {
    return `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private showStatus(message: string, type: 'success' | 'error'): void {
    this.statusMessage = message;
    this.statusType = type;
    
    setTimeout(() => {
      this.statusMessage = '';
    }, 5000);
  }

  // Helper methods for template
  public canAddMCPServers(): boolean {
    return this.configService.canAddMCPServers();
  }

  public isDevelopmentMode(): boolean {
    return this.configService.isDevelopmentMode();
  }
}
