import geminiService from './GeminiService';
import { NEWS_SYSTEM_PROMPT, buildNewsPrompt } from '../utils/promptBuilder';
import logger from '../utils/logger';
import { AppError } from '../utils/AppError';
import redisClient from '../utils/redisClient';
import crypto from 'crypto';

export interface NewsArticleJSON {
  titulo: string;
  resumo: string;
  fonte: string;
}

export class NewsGeneratorService {
  private readonly MAX_CHARS_PER_CHUNK = 15000;
  private readonly CACHE_TTL_SECONDS = 86400; // 24 hours

  /**
   * Generates a structured news article from raw OCR text.
   * Employs caching, chunking for large texts, and a retry loop.
   *
   * @param ocrText - Cleaned text from OcrService
   * @param maxRetries - Number of times to retry generation if JSON is invalid
   */
  async generateNewsFromOcr(ocrText: string, maxRetries = 2): Promise<NewsArticleJSON> {
    const textHash = crypto.createHash('sha256').update(ocrText).digest('hex');
    const cacheKey = `news_gen_${textHash}`;

    // 1. Check Cache
    const cachedResponse = await redisClient.get(cacheKey);
    if (cachedResponse) {
      logger.info(`[news-generator]: Cache hit for hash ${textHash.substring(0, 8)}`);
      return JSON.parse(cachedResponse);
    }

    // 2. Handle large texts (Chunking)
    if (ocrText.length > this.MAX_CHARS_PER_CHUNK) {
      logger.info(`[news-generator]: Text too large (${ocrText.length} chars). Splitting into chunks.`);
      return this.processInChunks(ocrText, maxRetries, cacheKey);
    }

    // 3. Normal Generation
    const article = await this.generateSingleChunk(ocrText, maxRetries);

    // 4. Save to Cache
    await redisClient.setex(cacheKey, this.CACHE_TTL_SECONDS, JSON.stringify(article));

    return article;
  }

  /**
   * Generates a draft based on custom instructions, tone, and length.
   * Does NOT use cache because of the highly variable nature of custom prompts.
   */
  async generateCustomDraft(sourceText: string, tone: string, length: number | string, instructions: string, sourceLabel: string): Promise<NewsArticleJSON> {
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
       logger.warn(`[news-generator]: Custom draft source text truncated from ${sourceText.length} to ${this.MAX_CHARS_PER_CHUNK} chars.`);
    }

    const userPrompt = `Baseado no texto a seguir, gere a minuta da notícia seguindo as instruções dadas no prompt do sistema.\n\nTEXTO FONTE:\n${textToAnalyze}`;

    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`[news-generator]: Requesting custom LLM generation (Attempt ${attempt}/${maxRetries})...`);
        
        const responseText = await geminiService.generateCompletion(
          userPrompt,
          customSystemPrompt,
          { format: 'json', temperature: 0.2 }
        );

        return this.parseAndValidateResponse(responseText);

      } catch (error: any) {
        logger.warn(`[news-generator]: Custom Draft Attempt ${attempt} failed: ${error.message}`);
        
        if (attempt === maxRetries) {
          logger.error(`[news-generator]: Exhausted all retries for custom JSON generation.`);
          throw new AppError('A IA não conseguiu gerar uma minuta estruturada válida após várias tentativas.', 500);
        }
      }
    }

    throw new AppError('Falha catastrófica no gerador de notícias.', 500);
  }

  private async processInChunks(text: string, maxRetries: number, cacheKey: string): Promise<NewsArticleJSON> {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += this.MAX_CHARS_PER_CHUNK) {
      chunks.push(text.substring(i, i + this.MAX_CHARS_PER_CHUNK));
    }

    logger.info(`[news-generator]: Created ${chunks.length} chunks for processing.`);
    const processedChunks: NewsArticleJSON[] = [];

    for (const chunk of chunks) {
      const result = await this.generateSingleChunk(chunk, maxRetries);
      processedChunks.push(result);
    }

    // Combine results
    const combinedArticle: NewsArticleJSON = {
      titulo: processedChunks[0].titulo, // Keep the title from the first (most important) chunk
      fonte: processedChunks[0].fonte,
      resumo: processedChunks.map(c => c.resumo).join('\n\n---\n\n'), // Merge summaries
    };

    await redisClient.setex(cacheKey, this.CACHE_TTL_SECONDS, JSON.stringify(combinedArticle));
    return combinedArticle;
  }

  private async generateSingleChunk(ocrText: string, maxRetries: number): Promise<NewsArticleJSON> {
    const prompt = buildNewsPrompt(ocrText);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`[news-generator]: Requesting LLM generation (Attempt ${attempt}/${maxRetries})...`);
        
        const responseText = await geminiService.generateCompletion(
          prompt,
          NEWS_SYSTEM_PROMPT,
          { format: 'json', temperature: 0.2 } // Extremely low temp to force strict compliance
        );

        return this.parseAndValidateResponse(responseText);

      } catch (error: any) {
        logger.warn(`[news-generator]: Attempt ${attempt} failed: ${error.message}`);
        
        if (attempt === maxRetries) {
          logger.error(`[news-generator]: Exhausted all retries for JSON generation.`);
          throw new AppError('A IA não conseguiu gerar um resumo estruturado válido após várias tentativas.', 500);
        }
      }
    }

    throw new AppError('Falha catastrófica no gerador de notícias.', 500);
  }

  /**
   * Safely parses and validates the JSON returned by the LLM.
   */
  private parseAndValidateResponse(responseText: string): NewsArticleJSON {
    let parsed: any;
    
    try {
      // Sometimes models wrap JSON in markdown blocks even when instructed not to
      const cleanedJsonText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanedJsonText);
    } catch (err) {
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

export default new NewsGeneratorService();
