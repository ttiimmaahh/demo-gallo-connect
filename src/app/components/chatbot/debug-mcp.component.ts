import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MCPSDKService } from './mcp/mcp-sdk.service';
import { LLMService } from './services/llm.service';
import { ChatbotConfigService } from './config/chatbot-config.service';
import { ChatbotInitializationService } from './services/chatbot-initialization.service';

@Component({
  selector: 'app-debug-mcp',
  standalone: false,
  template: `
    <div style="padding: 20px; border: 1px solid #ccc; margin: 10px; background: #f9f9f9;">
      <h3>🔍 MCP Debug Panel</h3>
      
      <div style="margin-bottom: 15px;">
        <button (click)="runDiagnostics()" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px;">
          Run MCP Diagnostics
        </button>
        <button (click)="testToolsAvailability()" style="padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; margin-left: 10px;">
          Test Tools Availability
        </button>
        <button (click)="quickCheck()" style="padding: 8px 16px; background: #ffc107; color: #212529; border: none; border-radius: 4px; margin-left: 10px;">
          Quick Check
        </button>
        <button (click)="debugToolChain()" style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 4px; margin-left: 10px;">
          Debug Tool Chain
        </button>
        <button (click)="testManualToolsRequest()" style="padding: 8px 16px; background: #6f42c1; color: white; border: none; border-radius: 4px; margin-left: 10px;">
          Test Manual Tools Request
        </button>
        <button (click)="testServerConnectivity()" style="padding: 8px 16px; background: #fd7e14; color: white; border: none; border-radius: 4px; margin-left: 10px;">
          Test Server Connectivity
        </button>
      </div>

      <div style="margin-bottom: 15px;">
        <strong>Initialization Status:</strong> {{ initStatus }}
      </div>

      <div style="margin-bottom: 15px;">
        <strong>MCP Servers:</strong>
        <ul>
          <li *ngFor="let connection of connections">
            <strong>{{ connection.id }}</strong> - {{ connection.status }}
            <span *ngIf="connection.status === 'connected'"> ({{ connection.tools?.length || 0 }} tools)</span>
            <span *ngIf="connection.lastError" style="color: red;"> - Error: {{ connection.lastError }}</span>
          </li>
        </ul>
      </div>

      <div style="margin-bottom: 15px;">
        <strong>Available Tools:</strong>
        <ul>
          <li *ngFor="let tool of availableTools">
            <strong>{{ tool.name }}</strong> ({{ tool.serverId }}) - {{ tool.description }}
          </li>
        </ul>
      </div>

      <div style="margin-bottom: 15px;">
        <strong>Current LLM Provider:</strong> {{ currentProvider }}
      </div>

      <div style="margin-bottom: 15px;">
        <strong>Predefined Servers:</strong>
        <ul>
          <li *ngFor="let server of predefinedServers">
            <strong>{{ server.name }}</strong> ({{ server.id }}) - {{ server.enabled ? 'Enabled' : 'Disabled' }}
            <br>URL: {{ server.connection?.url }}
          </li>
        </ul>
      </div>

      <div *ngIf="diagnosticResults" style="background: white; padding: 10px; border: 1px solid #ddd; border-radius: 4px;">
        <h4>Diagnostic Results:</h4>
        <pre>{{ diagnosticResults }}</pre>
      </div>
    </div>
  `
})
export class DebugMCPComponent implements OnInit {
  connections: any[] = [];
  availableTools: any[] = [];
  currentProvider = '';
  predefinedServers: any[] = [];
  initStatus = 'Unknown';
  diagnosticResults = '';

  constructor(
    private mcpService: MCPSDKService,
    private llmService: LLMService,
    private configService: ChatbotConfigService,
    private initService: ChatbotInitializationService,
    private http: HttpClient
  ) {}

  ngOnInit() {
    this.loadInitialData();
  }

  loadInitialData() {
    console.log('📊 DEBUG: loadInitialData() called');
    
    this.connections = this.mcpService.getAllConnections();
    console.log('📊 DEBUG: Connections loaded:', this.connections);
    
    this.currentProvider = this.llmService.getCurrentProviderName();
    console.log('📊 DEBUG: Current provider:', this.currentProvider);
    
    this.predefinedServers = this.configService.getPredefinedMCPServers();
    console.log('📊 DEBUG: Predefined servers:', this.predefinedServers);
    
    this.initStatus = this.initService.isInitializationComplete() ? 'Complete' : 'Not Complete';
    console.log('📊 DEBUG: Initialization status:', this.initStatus);

    this.mcpService.listTools().then(tools => {
      this.availableTools = tools;
      console.log('📊 DEBUG: Available tools loaded:', tools);
    }).catch(error => {
      console.error('📊 DEBUG: Error loading tools:', error);
      this.availableTools = [];
    });
  }

  runDiagnostics() {
    console.log('🔍 DEBUG: runDiagnostics() called');
    alert('🔍 Running MCP Diagnostics - Check console for detailed logs');
    this.diagnosticResults = 'Running diagnostics...';
    
    try {
      const results: string[] = [];
      
      results.push('=== MCP DIAGNOSTICS ===');
      results.push(`Timestamp: ${new Date().toISOString()}`);
      results.push('');

      // Check initialization
      const initComplete = this.initService.isInitializationComplete();
      results.push(`1. Initialization Status: ${initComplete}`);
      console.log('🔍 DEBUG: Initialization status:', initComplete);
      results.push('');

      // Check predefined servers
      const predefined = this.configService.getPredefinedMCPServers();
      results.push(`2. Predefined Servers: ${predefined.length}`);
      console.log('🔍 DEBUG: Predefined servers:', predefined);
      predefined.forEach(server => {
        results.push(`   - ${server.name} (${server.id}): ${server.enabled ? 'Enabled' : 'Disabled'}`);
        results.push(`     URL: ${server.connection?.url}`);
      });
      results.push('');

      // Check connections
      const connections = this.mcpService.getAllConnections();
      results.push(`3. Current Connections: ${connections.length}`);
      console.log('🔍 DEBUG: Current connections:', connections);
      connections.forEach(conn => {
        results.push(`   - ${conn.id}: ${conn.status}`);
        if (conn.status === 'connected') {
          results.push(`     Tools: ${conn.tools?.length || 0}`);
          results.push(`     Resources: ${conn.resources?.length || 0}`);
          results.push(`     Prompts: ${conn.prompts?.length || 0}`);
        }
        if (conn.lastError) {
          results.push(`     Last Error: ${conn.lastError}`);
        }
      });
      results.push('');

      // Check available tools (async)
      console.log('🔍 DEBUG: Getting available tools...');
      this.mcpService.listTools().then(tools => {
        results.push(`4. Available Tools: ${tools.length}`);
        console.log('🔍 DEBUG: Available tools:', tools);
        tools.forEach(tool => {
          results.push(`   - ${tool.name} (${tool.serverId}): ${tool.description}`);
        });
        results.push('');

        // Check LLM provider
        const providerName = this.llmService.getCurrentProviderName();
        results.push(`5. Current LLM Provider: ${providerName}`);
        console.log('🔍 DEBUG: Current LLM provider:', providerName);
        results.push('');

        // Check tools for LLM format
        console.log('🔍 DEBUG: Getting tools for LLM...');
        this.mcpService.getToolsForLLM().subscribe({
          next: (llmTools) => {
            results.push(`6. Tools formatted for LLM: ${llmTools?.length || 0}`);
            console.log('🔍 DEBUG: Tools for LLM:', llmTools);
            llmTools?.forEach(tool => {
              results.push(`   - ${tool.function.name}: ${tool.function.description}`);
            });
            
            // Final update
            this.diagnosticResults = results.join('\n');
            console.log('🔍 DEBUG: Final diagnostics results:', this.diagnosticResults);
            this.loadInitialData();
          },
          error: (error) => {
            console.error('🔍 DEBUG: Error getting tools for LLM:', error);
            results.push(`6. Error getting tools for LLM: ${error}`);
            this.diagnosticResults = results.join('\n');
            console.log('🔍 DEBUG: Final diagnostics results with error:', this.diagnosticResults);
            this.loadInitialData();
          }
        });
      }).catch(error => {
        console.error('🔍 DEBUG: Error getting available tools:', error);
        results.push(`4. Error getting available tools: ${error}`);
        this.diagnosticResults = results.join('\n');
        this.loadInitialData();
      });
      
    } catch (error) {
      console.error('🔍 DEBUG: Error in runDiagnostics:', error);
      this.diagnosticResults = `Error running diagnostics: ${error}`;
    }
  }

  async testToolsAvailability() {
    console.log('🔧 DEBUG: testToolsAvailability() called');
    alert('🔧 Testing Tools Availability - Check console for detailed logs');
    console.log('=== TESTING TOOLS AVAILABILITY ===');
    
    try {
      // Force reinitialize MCP servers
      console.log('🔧 DEBUG: Reinitializing MCP servers...');
      this.diagnosticResults = 'Reinitializing MCP servers...';
      
      await this.initService.reinitialize();
      
      // Wait a moment for connections
      setTimeout(async () => {
        console.log('🔧 DEBUG: Checking tools after reinitialization...');
        
        const tools = await this.mcpService.listTools();
        console.log('🔧 DEBUG: Available tools after reinit:', tools);
        
        const llmTools = await this.mcpService.getToolsForLLM().toPromise();
        console.log('🔧 DEBUG: Tools for LLM after reinit:', llmTools);
        
        this.loadInitialData();
        this.diagnosticResults = `Reinitialization complete. Found ${tools.length} tools total, ${llmTools?.length || 0} formatted for LLM.`;
      }, 2000);
      
    } catch (error) {
      console.error('🔧 DEBUG: Error in testToolsAvailability:', error);
      this.diagnosticResults = `Error in test: ${error}`;
    }
  }

  quickCheck() {
    console.log('⚡ QUICK CHECK: Called');
    alert('⚡ Quick Check - Check console now!');
    
    // Immediate, synchronous checks
    const connections = this.mcpService.getAllConnections();
    const predefined = this.configService.getPredefinedMCPServers();
    const initStatus = this.initService.isInitializationComplete();
    const provider = this.llmService.getCurrentProviderName();
    
    console.log('⚡ QUICK CHECK RESULTS:');
    console.log('- Initialization Complete:', initStatus);
    console.log('- Predefined Servers:', predefined.length, predefined);
    console.log('- Current Connections:', connections.length, connections);
    console.log('- Current LLM Provider:', provider);
    
    // Update the display
    this.diagnosticResults = `QUICK CHECK RESULTS:
Initialization: ${initStatus}
Predefined Servers: ${predefined.length}
Current Connections: ${connections.length}
LLM Provider: ${provider}

See console for full details.`;
    
    this.loadInitialData();
  }

  debugToolChain() {
    console.log('🔍 DEBUG TOOL CHAIN: Starting comprehensive tool chain analysis...');
    alert('🔍 Debug Tool Chain - Check console for detailed analysis!');
    
    // Step 1: Check connections
    const connections = this.mcpService.getAllConnections();
    console.log('🔍 STEP 1 - Current Connections:', connections);
    
    // Step 2: Check connected servers
    const connectedServers = this.mcpService.getConnectedServers();
    console.log('🔍 STEP 2 - Connected Servers:', connectedServers);
    
    // Step 3: Check available tools directly
    this.mcpService.listTools().then(mcpTools => {
      console.log('🔍 STEP 3 - Raw MCP Tools (via listTools):', mcpTools);
      
      // Step 4: Check getAllAvailableTools observable
      this.mcpService.getAllAvailableTools().subscribe(observableTools => {
        console.log('🔍 STEP 4 - Observable MCP Tools (via getAllAvailableTools):', observableTools);
        
        // Step 5: Check getToolsForLLM
        this.mcpService.getToolsForLLM().subscribe(llmTools => {
          console.log('🔍 STEP 5 - LLM-formatted Tools (via getToolsForLLM):', llmTools);
          
          // Step 6: Check initialization status
          const initComplete = this.initService.isInitializationComplete();
          console.log('🔍 STEP 6 - Initialization Complete:', initComplete);
          
          // Summary
          console.log('🔍 TOOL CHAIN SUMMARY:', {
            totalConnections: connections.length,
            connectedServers: connectedServers.length,
            rawMCPTools: mcpTools.length,
            observableMCPTools: observableTools.length,
            llmFormattedTools: llmTools.length,
            initializationComplete: initComplete,
            disconnectedReasons: connections.filter(c => c.status !== 'connected').map(c => ({ id: c.id, status: c.status, error: c.lastError }))
          });
          
          this.diagnosticResults = `TOOL CHAIN ANALYSIS:
Raw Connections: ${connections.length}
Connected Servers: ${connectedServers.length} 
Raw MCP Tools: ${mcpTools.length}
Observable Tools: ${observableTools.length}
LLM Tools: ${llmTools.length}
Init Complete: ${initComplete}

See console for full details.`;
        });
      });
    }).catch(error => {
      console.error('🔍 ERROR in tool chain analysis:', error);
      this.diagnosticResults = `Tool chain analysis failed: ${error}`;
    });
  }

  async testManualToolsRequest() {
    console.log('🔧 MANUAL TOOLS REQUEST: Testing direct tools/list request...');
    alert('🔧 Manual Tools Request - Check console for results!');
    
    try {
      // Get the first connected server
      const connections = this.mcpService.getAllConnections();
      const connectedServer = connections.find(c => c.status === 'connected');
      
      if (!connectedServer) {
        console.error('🔧 No connected servers found');
        this.diagnosticResults = 'No connected servers to test';
        return;
      }
      
      console.log('🔧 Testing with server:', connectedServer.id);
      
      // Get server configuration
      const serverConfig = this.configService.getPredefinedMCPServers().find(s => s.id === connectedServer.id);
      
      if (!serverConfig) {
        console.error('🔧 Server configuration not found for:', connectedServer.id);
        this.diagnosticResults = 'Server configuration not found';
        return;
      }
      
      console.log('🔧 Server config:', serverConfig);
      
      // Make manual tools/list request using HttpClient directly
      const request = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/list'
      };
      
      // Try different header combinations to see what your server accepts
      const testHeaders = [
        // Test 1: Minimal headers
        {
          'Content-Type': 'application/json'
        },
        // Test 2: Only the auth header if present
        {
          'Content-Type': 'application/json',
          ...(serverConfig.connection.headers?.['Authorization'] ? { 'Authorization': serverConfig.connection.headers['Authorization'] } : {})
        },
        // Test 3: Standard MCP headers
        {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      ];

      console.log('🔧 Testing multiple header combinations...');
      
      // Test each header combination
      for (let i = 0; i < testHeaders.length; i++) {
        const headers = testHeaders[i];
        console.log(`🔧 Test ${i + 1} - Headers:`, headers);
        
        try {
          await this.testSingleRequest(serverConfig.connection.url!, request, headers, i + 1);
        } catch (error) {
          console.log(`🔧 Test ${i + 1} failed:`, error);
        }
      }
      
      this.diagnosticResults = 'Testing multiple header combinations - check console for results';
      
    } catch (error) {
      console.error('🔧 Manual test failed:', error);
      this.diagnosticResults = `Manual test failed: ${error}`;
    }
  }

  private testSingleRequest(url: string, request: any, headers: any, testNumber: number): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🔧 Test ${testNumber} - Making request to:`, url);
      console.log(`🔧 Test ${testNumber} - Request:`, request);
      console.log(`🔧 Test ${testNumber} - Headers:`, headers);

      this.http.post(url, request, { headers }).subscribe({
        next: (response) => {
          console.log(`🔧 Test ${testNumber} - SUCCESS! Response:`, response);
          console.log(`🔧 Test ${testNumber} - Tools found:`, (response as any)?.result?.tools?.length || 0);
          resolve();
        },
        error: (error) => {
          console.log(`🔧 Test ${testNumber} - FAILED with status:`, error.status, error.statusText);
          console.log(`🔧 Test ${testNumber} - Error details:`, error);
          reject(error);
        }
      });
    });
  }

  testServerConnectivity() {
    console.log('🌐 CONNECTIVITY TEST: Testing basic server connectivity...');
    alert('🌐 Testing server connectivity - check console!');

    const connections = this.mcpService.getAllConnections();
    const connectedServer = connections.find(c => c.status === 'connected');
    
    if (!connectedServer) {
      console.error('🌐 No connected servers found');
      this.diagnosticResults = 'No connected servers to test';
      return;
    }

    const serverConfig = this.configService.getPredefinedMCPServers().find(s => s.id === connectedServer.id);
    if (!serverConfig?.connection?.url) {
      console.error('🌐 No server URL found');
      this.diagnosticResults = 'No server URL found';
      return;
    }

    // Test 1: Basic GET request to see if server responds at all
    console.log('🌐 Test 1: Basic GET request...');
    this.http.get(serverConfig.connection.url).subscribe({
      next: (response) => {
        console.log('🌐 Test 1 SUCCESS - Server responds to GET:', response);
        this.testOptions(serverConfig.connection.url!);
      },
      error: (error) => {
        console.log('🌐 Test 1 FAILED - Server GET error:', error.status, error.statusText);
        this.testOptions(serverConfig.connection.url!);
      }
    });
  }

  private testOptions(url: string) {
    // Test 2: OPTIONS request to check CORS and allowed methods
    console.log('🌐 Test 2: OPTIONS request for CORS...');
    this.http.request('OPTIONS', url).subscribe({
      next: (response) => {
        console.log('🌐 Test 2 SUCCESS - OPTIONS response:', response);
      },
      error: (error) => {
        console.log('🌐 Test 2 FAILED - OPTIONS error:', error.status, error.statusText);
      }
    });

    // Test 3: Simple POST without JSON-RPC to see if it's the format
    console.log('🌐 Test 3: Simple POST test...');
    this.http.post(url, { test: 'connectivity' }, {
      headers: { 'Content-Type': 'application/json' }
    }).subscribe({
      next: (response) => {
        console.log('🌐 Test 3 SUCCESS - Simple POST works:', response);
      },
      error: (error) => {
        console.log('🌐 Test 3 FAILED - Simple POST error:', error.status, error.statusText);
        if (error.status !== 406) {
          console.log('🌐 Interesting: Simple POST gives different error than JSON-RPC');
        }
      }
    });
  }
}
