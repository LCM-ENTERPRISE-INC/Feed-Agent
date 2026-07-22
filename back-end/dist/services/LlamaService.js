"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlamaService = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logger_1 = __importDefault(require("../utils/logger"));
const AppError_1 = require("../utils/AppError");
class LlamaService {
    llama;
    model;
    context;
    isInitialized = false;
    initPromise = null;
    grammarJson = null;
    LlamaChatSessionClass = null;
    constructor() {
        const modelDir = process.env.MODELS_DIR || path_1.default.join(process.cwd(), 'models');
        const modelName = process.env.LLAMA_MODEL_FILE || 'llama3-8b.gguf';
        const modelPath = path_1.default.join(modelDir, modelName);
        // Initialize async in constructor without blocking
        this.initPromise = this.initialize(modelPath).catch(err => {
            logger_1.default.error(`[llama-service]: Failed to initialize native model: ${err.message}`);
        });
    }
    async initialize(modelPath) {
        logger_1.default.info(`[llama-service]: Initializing native node-llama-cpp using model: ${modelPath}`);
        if (!fs_1.default.existsSync(modelPath)) {
            throw new Error(`Model file not found at ${modelPath}. Please download a .gguf file.`);
        }
        try {
            // Use dynamic import to avoid ERR_REQUIRE_ASYNC_MODULE in CommonJS for ESM modules
            const { getLlama, LlamaChatSession } = await eval("import('node-llama-cpp')");
            this.LlamaChatSessionClass = LlamaChatSession;
            this.llama = await getLlama();
            this.model = await this.llama.loadModel({ modelPath });
            // Calculate context size dynamically or use default
            this.context = await this.model.createContext({
                contextSize: 4096, // Safe default for summarizing articles
                threads: 4 // Adjust based on CPU
            });
            this.grammarJson = await this.llama.getGrammarFor("json");
            this.isInitialized = true;
            logger_1.default.info(`[llama-service]: Successfully loaded model and created context in-memory.`);
        }
        catch (error) {
            throw new Error(`Native Llama init failed: ${error.message}`);
        }
    }
    async generateCompletion(prompt, systemPrompt, params) {
        if (this.initPromise && !this.isInitialized) {
            logger_1.default.info(`[llama-service]: Waiting for model initialization...`);
            await this.initPromise;
        }
        if (!this.isInitialized) {
            throw new AppError_1.AppError('Llama Service is not initialized due to missing model or memory error.', 500);
        }
        try {
            logger_1.default.info(`[llama-service]: Running native inference...`);
            // Create a fresh session for each request, but share the context memory pool
            const session = new this.LlamaChatSessionClass({
                contextSequence: this.context.getSequence(),
                systemPrompt: systemPrompt
            });
            const generationParams = {
                temperature: params?.temperature ?? 0.3,
                topP: params?.top_p ?? 0.9,
                maxTokens: params?.max_tokens ?? 2048,
            };
            if (params?.format === 'json' && this.grammarJson) {
                generationParams.grammar = this.grammarJson;
            }
            // Generate response natively (this is CPU intensive)
            const response = await session.prompt(prompt, generationParams);
            logger_1.default.info('[llama-service]: Native completion finished.');
            return response;
        }
        catch (error) {
            logger_1.default.error(`[llama-service]: Inference failed - ${error.message}`);
            throw new AppError_1.AppError(`AI Generation Error: ${error.message}`, 500);
        }
    }
    async checkHealth() {
        return this.isInitialized;
    }
}
exports.LlamaService = LlamaService;
exports.default = new LlamaService();
