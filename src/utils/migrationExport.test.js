import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    MIGRATION_COLLECTIONS,
    buildJson,
    buildMigrationTable,
    collectPages,
    filesForDocuments,
    serializeFirestoreValue
} from './migrationExport.js';

function timestamp(iso) {
    const date = new Date(iso);
    return {
        seconds: Math.floor(date.getTime() / 1000),
        nanoseconds: (date.getTime() % 1000) * 1e6,
        toDate() {
            return date;
        },
        toMillis() {
            return date.getTime();
        }
    };
}

test('migration collections match the Firestore names this app writes', () => {
    assert.deepEqual(MIGRATION_COLLECTIONS, [
        'items',
        'checkoutHistory',
        'archivedCheckouts',
        'inventoryLogs',
        'costAllocation'
    ]);
});

test('serializes timestamps, including nested ones, to ISO strings', () => {
    const value = serializeFirestoreValue({
        name: 'Monitor - Dell 27"',
        createdAt: timestamp('2024-05-01T12:00:00.000Z'),
        shipmentDetails: {
            processedAt: timestamp('2024-06-01T00:00:00.000Z'),
            vendor: 'Amazon'
        },
        tags: [timestamp('2024-07-01T00:00:00.000Z')]
    });

    assert.equal(value.createdAt, '2024-05-01T12:00:00.000Z');
    assert.equal(value.shipmentDetails.processedAt, '2024-06-01T00:00:00.000Z');
    assert.equal(value.tags[0], '2024-07-01T00:00:00.000Z');
    assert.equal(value.name, 'Monitor - Dell 27"');
});

test('table keeps the Firestore id and every stored field name', () => {
    const table = buildMigrationTable([
        {
            documentId: 'checkout-1',
            data: {
                id: 'checkout-1',
                itemName: 'Monitor - Dell 27"',
                dateEntered: timestamp('2025-09-04T16:31:20.000Z'),
                quantity: 1
            }
        },
        {
            documentId: 'checkout-2',
            data: {
                itemName: 'Cable',
                price: 1.5
            }
        }
    ]);

    assert.deepEqual(table.columns, ['documentId', 'dateEntered', 'id', 'itemName', 'price', 'quantity']);
    assert.equal(table.rows[0].documentId, 'checkout-1');
    assert.equal(table.rows[0].id, 'checkout-1');
    assert.equal(table.rows[0].dateEntered, '2025-09-04T16:31:20.000Z');
    assert.equal(table.rows[1].quantity, undefined);

    const file = filesForDocuments('checkoutHistory', [
        {
            documentId: 'checkout-1',
            data: {
                itemName: 'Monitor - Dell 27"',
                dateEntered: timestamp('2025-09-04T16:31:20.000Z')
            }
        }
    ], 'csv', new Date('2026-10-28T00:00:00.000Z'));

    assert.equal(file.filename, 'migration-checkoutHistory-2026-10-28.csv');
    assert.match(file.content, /"Monitor - Dell 27"""/);
    assert.match(file.content, /2025-09-04T16:31:20.000Z/);

    const json = JSON.parse(buildJson(table.rows));
    assert.equal(json[0].documentId, 'checkout-1');
    assert.equal(json[0].itemName, 'Monitor - Dell 27"');
});

test('reads past a 500-document page and an exact multiple of the page size', async () => {
    async function readAll(total, pageSize) {
        const source = Array.from({ length: total }, (_, index) => ({
            documentId: String(index).padStart(5, '0'),
            data: { name: `Item ${index}` }
        }));
        let calls = 0;
        const docs = await collectPages(async (cursor) => {
            calls += 1;
            const start = cursor ? source.findIndex((doc) => doc.documentId === cursor) + 1 : 0;
            const slice = source.slice(start, start + pageSize);
            return {
                docs: slice,
                cursor: slice.length ? slice[slice.length - 1].documentId : null,
                pageSize
            };
        });
        return { docs, calls };
    }

    const pastCap = await readAll(1200, 500);
    assert.equal(pastCap.docs.length, 1200);
    assert.equal(pastCap.calls, 3);
    assert.equal(pastCap.docs[0].documentId, '00000');
    assert.equal(pastCap.docs[1199].documentId, '01199');

    const exact = await readAll(1000, 500);
    assert.equal(exact.docs.length, 1000);
    assert.equal(exact.calls, 3);

    const empty = await readAll(0, 500);
    assert.equal(empty.docs.length, 0);
    assert.equal(empty.calls, 1);
});

test('admin migration handler only calls the read-only export', () => {
    const source = readFileSync(new URL('../components/admin/AdminPanel.jsx', import.meta.url), 'utf8');
    const start = source.indexOf('const runMigrationExport');
    const end = source.indexOf('// Import Items from CSV');
    assert.ok(start !== -1 && end > start);
    const handler = source.slice(start, end);
    for (const token of ['addDoc', 'updateDoc', 'deleteDoc', 'writeBatch', 'setDoc', 'runTransaction', 'batch.']) {
        assert.equal(handler.includes(token), false, `migration handler contains ${token}`);
    }
    assert.match(handler, /fetchCollectionDocuments/);
    assert.match(handler, /filesForDocuments/);
});

test('export module only reads Firestore', () => {
    const source = readFileSync(new URL('./migrationExport.js', import.meta.url), 'utf8');
    const importLine = source.match(/import \{[^}]+\} from 'firebase\/firestore';/)?.[0] || '';
    assert.match(importLine, /\bgetDocs\b/);
    for (const token of ['setDoc', 'addDoc', 'updateDoc', 'deleteDoc', 'writeBatch', 'runTransaction', 'serverTimestamp']) {
        assert.equal(importLine.includes(token), false, `read module imports ${token}`);
        assert.equal(source.includes(token), false, `read module contains ${token}`);
    }
    assert.equal(source.includes('.set('), false);
    assert.equal(source.includes('.update('), false);
    assert.equal(source.includes('.delete('), false);
});
