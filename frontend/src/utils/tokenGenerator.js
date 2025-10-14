/**
 * Utility functions for generating unique tokens for survey sharing
 */

/**
 * Generates a unique token for survey sharing
 * Each call will generate a different token, even for the same survey
 * @returns {string} A unique token string
 */
export const generateUniqueToken = () => {
    // Combine random string with timestamp and additional entropy
    const randomPart = Math.random().toString(36).slice(2, 15);
    const timestamp = Date.now().toString(36);
    const entropy = Math.random().toString(36).slice(2, 8);

    return `${randomPart}_${timestamp}_${entropy}`;
};

/**
 * Generates a token with a specific prefix (useful for different token types)
 * @param {string} prefix - Prefix for the token
 * @returns {string} A unique token with the specified prefix
 */
export const generatePrefixedToken = (prefix = 'survey') => {
    const uniqueToken = generateUniqueToken();
    return `${prefix}_${uniqueToken}`;
};

/**
 * Validates if a token has the correct format
 * @param {string} token - Token to validate
 * @returns {boolean} True if token format is valid
 */
export const isValidTokenFormat = (token) => {
    if (!token || typeof token !== 'string') return false;

    // Check if token has the expected format (3 parts separated by underscores)
    const parts = token.split('_');
    return parts.length >= 3;
};

/**
 * Extracts timestamp from token (if available)
 * @param {string} token - Token to extract timestamp from
 * @returns {number|null} Timestamp or null if not available
 */
export const extractTokenTimestamp = (token) => {
    try {
        const parts = token.split('_');
        if (parts.length >= 2) {
            const timestampStr = parts[1];
            return parseInt(timestampStr, 36);
        }
    } catch (error) {
        console.warn('Error extracting timestamp from token:', error);
    }
    return null;
};
