import * as fs from 'fs';
import * as path from 'path';
import { LanguageResult } from './cp3_language_detector';
import { FrameworkResult } from './cp4_framework_scanner';

export interface EntryPoint {
    file:        string; // relative path
    type:        string; // 'primary' | 'web_app' | 'server' | 'cli' | 'worker'
    confidence:  'high' | 'medium' | 'low';
    language:    string;
    detectedBy:  string; // how it was found
}

export interface EntryPointResult {
    entryPoints:  EntryPoint[];
    totalFound:   number;
    primaryEntry: string | null;
}

const EXCLUDE_DIRS = new Set([
    'node_modules', '.git', '__pycache__', 'dist',
    'build', '.next', 'out', 'target', '.ail',
    'venv', '.venv', 'AutoAI_ENV', 'env'
]);

// Common entry point filenames by language
const PYTHON_ENTRY_NAMES = new Set([
    'main.py', 'app.py', 'run.py', 'server.py',
    'manage.py', 'wsgi.py', 'asgi.py', 'cli.py',
    'start.py', 'worker.py', 'run_sys.py'
]);

const JS_ENTRY_NAMES = new Set([
    'index.js', 'server.js', 'app.js', 'main.js',
    'index.ts', 'server.ts', 'app.ts', 'main.ts'
]);

// Patterns that indicate a file IS an entry point
const PYTHON_ENTRY_PATTERNS = [
    { pattern: 'if __name__ == "__main__"', type: 'primary',  confidence: 'high' as const },
    { pattern: "if __name__ == '__main__'", type: 'primary',  confidence: 'high' as const },
    { pattern: 'app = FastAPI(',            type: 'web_app',  confidence: 'high' as const },
    { pattern: 'app = Flask(',              type: 'web_app',  confidence: 'high' as const },
    { pattern: 'application = Flask(',      type: 'web_app',  confidence: 'high' as const },
    { pattern: 'app = Django(',             type: 'web_app',  confidence: 'high' as const },
    { pattern: 'celery = Celery(',          type: 'worker',   confidence: 'high' as const },
    { pattern: 'app = Celery(',             type: 'worker',   confidence: 'high' as const },
    { pattern: 'uvicorn.run(',              type: 'web_app',  confidence: 'high' as const },
    { pattern: '@app.route(',               type: 'web_app',  confidence: 'medium' as const },
    { pattern: '@router.get(',              type: 'web_app',  confidence: 'medium' as const },
    { pattern: '@app.get(',                 type: 'web_app',  confidence: 'medium' as const },
    { pattern: 'click.group()',             type: 'cli',      confidence: 'high' as const },
    { pattern: 'argparse.ArgumentParser',   type: 'cli',      confidence: 'high' as const },
];

const JS_ENTRY_PATTERNS = [
    { pattern: 'app.listen(',     type: 'server',  confidence: 'high' as const },
    { pattern: 'server.listen(',  type: 'server',  confidence: 'high' as const },
    { pattern: 'createServer(',   type: 'server',  confidence: 'high' as const },
    { pattern: 'express()',       type: 'server',  confidence: 'high' as const },
    { pattern: 'ReactDOM.render', type: 'web_app', confidence: 'high' as const },
    { pattern: 'createRoot(',     type: 'web_app', confidence: 'high' as const },
];

function walkFiles(
    dirPath: string,
    extensions: string[],
    results: string[] = []
): string[] {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); }
    catch { return results; }

    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (!EXCLUDE_DIRS.has(entry.name)) {
                walkFiles(path.join(dirPath, entry.name), extensions, results);
            }
        } else if (entry.isFile()) {
            if (extensions.some(ext => entry.name.endsWith(ext))) {
                results.push(path.join(dirPath, entry.name));
            }
        }
    }
    return results;
}

export function runCheckpoint5(
    workspacePath: string,
    langResult:    LanguageResult,
    fwResult:      FrameworkResult,
    layer1Dir:     string
): EntryPointResult {

    const entryPoints: EntryPoint[] = [];
    const seen = new Set<string>(); // avoid duplicates

    const detectedLangs = langResult.languages.map(l => l.name);

    // ---- Python ----
    if (detectedLangs.includes('Python')) {
        const pyFiles = walkFiles(workspacePath, ['.py']);

        for (const fullPath of pyFiles) {
            const relPath  = path.relative(workspacePath, fullPath);
            const filename = path.basename(fullPath);

            let content: string;
            try { content = fs.readFileSync(fullPath, 'utf-8'); }
            catch { continue; }

            // Check patterns first (most reliable)
            for (const { pattern, type, confidence } of PYTHON_ENTRY_PATTERNS) {
                if (content.includes(pattern) && !seen.has(relPath)) {
                    seen.add(relPath);
                    entryPoints.push({
                        file:       relPath,
                        type,
                        confidence,
                        language:   'Python',
                        detectedBy: `pattern: "${pattern}"`
                    });
                    break; // one entry per file
                }
            }

            // Also flag by filename convention if not already found
            if (!seen.has(relPath) && PYTHON_ENTRY_NAMES.has(filename)) {
                seen.add(relPath);
                entryPoints.push({
                    file:       relPath,
                    type:       'primary',
                    confidence: 'medium',
                    language:   'Python',
                    detectedBy: `filename convention: ${filename}`
                });
            }
        }
    }

    // ---- JavaScript / TypeScript ----
    if (detectedLangs.includes('JavaScript') || detectedLangs.includes('TypeScript')) {

        // Check package.json main + scripts.start first
        const pkgPath = path.join(workspacePath, 'package.json');
        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

                if (pkg.main) {
                    const relPath = pkg.main;
                    seen.add(relPath);
                    entryPoints.push({
                        file:       relPath,
                        type:       'primary',
                        confidence: 'high',
                        language:   'JavaScript',
                        detectedBy: 'package.json "main" field'
                    });
                }

                if (pkg.scripts?.start) {
                    // Extract filename from "node server.js" or "ts-node src/index.ts"
                    const match = pkg.scripts.start.match(/(?:node|ts-node)\s+([\w./]+)/);
                    if (match && !seen.has(match[1])) {
                        seen.add(match[1]);
                        entryPoints.push({
                            file:       match[1],
                            type:       'server',
                            confidence: 'high',
                            language:   'JavaScript',
                            detectedBy: 'package.json "scripts.start"'
                        });
                    }
                }
            } catch { /* skip malformed */ }
        }

        // Then scan JS/TS files for entry patterns
        const jsFiles = walkFiles(workspacePath, ['.js', '.ts', '.jsx', '.tsx']);

        for (const fullPath of jsFiles) {
            if (fullPath.includes('node_modules')) continue;
            const relPath  = path.relative(workspacePath, fullPath);
            const filename = path.basename(fullPath);

            let content: string;
            try { content = fs.readFileSync(fullPath, 'utf-8'); }
            catch { continue; }

            for (const { pattern, type, confidence } of JS_ENTRY_PATTERNS) {
                if (content.includes(pattern) && !seen.has(relPath)) {
                    seen.add(relPath);
                    entryPoints.push({
                        file:       relPath,
                        type,
                        confidence,
                        language:   'JavaScript/TypeScript',
                        detectedBy: `pattern: "${pattern}"`
                    });
                    break;
                }
            }

            if (!seen.has(relPath) && JS_ENTRY_NAMES.has(filename)) {
                seen.add(relPath);
                entryPoints.push({
                    file:       relPath,
                    type:       'primary',
                    confidence: 'medium',
                    language:   'JavaScript/TypeScript',
                    detectedBy: `filename convention: ${filename}`
                });
            }
        }
    }

    // Sort: high confidence first
    const order = { high: 0, medium: 1, low: 2 };
    entryPoints.sort((a, b) => order[a.confidence] - order[b.confidence]);

    const primaryEntry = entryPoints.length > 0 ? entryPoints[0].file : null;

    const result: EntryPointResult = {
        entryPoints,
        totalFound:   entryPoints.length,
        primaryEntry
    };

    const outputPath = path.join(layer1Dir, 'entry_points.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(`AIL CP5 | Found ${entryPoints.length} entry points | Primary: ${primaryEntry}`);

    return result;
}