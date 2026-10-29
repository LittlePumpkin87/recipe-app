/**
 * Compares two httpyac `--json` runs of `requests.http`, one per backend.
 * Usage: node tools/compare-responses.ts <nest.json> <dotnet.json>
 * Exits with 1 if any request differs in status or, for 2xx, in body.
 */
import { readFileSync } from 'node:fs';

type HttpResponse = { statusCode: number; body?: string };
type RequestEntry = { name: string; response?: HttpResponse };
type RunFile = { requests: RequestEntry[] };

const IGNORED_KEYS = new Set(['id', 'ingredientId']);

const ALLOWED_STATUS_DIFFERENCES = new Set([
    'Valid UUID v4 -> 400 in Nest, 404 in .NET',
]);

// Reading

function readRun(path: string): RequestEntry[] {
    const file: RunFile = JSON.parse(readFileSync(path, 'utf8'));
    return file.requests;
}

// Normalising bodies

function isSuccess(statusCode: number): boolean {
    return statusCode >= 200 && statusCode < 300;
}

function clean(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(clean);
    }
    if (value !== null && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const sorted: Record<string, unknown> = {};
        for (const key of Object.keys(record).sort()) {
            if (!IGNORED_KEYS.has(key)) {
                sorted[key] = clean(record[key]);
            }
        }
        return sorted;
    }
    return value;
}

function normalizeBody(body: string | undefined): string {
    return body ? JSON.stringify(clean(JSON.parse(body))) : '';
}

// Comparing

const [nestPath, dotnetPath] = process.argv.slice(2);
const nestRequests = readRun(nestPath);
const dotnetRequests = readRun(dotnetPath);
const problems: string[] = [];

if (nestRequests.length !== dotnetRequests.length) {
    problems.push(
        `count: nest ${nestRequests.length} vs dotnet ${dotnetRequests.length}`,
    );
}

const count = Math.min(nestRequests.length, dotnetRequests.length);
for (let i = 0; i < count; i++) {
    const nest = nestRequests[i].response;
    const dotnet = dotnetRequests[i].response;

    if (!nest && !dotnet) {
        continue;
    }
    if (!nest || !dotnet) {
        problems.push(`#${i + 1}: no response from ${nest ? 'dotnet' : 'nest'}`);
        continue;
    }
    if (nest.statusCode !== dotnet.statusCode) {
        if (ALLOWED_STATUS_DIFFERENCES.has(nestRequests[i].name)) {
            continue;
        }
        problems.push(
            `#${i + 1}: status nest ${nest.statusCode} vs dotnet ${dotnet.statusCode}`,
        );
        continue;
    }
    if (!isSuccess(nest.statusCode)) {
        continue;
    }

    const left = normalizeBody(nest.body);
    const right = normalizeBody(dotnet.body);
    if (left !== right) {
        problems.push(
            `#${i + 1}: body differs\n  nest:   ${left}\n  dotnet: ${right}`,
        );
    }
}

// Reporting

for (const problem of problems) {
    console.error(problem);
}
if (problems.length > 0) {
    process.exitCode = 1;
}
