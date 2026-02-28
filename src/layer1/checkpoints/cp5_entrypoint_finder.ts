import * as fs from 'fs';
import * as path from 'path';
import { LanguageResult } from './cp3_language_detector';
import { FrameworkResult } from './cp4_framework_scanner';

export interface EntryPoint {
    file:       string;
    type:       string;
    confidence: 'high' | 'medium' | 'low';
    language:   string;
    detectedBy: string;
}

export interface EntryPointResult {
    entryPoints:  EntryPoint[];
    totalFound:   number;
    primaryEntry: string | null;
}

const EXCLUDE_DIRS = new Set([
    'node_modules', '.git', '__pycache__', 'dist',
    'build', '.next', 'out', 'target', '.ail',
    'venv', '.venv', 'env', 'AutoAI_ENV'
]);

const PYTHON_ENTRY_NAMES = new Set([
    'main.py', 'app.py', 'run.py', 'server.py',
    'manage.py', 'wsgi.py', 'asgi.py', 'cli.py',
    'start.py', 'worker.py', 'run_sys.py'
]);

const JS_ENTRY_NAMES = new Set([
    'index.js', 'server.js', 'app.js', 'main.js',
    'index.ts', 'server.ts', 'app.ts', 'main.ts',
    'page.tsx', 'page.ts', 'page.jsx',
    'layout.tsx', 'layout.ts',
    'route.ts', 'route.tsx'
]);

const PYTHON_ENTRY_PATTERNS: { pattern: string; type: string; confidence: 'high' | 'medium' | 'low' }[] = [
    // Generic
    { pattern: 'if __name__ == "__main__"',  type: 'primary', confidence: 'high' },
    { pattern: "if __name__ == '__main__'",  type: 'primary', confidence: 'high' },
    { pattern: 'argparse.ArgumentParser',    type: 'cli',     confidence: 'high' },
    { pattern: 'click.group()',              type: 'cli',     confidence: 'high' },
    { pattern: '@click.command()',           type: 'cli',     confidence: 'high' },
    // FastAPI
    { pattern: 'app = FastAPI(',             type: 'web_app', confidence: 'high' },
    { pattern: 'application = FastAPI(',     type: 'web_app', confidence: 'high' },
    { pattern: 'uvicorn.run(',               type: 'web_app', confidence: 'high' },
    { pattern: '@app.get(',                  type: 'web_app', confidence: 'medium' },
    { pattern: '@app.post(',                 type: 'web_app', confidence: 'medium' },
    { pattern: '@router.get(',               type: 'web_app', confidence: 'medium' },
    // Flask
    { pattern: 'app = Flask(',               type: 'web_app', confidence: 'high' },
    { pattern: 'application = Flask(',       type: 'web_app', confidence: 'high' },
    { pattern: '@app.route(',                type: 'web_app', confidence: 'medium' },
    // Django
    { pattern: 'django.setup()',             type: 'web_app', confidence: 'high' },
    { pattern: 'execute_from_command_line',  type: 'web_app', confidence: 'high' },
    { pattern: 'get_wsgi_application()',     type: 'web_app', confidence: 'high' },
    { pattern: 'get_asgi_application()',     type: 'web_app', confidence: 'high' },
    { pattern: 'DJANGO_SETTINGS_MODULE',     type: 'web_app', confidence: 'high' },
    // Celery
    { pattern: 'celery = Celery(',           type: 'worker',  confidence: 'high' },
    { pattern: 'app = Celery(',              type: 'worker',  confidence: 'high' },
    { pattern: '@celery.task',               type: 'worker',  confidence: 'medium' },
    { pattern: '@app.task',                  type: 'worker',  confidence: 'medium' },
];

const JS_ENTRY_PATTERNS: { pattern: string; type: string; confidence: 'high' | 'medium' | 'low' }[] = [
    // Express
    { pattern: 'app.listen(',               type: 'server',  confidence: 'high' },
    { pattern: 'server.listen(',            type: 'server',  confidence: 'high' },
    { pattern: 'createServer(',             type: 'server',  confidence: 'high' },
    { pattern: "require('express')",        type: 'server',  confidence: 'high' },
    { pattern: 'require("express")',        type: 'server',  confidence: 'high' },
    { pattern: "from 'express'",            type: 'server',  confidence: 'high' },
    // NestJS
    { pattern: 'NestFactory.create(',       type: 'web_app', confidence: 'high' },
    { pattern: '@Module({',                 type: 'web_app', confidence: 'high' },
    { pattern: '@Controller(',              type: 'web_app', confidence: 'medium' },
    { pattern: '@Injectable()',             type: 'web_app', confidence: 'medium' },
    // React
    { pattern: 'ReactDOM.render(',          type: 'web_app', confidence: 'high' },
    { pattern: 'createRoot(',               type: 'web_app', confidence: 'high' },
    { pattern: 'ReactDOM.createRoot(',      type: 'web_app', confidence: 'high' },
    // Vue
    { pattern: 'createApp(',               type: 'web_app', confidence: 'high' },
    { pattern: 'new Vue({',                type: 'web_app', confidence: 'high' },
    { pattern: "from 'vue'",               type: 'web_app', confidence: 'medium' },
    // Generic
    { pattern: 'export default function',       type: 'web_app', confidence: 'medium' },
    { pattern: 'export default async function', type: 'web_app', confidence: 'medium' },
];

const JAVA_ENTRY_PATTERNS: { pattern: string; type: string; confidence: 'high' | 'medium' | 'low' }[] = [
    { pattern: 'public static void main(String',  type: 'primary', confidence: 'high' },
    { pattern: '@SpringBootApplication',          type: 'web_app', confidence: 'high' },
    { pattern: 'SpringApplication.run(',          type: 'web_app', confidence: 'high' },
    { pattern: '@RestController',                 type: 'web_app', confidence: 'medium' },
    { pattern: '@Controller',                     type: 'web_app', confidence: 'medium' },
];

function walkFiles(dirPath: string, extensions: string[], results: string[] = []): string[] {
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

function scanFileForPatterns(
    fullPath:    string,
    relPath:     string,
    patterns:    { pattern: string; type: string; confidence: 'high' | 'medium' | 'low' }[],
    language:    string,
    seen:        Set<string>,
    entryPoints: EntryPoint[]
): void {
    let content: string;
    try { content = fs.readFileSync(fullPath, 'utf-8'); }
    catch { return; }

    for (const { pattern, type, confidence } of patterns) {
        if (content.includes(pattern) && !seen.has(relPath)) {
            seen.add(relPath);
            entryPoints.push({
                file: relPath, type, confidence, language,
                detectedBy: `pattern: "${pattern}"`
            });
            return; // one entry per file
        }
    }
}

function checkFrameworkConventions(
    workspacePath: string,
    seen:          Set<string>,
    entryPoints:   EntryPoint[]
): void {

    // ---- Next.js ----
    const hasNextConfig = fs.existsSync(path.join(workspacePath, 'next.config.ts')) ||
                          fs.existsSync(path.join(workspacePath, 'next.config.js'));

    if (hasNextConfig) {
        const candidates = [
            { rel: 'app/page.tsx',      detectedBy: 'Next.js app router - root page' },
            { rel: 'app/page.jsx',      detectedBy: 'Next.js app router - root page' },
            { rel: 'app/layout.tsx',    detectedBy: 'Next.js app router - root layout' },
            { rel: 'app/layout.jsx',    detectedBy: 'Next.js app router - root layout' },
            { rel: 'pages/index.tsx',   detectedBy: 'Next.js pages router - index' },
            { rel: 'pages/index.jsx',   detectedBy: 'Next.js pages router - index' },
            { rel: 'pages/index.js',    detectedBy: 'Next.js pages router - index' },
            { rel: 'pages/_app.tsx',    detectedBy: 'Next.js pages router - app wrapper' },
            { rel: 'pages/_app.js',     detectedBy: 'Next.js pages router - app wrapper' },
        ];

        for (const { rel, detectedBy } of candidates) {
            if (fs.existsSync(path.join(workspacePath, rel)) && !seen.has(rel)) {
                seen.add(rel);
                entryPoints.push({
                    file: rel, type: 'web_app', confidence: 'high',
                    language: 'TypeScript', detectedBy
                });
            }
        }
    }

    // ---- Vite ----
    const hasViteConfig = fs.existsSync(path.join(workspacePath, 'vite.config.ts')) ||
                          fs.existsSync(path.join(workspacePath, 'vite.config.js'));

    if (hasViteConfig) {
        const candidates = [
            { rel: 'src/main.tsx', detectedBy: 'Vite - src/main.tsx convention' },
            { rel: 'src/main.ts',  detectedBy: 'Vite - src/main.ts convention' },
            { rel: 'src/main.jsx', detectedBy: 'Vite - src/main.jsx convention' },
            { rel: 'src/main.js',  detectedBy: 'Vite - src/main.js convention' },
            { rel: 'src/App.tsx',  detectedBy: 'Vite - src/App.tsx convention' },
            { rel: 'src/App.jsx',  detectedBy: 'Vite - src/App.jsx convention' },
        ];

        for (const { rel, detectedBy } of candidates) {
            if (fs.existsSync(path.join(workspacePath, rel)) && !seen.has(rel)) {
                seen.add(rel);
                entryPoints.push({
                    file: rel, type: 'web_app', confidence: 'high',
                    language: 'TypeScript', detectedBy
                });
            }
        }
    }

    // ---- Remix ----
    const hasRemixConfig = fs.existsSync(path.join(workspacePath, 'remix.config.js')) ||
                           fs.existsSync(path.join(workspacePath, 'remix.config.ts'));

    if (hasRemixConfig) {
        const candidates = [
            { rel: 'app/root.tsx',         detectedBy: 'Remix - app/root.tsx convention' },
            { rel: 'app/root.jsx',         detectedBy: 'Remix - app/root.jsx convention' },
            { rel: 'app/routes/_index.tsx', detectedBy: 'Remix - index route' },
        ];

        for (const { rel, detectedBy } of candidates) {
            if (fs.existsSync(path.join(workspacePath, rel)) && !seen.has(rel)) {
                seen.add(rel);
                entryPoints.push({
                    file: rel, type: 'web_app', confidence: 'high',
                    language: 'TypeScript', detectedBy
                });
            }
        }
    }

    // ---- Django (wsgi/asgi) ----
    const djangoCandidates = [
        'wsgi.py', 'asgi.py',
        'config/wsgi.py', 'config/asgi.py',
        'core/wsgi.py',   'core/asgi.py',
    ];

    for (const rel of djangoCandidates) {
        if (fs.existsSync(path.join(workspacePath, rel)) && !seen.has(rel)) {
            seen.add(rel);
            entryPoints.push({
                file: rel, type: 'web_app', confidence: 'high',
                language: 'Python', detectedBy: 'Django wsgi/asgi convention'
            });
        }
    }
}

export function runCheckpoint5(
    workspacePath: string,
    langResult:    LanguageResult,
    fwResult:      FrameworkResult,
    layer1Dir:     string
): EntryPointResult {

    const entryPoints: EntryPoint[] = [];
    const seen = new Set<string>();
    const detectedLangs = langResult.languages.map(l => l.name);

    // ---- Python ----
    if (detectedLangs.includes('Python')) {
        const pyFiles = walkFiles(workspacePath, ['.py']);

        for (const fullPath of pyFiles) {
            const relPath  = path.relative(workspacePath, fullPath);
            const filename = path.basename(fullPath);

            scanFileForPatterns(fullPath, relPath, PYTHON_ENTRY_PATTERNS, 'Python', seen, entryPoints);

            // Filename convention fallback
            if (!seen.has(relPath) && PYTHON_ENTRY_NAMES.has(filename)) {
                seen.add(relPath);
                entryPoints.push({
                    file: relPath, type: 'primary', confidence: 'medium',
                    language: 'Python', detectedBy: `filename convention: ${filename}`
                });
            }
        }
    }

    // ---- JavaScript / TypeScript ----
    if (detectedLangs.includes('JavaScript') || detectedLangs.includes('TypeScript')) {

        // package.json main + scripts.start
        const pkgPath = path.join(workspacePath, 'package.json');
        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

                if (pkg.main && !seen.has(pkg.main)) {
                    seen.add(pkg.main);
                    entryPoints.push({
                        file: pkg.main, type: 'primary', confidence: 'high',
                        language: 'JavaScript', detectedBy: 'package.json "main" field'
                    });
                }

                if (pkg.scripts?.start) {
                    const match = pkg.scripts.start.match(/(?:node|ts-node)\s+([\w./]+)/);
                    if (match && !seen.has(match[1])) {
                        seen.add(match[1]);
                        entryPoints.push({
                            file: match[1], type: 'server', confidence: 'high',
                            language: 'JavaScript', detectedBy: 'package.json scripts.start'
                        });
                    }
                }
            } catch { /* skip */ }
        }

        // Scan JS/TS files for patterns
        const jsFiles = walkFiles(workspacePath, ['.js', '.ts', '.jsx', '.tsx'])
            .filter(f => !f.includes('node_modules'));

        for (const fullPath of jsFiles) {
            const relPath  = path.relative(workspacePath, fullPath);
            const filename = path.basename(fullPath);

            scanFileForPatterns(fullPath, relPath, JS_ENTRY_PATTERNS, 'JavaScript/TypeScript', seen, entryPoints);

            if (!seen.has(relPath) && JS_ENTRY_NAMES.has(filename)) {
                seen.add(relPath);
                entryPoints.push({
                    file: relPath, type: 'primary', confidence: 'medium',
                    language: 'JavaScript/TypeScript', detectedBy: `filename convention: ${filename}`
                });
            }
        }
    }

    // ---- Java ----
    if (detectedLangs.includes('Java')) {
        const javaFiles = walkFiles(workspacePath, ['.java']);

        for (const fullPath of javaFiles) {
            const relPath = path.relative(workspacePath, fullPath);
            scanFileForPatterns(fullPath, relPath, JAVA_ENTRY_PATTERNS, 'Java', seen, entryPoints);
        }
    }

    // ---- Framework-specific conventions ----
    checkFrameworkConventions(workspacePath, seen, entryPoints);

    // Sort: high confidence first
    const order = { high: 0, medium: 1, low: 2 };
    entryPoints.sort((a, b) => order[a.confidence] - order[b.confidence]);

    const primaryEntry = entryPoints.length > 0 ? entryPoints[0].file : null;

    const result: EntryPointResult = { entryPoints, totalFound: entryPoints.length, primaryEntry };

    const outputPath = path.join(layer1Dir, 'entry_points.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(`AIL CP5 | Found ${entryPoints.length} entry points | Primary: ${primaryEntry}`);

    return result;
}