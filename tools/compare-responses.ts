/**
 * Compares two httpyac `--json` runs of `requests.http`, one per backend.
 * Usage: node tools/compare-responses.ts <nest.json> <dotnet.json>
 * Exits with 1 if any request differs in status or, for 2xx, in body.
 */
import { readFileSync } from "node:fs";

type HttpResponse = { statusCode: number; body?: string };
type RequestEntry = { name: string; response?: HttpResponse };
type RunFile = { requests: RequestEntry[] };

const IGNORED_KEYS = new Set(["id", "ingredientId"]);

const ALLOWED_STATUS_DIFFERENCES = new Set([
    "Valid UUID v4 -> 400 in Nest, 404 in .NET",
]);

// Reading

function readRun(path: string): RequestEntry[] {
    const file: RunFile = JSON.parse(readFileSync(path, "utf8"));
    return file.requests;
}

// Normalising bodies

function isSuccess(statusCode: number): boolean {
    return statusCode >= 200 && statusCode < 300;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function show(value: unknown): string {
    return value === undefined ? "(missing)" : JSON.stringify(value);
}

function parseBody(body: string | undefined): unknown {
    return body ? JSON.parse(body) : undefined;
}

function diffValues(
    nest: unknown,
    dotnet: unknown,
    path: string,
    out: string[],
): void {
    if (Array.isArray(nest) && Array.isArray(dotnet)) {
        const length = Math.max(nest.length, dotnet.length);
        for (let i = 0; i < length; i++) {
            diffValues(nest[i], dotnet[i], `${path}.[${i}]`, out);
        }
        return;
    }
    if (isRecord(nest) && isRecord(dotnet)) {
        const keys = new Set([...Object.keys(nest), ...Object.keys(dotnet)]);
        for (const key of keys) {
            if (IGNORED_KEYS.has(key)) {
                continue;
            }
            diffValues(nest[key], dotnet[key], `${path}.${key}`, out);
        }
        return;
    }
    if (JSON.stringify(nest) !== JSON.stringify(dotnet)) {
        out.push(`${path}: nest ${show(nest)}, dotnet ${show(dotnet)}`);
    }
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
        problems.push(
            `#${i + 1}: no response from ${nest ? "dotnet" : "nest"}`,
        );
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

    diffValues(
        parseBody(nest.body),
        parseBody(dotnet.body),
        `#${i + 1}`,
        problems,
    );
}

// Reporting

for (const problem of problems) {
    console.error(problem);
}
if (problems.length > 0) {
    process.exitCode = 1;
} else {
    console.log("Success - No differences found");
}
