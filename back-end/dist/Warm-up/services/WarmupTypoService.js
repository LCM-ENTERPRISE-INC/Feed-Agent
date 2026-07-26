"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WarmupTypoService = void 0;
class WarmupTypoService {
    static TYPO_PROBABILITY = 0.05; // 5% chance of a typo
    static DELETE_PROBABILITY = 0.01; // 1% chance of deleting a message
    /**
     * Evaluates if a message should be deleted.
     */
    static shouldDelete() {
        return Math.random() < this.DELETE_PROBABILITY;
    }
    /**
     * Generates a typo in the message with a certain probability.
     * If a typo is generated, returns { text, correction }.
     * Otherwise returns { text: originalText }.
     */
    static generateTypo(text) {
        if (Math.random() > this.TYPO_PROBABILITY || text.length <= 3) {
            return { text }; // No typo
        }
        // Split text into words to pick a target word
        const words = text.split(' ');
        // Filter words that are at least 3 chars long
        const validWordIndices = words
            .map((w, i) => (w.length >= 3 ? i : -1))
            .filter((i) => i !== -1);
        if (validWordIndices.length === 0) {
            return { text };
        }
        // Pick a random word to mess up
        const targetIdx = validWordIndices[Math.floor(Math.random() * validWordIndices.length)];
        const targetWord = words[targetIdx];
        // Swap two adjacent characters in the middle of the word
        const swapPos = Math.floor(Math.random() * (targetWord.length - 2)) + 1;
        const chars = targetWord.split('');
        const temp = chars[swapPos];
        chars[swapPos] = chars[swapPos + 1];
        chars[swapPos + 1] = temp;
        const messedWord = chars.join('');
        // The correction is usually just the correct word prefixed with a star
        // We strip punctuation from the correction
        const cleanCorrectWord = targetWord.replace(/[.,!?]/g, '');
        const correction = `*${cleanCorrectWord}`;
        words[targetIdx] = messedWord;
        const typoText = words.join(' ');
        return { text: typoText, correction };
    }
}
exports.WarmupTypoService = WarmupTypoService;
