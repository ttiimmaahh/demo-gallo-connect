# Gallo Connect Chatbot - LLM Integration Guide

## Overview

The Gallo Connect chatbot now supports multiple LLM (Large Language Model) providers, allowing you to switch between local and cloud-based AI services seamlessly.

## Supported Providers

### 1. Local LLM (Ollama)
- **Type**: Local hosting
- **Cost**: Free (after initial setup)
- **Privacy**: Complete data privacy
- **Requirements**: Local Ollama installation

### 2. OpenAI ChatGPT
- **Type**: Cloud service
- **Cost**: Pay per token
- **Models**: GPT-3.5 Turbo, GPT-4, GPT-4 Turbo
- **Requirements**: OpenAI API key

### 3. Google Gemini
- **Type**: Cloud service
- **Cost**: Pay per token (generous free tier)
- **Models**: Gemini Pro, Gemini Pro Vision
- **Requirements**: Google AI API key

### 4. Built-in Assistant (Fallback)
- **Type**: Rule-based responses
- **Cost**: Free
- **Privacy**: Complete privacy
- **Capabilities**: Basic customer service responses

## Quick Start

### 1. Using Built-in Assistant (Default)
The chatbot works out of the box with smart rule-based responses. No configuration needed.

### 2. Setting up Local LLM (Ollama)

#### Install Ollama
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Windows
# Download from https://ollama.ai/download
```

#### Start Ollama and install a model
```bash
# Start Ollama service
ollama serve

# Install a model (in another terminal)
ollama pull llama2
# or
ollama pull mistral
# or
ollama pull codellama
```

#### Configure in Chatbot
1. Click the gear icon (⚙️) in the chatbot header
2. Select "Local LLM (Ollama)" as provider
3. Set API URL: `http://localhost:11434`
4. Set Model: `llama2` (or your preferred model)
5. Adjust temperature and max tokens as needed
6. Click "Save Configuration"

### 3. Setting up OpenAI ChatGPT

#### Get API Key
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key (starts with `sk-`)

#### Configure in Chatbot
1. Click the gear icon (⚙️) in the chatbot header
2. Select "OpenAI ChatGPT" as provider
3. Enter your API key
4. Choose model (GPT-3.5 Turbo recommended for cost efficiency)
5. Adjust temperature and max tokens
6. Click "Save Configuration"

### 4. Setting up Google Gemini

#### Get API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key

#### Configure in Chatbot
1. Click the gear icon (⚙️) in the chatbot header
2. Select "Google Gemini" as provider
3. Enter your API key
4. Choose model (Gemini Pro recommended)
5. Adjust temperature and max tokens
6. Click "Save Configuration"

## Configuration Options

### Temperature (0.0 - 1.0)
- **0.0**: Very deterministic, consistent responses
- **0.7**: Balanced creativity and consistency (recommended)
- **1.0**: Maximum creativity, more varied responses

### Max Tokens (100 - 4000)
- Controls response length
- Higher values allow longer responses but cost more
- **1000** is recommended for most use cases

## Provider Comparison

| Feature | Built-in | Local LLM | OpenAI | Gemini |
|---------|----------|-----------|--------|--------|
| Cost | Free | Free* | $$ | $* |
| Privacy | ✓ | ✓ | ✗ | ✗ |
| Setup Complexity | None | Medium | Easy | Easy |
| Response Quality | Basic | Good | Excellent | Excellent |
| Offline Support | ✓ | ✓ | ✗ | ✗ |

*Free after initial setup/infrastructure costs

## Troubleshooting

### Local LLM Issues
- **Connection Failed**: Ensure Ollama is running (`ollama serve`)
- **Model Not Found**: Install the model (`ollama pull model-name`)
- **Slow Responses**: Normal for local inference, consider smaller models

### OpenAI Issues
- **API Key Invalid**: Check your API key and account status
- **Rate Limited**: You've exceeded your usage limits
- **Connection Error**: Check internet connection

### Gemini Issues
- **API Key Invalid**: Verify your Google AI API key
- **Quota Exceeded**: Check your usage quotas in Google Cloud Console

### General Issues
- **No Response**: Check if provider is properly configured
- **Error Messages**: The chatbot will fallback to built-in responses
- **Configuration Not Saving**: Ensure all required fields are filled

## Best Practices

### Cost Management
1. Start with local LLM or Gemini (generous free tier)
2. Monitor usage in cloud provider dashboards
3. Set usage alerts in your cloud provider console
4. Use lower max token limits for cost efficiency

### Privacy Considerations
1. Use local LLM for sensitive customer data
2. Be aware that cloud providers may store conversation data
3. Review privacy policies of cloud providers
4. Consider implementing data sanitization before sending to cloud APIs

### Performance Optimization
1. Local LLM: Use smaller models for faster responses
2. Cloud APIs: Implement request timeouts
3. All providers: Enable fallback to built-in responses
4. Monitor response times and adjust accordingly

## Advanced Configuration

### Environment Variables
You can set default configurations using environment variables:

```bash
# Default provider
CHATBOT_DEFAULT_PROVIDER=local

# Local LLM
CHATBOT_LOCAL_URL=http://localhost:11434
CHATBOT_LOCAL_MODEL=llama2

# OpenAI
CHATBOT_OPENAI_KEY=your-api-key
CHATBOT_OPENAI_MODEL=gpt-3.5-turbo

# Gemini
CHATBOT_GEMINI_KEY=your-api-key
CHATBOT_GEMINI_MODEL=gemini-pro
```

### Custom Provider Integration
The system is designed to be extensible. You can add new providers by:

1. Implementing the `LLMProvider` interface
2. Adding the provider to the `LLMService`
3. Updating the configuration component

See the existing provider implementations for reference.

## Support

For technical issues or questions:
- Check the browser console for error messages
- Verify provider API status pages
- Test connection using the "Test Connection" button
- Contact support at support@galloconnect.com
