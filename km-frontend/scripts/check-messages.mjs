// Checks messages/*.json against messages/en.json: every language has the same keys, and each
// translation keeps the same {placeholders} and <tags>. Also rejects ICU number/date formatting
// ({n, number}, {d, date}, # in plurals): Marathi and Bengali would print their own digits there,
// so components pass numbers already formatted (formatLocale in src/i18n/config.ts).
// Run: npm run i18n:check
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('../messages/', import.meta.url));
const load = (file) => JSON.parse(readFileSync(join(dir, file), 'utf8'));

function flatten(obj, prefix = '', out = {}) {
    for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object') flatten(v, key, out);
        else out[key] = String(v);
    }
    return out;
}

const tokens = (s) => [...s.matchAll(/\{(\w+)\}|<\/?(\w+)>/g)].map((m) => m[0]).sort().join(' ');

const en = flatten(load('en.json'));
let problems = 0;

// Every language in src/i18n/config.ts needs a file
const config = readFileSync(join(dir, '../src/i18n/config.ts'), 'utf8');
const locales = [...(config.match(/LOCALES = \[([^\]]+)\]/)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1]);
if (!locales.length) {
    console.log('could not read LOCALES from src/i18n/config.ts');
    problems++;
}
for (const locale of locales) {
    if (!readdirSync(dir).includes(`${locale}.json`)) {
        console.log(`messages/${locale}.json is missing`);
        problems++;
    }
}

const localDigits = /\{\s*\w+\s*,\s*(number|date|time)\b|\{\s*\w+\s*,\s*(plural|selectordinal)\s*,[^]*#/;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    for (const [key, value] of Object.entries(flatten(load(file)))) {
        if (localDigits.test(value)) {
            console.log(`${file}: ${key} formats a number or date in the message; pass it in already formatted`);
            problems++;
        }
    }
}
for (const file of readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'en.json')) {
    const other = flatten(load(file));
    for (const key of Object.keys(en)) {
        if (!(key in other)) {
            console.log(`${file}: missing ${key}`);
            problems++;
        } else if (tokens(en[key]) !== tokens(other[key])) {
            console.log(`${file}: ${key} has "${tokens(other[key])}", English has "${tokens(en[key])}"`);
            problems++;
        }
    }
    for (const key of Object.keys(other)) {
        if (!(key in en)) {
            console.log(`${file}: ${key} is not in en.json`);
            problems++;
        }
    }
}
if (problems) {
    console.log(`\n${problems} problem(s)`);
    process.exit(1);
}
console.log(`messages OK (${Object.keys(en).length} keys)`);
