import { GoogleGenAI } from '@google/genai';
import logger from '../utils/logger';
import { AppError } from '../utils/AppError';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

/**
 * Interface representing the inference parameters for the Gemini model.
 */
export interface GeminiInferenceParams {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  format?: 'json';
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Service responsible for communicating with Google Gemini AI
 * to run inference on the models.
 */
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    if (!GEMINI_API_KEY) {
      logger.warn('[gemini-service]: GEMINI_API_KEY is not set. API calls will fail.');
    }
    
    // Initialize the Gemini client
    this.ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    logger.info(`[gemini-service]: Initialized with model ${DEFAULT_MODEL}`);
  }

  /**
   * Generates a completion from the Gemini model based on a prompt.
   *
   * @param prompt - The instruction/input text for the model.
   * @param systemPrompt - Optional system instructions (e.g. persona definition).
   * @param params - Optional inference parameters (temperature, max_tokens, etc).
   * @returns The generated response string.
   */
  async generateCompletion(prompt: string, systemPrompt?: string, params?: GeminiInferenceParams): Promise<string> {
    try {
      logger.info(`[gemini-service]: Sending prompt to ${DEFAULT_MODEL} model...`);

      const config: any = {
        temperature: params?.temperature ?? 0.3, // Lower temperature for more deterministic/factual outputs
        topP: params?.top_p ?? 0.9,
      };

      if (params?.max_tokens) {
        config.maxOutputTokens = params.max_tokens;
      }

      if (params?.format === 'json') {
        config.responseMimeType = 'application/json';
      }

      if (systemPrompt) {
        config.systemInstruction = systemPrompt;
      }

      const response = await this.ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: prompt,
        config: config
      });

      if (!response.text) {
        throw new AppError('Gemini API returned an empty response', 502);
      }

      logger.info('[gemini-service]: Received completion from model.');
      return response.text;

    } catch (error: any) {
      logger.error(`[gemini-service]: Failed to generate completion - ${error.message}`);
      throw new AppError(`AI Generation Error: ${error.message}`, 500);
    }
  }

  /**
   * Pings the service to check if it's healthy.
   * Since this is a cloud API, we can just return true, or do a tiny completion.
   * For simplicity and to save quota, we just assume it's up if we have an API key.
   */
  async checkHealth(): Promise<boolean> {
    return !!GEMINI_API_KEY;
  }
}

export default new GeminiService();
