import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCsv, escapeCsvField, quoteCsvField } from './csv.js';

function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuotes) {
            if (char === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                field += char;
            }
            continue;
        }
        if (char === '"') {
            inQuotes = true;
            continue;
        }
        if (char === ',') {
            row.push(field);
            field = '';
            continue;
        }
        if (char === '\r' && text[i + 1] === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
            i += 1;
            continue;
        }
        if (char === '\n') {
            row.push(field);
            rows.push(row);
            row = [];
            field = '';
            continue;
        }
        field += char;
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

test('escapes inch marks inside item names', () => {
    assert.equal(escapeCsvField('Monitor - Dell 27"'), '"Monitor - Dell 27"""');
    assert.equal(quoteCsvField('Monitor - Dell 27"'), '"Monitor - Dell 27"""');
});

test('round-trips commas, quotes, and newlines', () => {
    const csv = buildCsv(
        ['name', 'notes', 'quantity'],
        [{
            name: 'Monitor - Dell 27"',
            notes: 'Line one\r\nLine, "two"',
            quantity: 3
        }]
    );

    assert.equal(
        csv,
        'name,notes,quantity\r\n"Monitor - Dell 27""","Line one\r\nLine, ""two""",3\r\n'
    );

    const parsed = parseCsv(csv);
    assert.deepEqual(parsed[0], ['name', 'notes', 'quantity']);
    assert.deepEqual(parsed[1], ['Monitor - Dell 27"', 'Line one\r\nLine, "two"', '3']);
});

test('leaves plain fields unquoted and encodes nested values as JSON', () => {
    const csv = buildCsv(['documentId', 'meta'], [{
        documentId: 'abc',
        meta: { unitPrice: 12.5 }
    }]);
    const parsed = parseCsv(csv);
    assert.equal(parsed[1][0], 'abc');
    assert.deepEqual(JSON.parse(parsed[1][1]), { unitPrice: 12.5 });
});
