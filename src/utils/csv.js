/**
 * RFC 4180 CSV helpers.
 * Fields that contain a comma, quote, CR, or LF are wrapped in quotes,
 * and embedded quotes are doubled. Null and undefined become empty fields.
 */

export function escapeCsvField(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/** Always quote a field, doubling any embedded quotes. */
export function quoteCsvField(value) {
    const str = value === null || value === undefined ? '' : String(value);
    return `"${str.replace(/"/g, '""')}"`;
}

function csvCell(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : '';
    }
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

/**
 * Build an RFC 4180 CSV document (CRLF line endings, trailing newline).
 * `rows` are objects keyed by `columns`. Nested objects and arrays are
 * JSON-encoded inside a single field.
 */
export function buildCsv(columns, rows) {
    const lines = [columns.map((column) => escapeCsvField(column)).join(',')];
    for (const row of rows) {
        lines.push(columns.map((column) => escapeCsvField(csvCell(row[column]))).join(','));
    }
    return `${lines.join('\r\n')}\r\n`;
}
