/**
 * Read-only Firestore export for the one-time migration importer.
 * Collections are loaded with getDocs. Documents are never created, updated, or removed.
 */
import { collection, documentId, getDocs, limit, orderBy, query, startAfter } from 'firebase/firestore';
import { buildCsv } from './csv.js';

export const MIGRATION_COLLECTIONS = [
    'items',
    'checkoutHistory',
    'archivedCheckouts',
    'inventoryLogs',
    'costAllocation'
];

/** Page size for reads. The loop continues until a short page, so this is not a cap. */
export const MIGRATION_PAGE_SIZE = 500;

function isFirestoreTimestamp(value) {
    if (!value || typeof value !== 'object') return false;
    if (typeof value.toDate !== 'function') return false;
    return typeof value.toMillis === 'function'
        || (typeof value.seconds === 'number' && typeof value.nanoseconds === 'number');
}

/**
 * Convert Firestore values into JSON-safe data.
 * Timestamps (including nested ones) become ISO-8601 strings.
 * Field names are left unchanged.
 */
export function serializeFirestoreValue(value) {
    if (value === null || value === undefined) return null;
    if (isFirestoreTimestamp(value)) {
        const date = value.toDate();
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
            throw new Error('Firestore timestamp could not be converted to a date');
        }
        return date.toISOString();
    }
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        return value.toISOString();
    }
    if (Array.isArray(value)) {
        return value.map((entry) => serializeFirestoreValue(entry));
    }
    if (typeof value === 'object') {
        if (value.type === 'document' && typeof value.path === 'string') {
            return value.path;
        }
        const out = {};
        for (const [key, entry] of Object.entries(value)) {
            out[key] = serializeFirestoreValue(entry);
        }
        return out;
    }
    return value;
}

/**
 * Walk every page a caller returns. `fetchPage(cursor)` receives null for the
 * first page and the previous page's cursor afterwards. A page shorter than
 * `pageSize` ends the read. A cursor that repeats is treated as a stalled read.
 */
export async function collectPages(fetchPage) {
    const all = [];
    let cursor = null;
    const seenCursors = new Set();

    for (;;) {
        const page = await fetchPage(cursor);
        const docs = page.docs || [];
        all.push(...docs);

        const pageSize = page.pageSize;
        if (!pageSize || docs.length < pageSize || page.cursor == null) break;

        const cursorKey = typeof page.cursor === 'string'
            ? page.cursor
            : (page.cursor.id ?? String(page.cursor));
        if (seenCursors.has(cursorKey)) {
            throw new Error('Pagination cursor did not advance');
        }
        seenCursors.add(cursorKey);
        cursor = page.cursor;
    }

    return all;
}

/**
 * Read every document in a collection, ordered by document id.
 * Uses getDocs only.
 */
export async function fetchCollectionDocuments(db, collectionName, onPage, pageSize = MIGRATION_PAGE_SIZE) {
    let fetched = 0;

    return collectPages(async (cursor) => {
        const constraints = [orderBy(documentId()), limit(pageSize)];
        if (cursor) constraints.push(startAfter(cursor));

        const snapshot = await getDocs(query(collection(db, collectionName), ...constraints));
        const docs = snapshot.docs.map((docSnap) => ({
            documentId: docSnap.id,
            data: docSnap.data()
        }));

        fetched += docs.length;
        onPage?.({ collectionName, fetched, pageCount: docs.length });

        const last = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
        return { docs, cursor: last, pageSize };
    });
}

export function buildMigrationTable(documents) {
    const rows = documents.map(({ documentId: id, data }) => {
        const serialized = serializeFirestoreValue(data);
        const fields = serialized && typeof serialized === 'object' && !Array.isArray(serialized)
            ? serialized
            : {};
        return {
            ...fields,
            documentId: id == null ? '' : String(id)
        };
    });

    const fieldNames = new Set();
    for (const row of rows) {
        for (const key of Object.keys(row)) {
            if (key !== 'documentId') fieldNames.add(key);
        }
    }

    const columns = ['documentId', ...Array.from(fieldNames).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))];
    return { columns, rows };
}

export function migrationFilename(collectionName, format, date = new Date()) {
    const day = date.toISOString().slice(0, 10);
    const extension = format === 'json' ? 'json' : 'csv';
    return `migration-${collectionName}-${day}.${extension}`;
}

export function buildJson(rows) {
    return `${JSON.stringify(rows, null, 2)}\n`;
}

export function filesForDocuments(collectionName, documents, format, date = new Date()) {
    const table = buildMigrationTable(documents);
    const isJson = format === 'json';
    return {
        collectionName,
        count: documents.length,
        columns: table.columns,
        filename: migrationFilename(collectionName, isJson ? 'json' : 'csv', date),
        mimeType: isJson ? 'application/json;charset=utf-8' : 'text/csv;charset=utf-8',
        content: isJson ? buildJson(table.rows) : buildCsv(table.columns, table.rows)
    };
}

export function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}
