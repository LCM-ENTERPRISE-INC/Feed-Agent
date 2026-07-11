import path from 'path';
import fs from 'fs';
import { getLlama, LlamaChatSession } from 'node-llama-cpp';
import logger from '../utils/logger';
import { AppError } from '../utils/AppError';

export interface LlamaInferenceParams {
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  format?: 'json';
}

export class LlamaService {
  private llama: any;
  private model: any;
  private context: any;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private grammarJson: any = null;

  constructor() {
    const modelDir = process.env.MODELS_DIR || path.join(process.cwd(), 'models');
    const modelName = process.env.LLAMA_MODEL_FILE || 'llama3-8b.gguf';
    const modelPath = path.join(modelDir, modelName);

    // Initialize async in constructor without blocking
    this.initPromise = this.initialize(modelPath).catch(err => {
      logger.error(`[llama-service]: Failed to initialize native model: ${err.message}`);
    });
  }

  private async initialize(modelPath: string) {
    logger.info(`[llama-service]: Initializing native node-llama-cpp using model: ${modelPath}`);

    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model file not found at ${modelPath}. Please download a .gguf file.`);
    }

    try {
      this.llama = await getLlama();
      this.model = await this.llama.loadModel({ modelPath });
      
      // Calculate context size dynamically or use default
      this.context = await this.model.createContext({
        contextSize: 4096, // Safe default for summarizing articles
        threads: 4 // Adjust based on CPU
      });

      this.grammarJson = await this.llama.getGrammarFor("json");

      this.isInitialized = true;
      logger.info(`[llama-service]: Successfully loaded model and created context in-memory.`);
    } catch (error: any) {
      throw new Error(`Native Llama init failed: ${error.message}`);
    }
  }

  async generateCompletion(prompt: string, systemPrompt?: string, params?: LlamaInferenceParams): Promise<string> {
    if (this.initPromise && !this.isInitialized) {
      logger.info(`[llama-service]: Waiting for model initialization...`);
      await this.initPromise;
    }

    if (!this.isInitialized) {
      throw new AppError('Llama Service is not initialized due to missing model or memory error.', 500);
    }

    try {
      logger.info(`[llama-service]: Running native inference...`);

      // Create a fresh session for each request, but share the context memory pool
      const session = new LlamaChatSession({ 
        contextSequence: this.context.getSequence(),
        systemPrompt: systemPrompt
      });

      const generationParams: any = {
        temperature: params?.temperature ?? 0.3,
        topP: params?.top_p ?? 0.9,
        maxTokens: params?.max_tokens ?? 2048,
      };

      if (params?.format === 'json' && this.grammarJson) {
        generationParams.grammar = this.grammarJson;
      }

      // Generate response natively (this is CPU intensive)
      const response = await session.prompt(prompt, generationParams);

      logger.info('[llama-service]: Native completion finished.');
      return response;

    } catch (error: any) {
      logger.error(`[llama-service]: Inference failed - ${error.message}`);
      throw new AppError(`AI Generation Error: ${error.message}`, 500);
    }
  }

  async checkHealth(): Promise<boolean> {
    return this.isInitialized;
  }
}

export default new LlamaService();
