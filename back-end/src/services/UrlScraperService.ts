import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../utils/logger';

export class UrlScraperService {
  /**
   * Fetches a URL and extracts clean, readable text from the HTML body.
   */
  async extractTextFromUrl(url: string): Promise<string> {
    try {
      logger.info(`[url-scraper]: Fetching content from URL: ${url}`);
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        },
        timeout: 10000 // 10 seconds timeout
      });

      const html = response.data;
      const $ = cheerio.load(html);

      // Remove non-content elements
      $('script, style, noscript, nav, header, footer, iframe, svg, img').remove();

      // Extract text from the remaining body
      let text = $('body').text();

      // Clean up whitespace: replace multiple spaces/newlines with a single space or newline
      text = text.replace(/\s\s+/g, ' ').trim();

      if (!text) {
        throw new Error('No readable text found on the page.');
      }

      logger.info(`[url-scraper]: Successfully extracted ${text.length} characters from URL.`);
      return text;
    } catch (error: any) {
      logger.error(`[url-scraper]: Failed to extract text from URL ${url} - ${error.message}`);
      throw new Error(`Não foi possível acessar ou extrair texto da URL: ${error.message}`);
    }
  }
}

export default new UrlScraperService();
