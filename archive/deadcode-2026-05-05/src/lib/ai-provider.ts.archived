/**
 * Low-level AI provider wrapper
 * Handles communication with OpenAI and Anthropic APIs
 */

import type { AISettings } from './types'

export interface AIProviderRequest {
  system: string
  user: string
  settings: AISettings
}

export interface AIProviderResponse {
  text: string
  provider: 'openai' | 'anthropic'
  model: string
}

/**
 * Call AI provider with system and user prompts
 */
export async function callAIProvider(
  request: AIProviderRequest
): Promise<AIProviderResponse> {
  const { system, user, settings } = request
  const provider = settings.provider
  const apiKey = provider === 'openai' ? settings.openaiKey : settings.anthropicKey
  const model = provider === 'openai' ? settings.openaiModel : settings.anthropicModel

  if (!apiKey || !apiKey.trim()) {
    throw new Error(
      `${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API key not configured`
    )
  }

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider,
        model,
        apiKey: apiKey.trim(),
        system,
        user,
      }),
    })

    if (!response.ok) {
      let errorMessage = `AI request failed (${response.status})`
      try {
        const errorData = await response.json()
        if (errorData.error) {
          errorMessage = errorData.error
        }
      } catch {
        // Ignore JSON parse errors
      }
      throw new Error(errorMessage)
    }

    const data = await response.json()

    return {
      text: data.text || '',
      provider,
      model: data.model || model,
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`AI provider error: ${error.message}`)
    }
    throw new Error('Unknown AI provider error')
  }
}

/**
 * Call OpenAI specifically
 */
export async function callOpenAI(
  system: string,
  user: string,
  apiKey: string,
  model: string = 'gpt-4o-mini'
): Promise<string> {
  const response = await callAIProvider({
    system,
    user,
    settings: {
      provider: 'openai',
      openaiKey: apiKey,
      anthropicKey: '',
      openaiModel: model,
      anthropicModel: '',
    },
  })
  return response.text
}

/**
 * Call Anthropic specifically
 */
export async function callAnthropic(
  system: string,
  user: string,
  apiKey: string,
  model: string = 'claude-3-5-sonnet-latest'
): Promise<string> {
  const response = await callAIProvider({
    system,
    user,
    settings: {
      provider: 'anthropic',
      openaiKey: '',
      anthropicKey: apiKey,
      openaiModel: '',
      anthropicModel: model,
    },
  })
  return response.text
}