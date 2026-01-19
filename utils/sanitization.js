// ============================================================================
// UTILS/SANITIZATION.JS - Shared HTML Sanitization
// ============================================================================

const sanitizeHtml = require('sanitize-html');

/**
 * Sanitize HTML content for rich text fields
 * Allows standard formatting tags but strips scripts, iframes, etc.
 * @param {string} dirty - The HTML string to sanitize
 * @returns {string} Clean HTML string
 */
const sanitizeContent = (dirty) => {
    if (!dirty) return dirty;

    return sanitizeHtml(dirty, {
        allowedTags: [
            'address', 'article', 'aside', 'footer', 'header', 'h1', 'h2', 'h3', 'h4',
            'h5', 'h6', 'hgroup', 'main', 'nav', 'section', 'blockquote', 'dd', 'div',
            'dl', 'dt', 'figcaption', 'figure', 'hr', 'li', 'main', 'ol', 'p', 'pre',
            'ul', 'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn',
            'em', 'i', 'kbd', 'mark', 'q', 'rb', 'rp', 'rt', 'rtc', 'ruby', 's', 'samp',
            'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'caption',
            'col', 'colgroup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr'
        ],
        allowedAttributes: {
            a: ['href', 'name', 'target'],
            img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading'],
            '*': ['class', 'id', 'style'] // Careful with style, but needed for some rich text editors
        },
        selfClosing: ['img', 'br', 'hr', 'area', 'base', 'basefont', 'input', 'link', 'meta'],
        allowedSchemes: ['http', 'https', 'ftp', 'mailto', 'tel'],
        allowedSchemesByTag: {},
        allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
        allowProtocolRelative: true,
        enforceHtmlBoundary: false
    });
};

/**
 * Strip ALL HTML tags (plain text only)
 * @param {string} dirty 
 * @returns {string}
 */
const stripHtml = (dirty) => {
    if (!dirty) return dirty;
    return sanitizeHtml(dirty, {
        allowedTags: [],
        allowedAttributes: {}
    });
};

module.exports = {
    sanitizeContent,
    stripHtml
};
