"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsGeneratorService = void 0;
const LlamaService_1 = __importDefault(require("./LlamaService"));
const promptBuilder_1 = require("../utils/promptBuilder");
const logger_1 = __importDefault(require("../utils/logger"));
const AppError_1 = require("../utils/AppError");
const redisClient_1 = __importDefault(require("../utils/redisClient"));
const crypto_1 = __importDefault(require("crypto"));
class NewsGeneratorService {
    MAX_CHARS_PER_CHUNK = 15000;
    CACHE_TTL_SECONDS = 86400; // 24 hours
    /**
     * Generates a structured news article from raw OCR text.
     * Employs caching, chunking for large texts, and a retry loop.
     *
     * @param ocrText - Cleaned text from OcrService
     * @param maxRetries - Number of times to retry generation if JSON is invalid
     */
    async generateNewsFromOcr(ocrText, maxRetries = 2) {
        const textHash = crypto_1.default.createHash('sha256').update(ocrText).digest('hex');
        const cacheKey = `news_gen_${textHash}`;
        // 1. Check Cache
        const cachedResponse = await redisClient_1.default.get(cacheKey);
        if (cachedResponse) {
            logger_1.default.info(`[news-generator]: Cache hit for hash ${textHash.substring(0, 8)}`);
            return JSON.parse(cachedResponse);
        }
        // 2. Handle large texts (Chunking)
        if (ocrText.length > this.MAX_CHARS_PER_CHUNK) {
            logger_1.default.info(`[news-generator]: Text too large (${ocrText.length} chars). Splitting into chunks.`);
            return this.processInChunks(ocrText, maxRetries, cacheKey);
        }
        // 3. Normal Generation
        const article = await this.generateSingleChunk(ocrText, maxRetries);
        // 4. Save to Cache
        await redisClient_1.default.setex(cacheKey, this.CACHE_TTL_SECONDS, JSON.stringify(article));
        return article;
    }
    /**
     * Generates a draft based on custom instructions, tone, and length.
     * Does NOT use cache because of the highly variable nature of custom prompts.
     */
    async generateCustomDraft(sourceText, tone, length, instructions, sourceLabel) {
        const customSystemPrompt = `Você é um jornalista de IA avançado escrevendo no formato JSON.
Formato de saída obrigatório:
{
  "titulo": "Título da notícia",
  "resumo": "Corpo/Resumo da notícia gerada aqui.",
  "fonte": "${sourceLabel}"
}
Regras:
1. Retorne APENAS um JSON válido. Não inclua Markdown, não inclua "Aqui está o resumo:" etc.
2. O tom do texto deve ser: ${tone}.
3. O tamanho máximo do resumo gerado deve ser de: ${length} caracteres. Seja estrito com esse limite de tamanho.
4. Siga ESTRITAMENTE as seguintes instruções do usuário:
   "${instructions}"`;
        let textToAnalyze = sourceText;
        if (sourceText.length > this.MAX_CHARS_PER_CHUNK) {
            textToAnalyze = sourceText.substring(0, this.MAX_CHARS_PER_CHUNK); // Truncate to avoid context window explosion on custom queries
            logger_1.default.warn(`[news-generator]: Custom draft source text truncated from ${sourceText.length} to ${this.MAX_CHARS_PER_CHUNK} chars.`);
        }
        const userPrompt = `Baseado no texto a seguir, gere a minuta da notícia seguindo as instruções dadas no prompt do sistema.\n\nTEXTO FONTE:\n${textToAnalyze}`;
        const maxRetries = 2;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger_1.default.info(`[news-generator]: Requesting custom LLM generation (Attempt ${attempt}/${maxRetries})...`);
                const responseText = await LlamaService_1.default.generateCompletion(userPrompt, customSystemPrompt, { format: 'json', temperature: 0.2 });
                return this.parseAndValidateResponse(responseText);
            }
            catch (error) {
                logger_1.default.warn(`[news-generator]: Custom Draft Attempt ${attempt} failed: ${error.message}`);
                if (attempt === maxRetries) {
                    logger_1.default.error(`[news-generator]: Exhausted all retries for custom JSON generation.`);
                    throw new AppError_1.AppError('A IA não conseguiu gerar uma minuta estruturada válida após várias tentativas.', 500);
                }
            }
        }
        throw new AppError_1.AppError('Falha catastrófica no gerador de notícias.', 500);
    }
    async processInChunks(text, maxRetries, cacheKey) {
        const chunks = [];
        for (let i = 0; i < text.length; i += this.MAX_CHARS_PER_CHUNK) {
            chunks.push(text.substring(i, i + this.MAX_CHARS_PER_CHUNK));
        }
        logger_1.default.info(`[news-generator]: Created ${chunks.length} chunks for processing.`);
        const processedChunks = [];
        for (const chunk of chunks) {
            const result = await this.generateSingleChunk(chunk, maxRetries);
            processedChunks.push(result);
        }
        // Combine results
        const combinedArticle = {
            titulo: processedChunks[0].titulo, // Keep the title from the first (most important) chunk
            fonte: processedChunks[0].fonte,
            resumo: processedChunks.map(c => c.resumo).join('\n\n---\n\n'), // Merge summaries
        };
        await redisClient_1.default.setex(cacheKey, this.CACHE_TTL_SECONDS, JSON.stringify(combinedArticle));
        return combinedArticle;
    }
    async generateSingleChunk(ocrText, maxRetries) {
        const prompt = (0, promptBuilder_1.buildNewsPrompt)(ocrText);
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger_1.default.info(`[news-generator]: Requesting LLM generation (Attempt ${attempt}/${maxRetries})...`);
                const responseText = await LlamaService_1.default.generateCompletion(prompt, promptBuilder_1.NEWS_SYSTEM_PROMPT, { format: 'json', temperature: 0.2 } // Extremely low temp to force strict compliance
                );
                return this.parseAndValidateResponse(responseText);
            }
            catch (error) {
                logger_1.default.warn(`[news-generator]: Attempt ${attempt} failed: ${error.message}`);
                if (attempt === maxRetries) {
                    logger_1.default.error(`[news-generator]: Exhausted all retries for JSON generation.`);
                    throw new AppError_1.AppError('A IA não conseguiu gerar um resumo estruturado válido após várias tentativas.', 500);
                }
            }
        }
        throw new AppError_1.AppError('Falha catastrófica no gerador de notícias.', 500);
    }
    /**
     * Safely parses and validates the JSON returned by the LLM.
     */
    parseAndValidateResponse(responseText) {
        let parsed;
        try {
            // Sometimes models wrap JSON in markdown blocks even when instructed not to
            const cleanedJsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            parsed = JSON.parse(cleanedJsonText);
        }
        catch (err) {
            throw new Error(`Invalid JSON syntax from LLM: ${responseText}`);
        }
        if (!parsed.titulo || typeof parsed.titulo !== 'string') {
            throw new Error('Missing or invalid "titulo" field in LLM response.');
        }
        if (!parsed.resumo || typeof parsed.resumo !== 'string') {
            throw new Error('Missing or invalid "resumo" field in LLM response.');
        }
        if (!parsed.fonte || typeof parsed.fonte !== 'string') {
            throw new Error('Missing or invalid "fonte" field in LLM response.');
        }
        return {
            titulo: parsed.titulo.trim(),
            resumo: parsed.resumo.trim(),
            fonte: parsed.fonte.trim(),
        };
    }
}
exports.NewsGeneratorService = NewsGeneratorService;
exports.default = new NewsGeneratorService();
