"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UrlScraperService = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const logger_1 = __importDefault(require("../utils/logger"));
class UrlScraperService {
    /**
     * Fetches a URL and extracts clean, readable text from the HTML body.
     */
    async extractTextFromUrl(url) {
        try {
            logger_1.default.info(`[url-scraper]: Fetching content from URL: ${url}`);
            const response = await axios_1.default.get(url, {
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
            logger_1.default.info(`[url-scraper]: Successfully extracted ${text.length} characters from URL.`);
            return text;
        }
        catch (error) {
            logger_1.default.error(`[url-scraper]: Failed to extract text from URL ${url} - ${error.message}`);
            throw new Error(`Não foi possível acessar ou extrair texto da URL: ${error.message}`);
        }
    }
}
exports.UrlScraperService = UrlScraperService;
exports.default = new UrlScraperService();
