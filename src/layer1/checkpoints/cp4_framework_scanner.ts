import * as fs from 'fs';
import * as path from 'path';
import { LanguageResult } from './cp3_language_detector';

export interface FrameworkInfo {
    name:     string;
    type:     string;
    language: string;
    source:   string;
}

export interface FrameworkResult {
    frameworks:     FrameworkInfo[];
    totalFound:     number;
    manifestsFound: string[];
}

const EXCLUDE_DIRS = new Set([
    'node_modules', '.git', '__pycache__', 'dist',
    'build', '.next', 'out', 'target', '.ail',
    'venv', '.venv', 'env', 'AutoAI_ENV'
]);

const PYTHON_FRAMEWORKS: Record<string, { type: string }> = {
    // Web
    'fastapi':    { type: 'web' },
    'flask':      { type: 'web' },
    'django':     { type: 'web' },
    'tornado':    { type: 'web' },
    'starlette':  { type: 'web' },
    'aiohttp':    { type: 'web' },
    'sanic':      { type: 'web' },
    // Server
    'uvicorn':    { type: 'server' },
    'gunicorn':   { type: 'server' },
    'hypercorn':  { type: 'server' },
    // Task Queue
    'celery':     { type: 'task-queue' },
    'rq':         { type: 'task-queue' },
    // Database
    'sqlalchemy': { type: 'database' },
    'alembic':    { type: 'database' },
    'pymongo':    { type: 'database' },
    'motor':      { type: 'database' },
    'redis':      { type: 'database' },
    'psycopg2':   { type: 'database' },
    // AI/ML
    'langchain':  { type: 'ai' },
    'openai':     { type: 'ai' },
    'anthropic':  { type: 'ai' },
    'transformers':{ type: 'ai' },
    'torch':      { type: 'ml' },
    'tensorflow': { type: 'ml' },
    'sklearn':    { type: 'ml' },
    // Validation
    'pydantic':   { type: 'validation' },
    'marshmallow':{ type: 'validation' },
    // Testing
    'pytest':     { type: 'testing' },
    'unittest':   { type: 'testing' },
    // CLI
    'click':      { type: 'cli' },
    'typer':      { type: 'cli' },
    'argparse':   { type: 'cli' },
};

const JS_FRAMEWORKS: Record<string, { type: string }> = {
    // Frontend
    'react':          { type: 'frontend' },
    'vue':            { type: 'frontend' },
    '@angular/core':  { type: 'frontend' },
    'svelte':         { type: 'frontend' },
    'solid-js':       { type: 'frontend' },
    // Fullstack
    'next':           { type: 'fullstack' },
    'nuxt':           { type: 'fullstack' },
    'remix':          { type: 'fullstack' },
    '@remix-run/node':{ type: 'fullstack' },
    // Backend
    'express':        { type: 'backend' },
    '@nestjs/core':   { type: 'backend' },
    'fastify':        { type: 'backend' },
    'koa':            { type: 'backend' },
    'hapi':           { type: 'backend' },
    // Build tools
    'vite':           { type: 'build-tool' },
    'webpack':        { type: 'build-tool' },
    'esbuild':        { type: 'build-tool' },
    'turbo':          { type: 'build-tool' },
    // Testing
    'jest':           { type: 'testing' },
    'vitest':         { type: 'testing' },
    'cypress':        { type: 'testing' },
    '@playwright/test':{ type: 'testing' },
    // Database
    'prisma':         { type: 'database' },
    'mongoose':       { type: 'database' },
    'typeorm':        { type: 'database' },
    'drizzle-orm':    { type: 'database' },
    // State
    'redux':          { type: 'state' },
    'zustand':        { type: 'state' },
    'mobx':           { type: 'state' },
    // UI
    'tailwindcss':    { type: 'ui' },
    '@mui/material':  { type: 'ui' },
    'antd':           { type: 'ui' },
    'shadcn-ui':      { type: 'ui' },
};

const JAVA_FRAMEWORKS: Record<string, { type: string }> = {
    'spring-boot':  { type: 'backend' },
    'spring-web':   { type: 'backend' },
    'spring-data':  { type: 'database' },
    'hibernate':    { type: 'database' },
    'junit':        { type: 'testing' },
    'mockito':      { type: 'testing' },
    'lombok':       { type: 'utility' },
    'jackson':      { type: 'serialization' },
};

// Recursively find files by exact filename
function findFilesByName(dirPath: string, targetName: string, results: string[] = []): string[] {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); }
    catch { return results; }

    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (!EXCLUDE_DIRS.has(entry.name)) {
                findFilesByName(path.join(dirPath, entry.name), targetName, results);
            }
        } else if (entry.isFile() && entry.name === targetName) {
            results.push(path.join(dirPath, entry.name));
        }
    }
    return results;
}

function scanForKeywords(
    content:      string,
    frameworkMap: Record<string, { type: string }>,
    language:     string,
    sourceFile:   string,
    existing:     FrameworkInfo[]
): FrameworkInfo[] {
    const found: FrameworkInfo[] = [];
    const lower = content.toLowerCase();

    for (const [name, info] of Object.entries(frameworkMap)) {
        const alreadyFound = existing.some(f => f.name.toLowerCase() === name.toLowerCase()) ||
                             found.some(f => f.name.toLowerCase() === name.toLowerCase());
        if (!alreadyFound && lower.includes(name.toLowerCase())) {
            found.push({
                name:     name,
                type:     info.type,
                language,
                source:   sourceFile
            });
        }
    }
    return found;
}

// Scan Python source files for import statements as fallback
function scanPythonImports(workspacePath: string, existing: FrameworkInfo[]): FrameworkInfo[] {
    const found: FrameworkInfo[] = [];

    function walkPy(dirPath: string) {
        let entries: fs.Dirent[];
        try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); }
        catch { return; }

        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (!EXCLUDE_DIRS.has(entry.name)) { walkPy(path.join(dirPath, entry.name)); }
            } else if (entry.isFile() && entry.name.endsWith('.py')) {
                let content: string;
                try { content = fs.readFileSync(path.join(dirPath, entry.name), 'utf-8'); }
                catch { continue; }

                for (const [name, info] of Object.entries(PYTHON_FRAMEWORKS)) {
                    const alreadyFound =
                        existing.some(f => f.name.toLowerCase() === name) ||
                        found.some(f => f.name.toLowerCase() === name);

                    if (!alreadyFound) {
                        const patterns = [
                            `import ${name}`,
                            `from ${name} `,
                            `from ${name}.`
                        ];
                        if (patterns.some(p => content.toLowerCase().includes(p))) {
                            found.push({
                                name:     name.charAt(0).toUpperCase() + name.slice(1),
                                type:     info.type,
                                language: 'Python',
                                source:   `import in ${entry.name}`
                            });
                        }
                    }
                }
            }
        }
    }

    walkPy(workspacePath);
    return found;
}

// Detect framework from config files that exist
function detectFromConfigFiles(workspacePath: string, existing: FrameworkInfo[]): FrameworkInfo[] {
    const found: FrameworkInfo[] = [];

    const configSignals: { file: string; name: string; type: string; language: string }[] = [
        // Next.js
        { file: 'next.config.ts',   name: 'Next.js',  type: 'fullstack',   language: 'TypeScript' },
        { file: 'next.config.js',   name: 'Next.js',  type: 'fullstack',   language: 'JavaScript' },
        // Vite
        { file: 'vite.config.ts',   name: 'Vite',     type: 'build-tool',  language: 'TypeScript' },
        { file: 'vite.config.js',   name: 'Vite',     type: 'build-tool',  language: 'JavaScript' },
        // Remix
        { file: 'remix.config.js',  name: 'Remix',    type: 'fullstack',   language: 'JavaScript' },
        { file: 'remix.config.ts',  name: 'Remix',    type: 'fullstack',   language: 'TypeScript' },
        // Angular
        { file: 'angular.json',     name: 'Angular',  type: 'frontend',    language: 'TypeScript' },
        // Vue
        { file: 'vue.config.js',    name: 'Vue',      type: 'frontend',    language: 'JavaScript' },
        // Nuxt
        { file: 'nuxt.config.ts',   name: 'Nuxt',     type: 'fullstack',   language: 'TypeScript' },
        { file: 'nuxt.config.js',   name: 'Nuxt',     type: 'fullstack',   language: 'JavaScript' },
        // Django
        { file: 'manage.py',        name: 'Django',   type: 'web',         language: 'Python' },
        // Tailwind
        { file: 'tailwind.config.ts', name: 'Tailwind', type: 'ui',        language: 'TypeScript' },
        { file: 'tailwind.config.js', name: 'Tailwind', type: 'ui',        language: 'JavaScript' },
    ];

    for (const signal of configSignals) {
        const alreadyFound = existing.some(f => f.name === signal.name) ||
                             found.some(f => f.name === signal.name);
        if (!alreadyFound && fs.existsSync(path.join(workspacePath, signal.file))) {
            found.push({
                name:     signal.name,
                type:     signal.type,
                language: signal.language,
                source:   signal.file
            });
        }
    }

    return found;
}

export function runCheckpoint4(
    workspacePath: string,
    langResult:    LanguageResult,
    layer1Dir:     string
): FrameworkResult {

    const frameworks:     FrameworkInfo[] = [];
    const manifestsFound: string[]        = [];
    const detectedLangs = langResult.languages.map(l => l.name);

    // ---- Python ----
    if (detectedLangs.includes('Python')) {
        // Search requirements.txt anywhere
        for (const reqPath of findFilesByName(workspacePath, 'requirements.txt')) {
            const rel = path.relative(workspacePath, reqPath);
            manifestsFound.push(rel);
            frameworks.push(...scanForKeywords(
                fs.readFileSync(reqPath, 'utf-8'),
                PYTHON_FRAMEWORKS, 'Python', rel, frameworks
            ));
        }

        // pyproject.toml anywhere
        for (const pyprojPath of findFilesByName(workspacePath, 'pyproject.toml')) {
            const rel = path.relative(workspacePath, pyprojPath);
            manifestsFound.push(rel);
            frameworks.push(...scanForKeywords(
                fs.readFileSync(pyprojPath, 'utf-8'),
                PYTHON_FRAMEWORKS, 'Python', rel, frameworks
            ));
        }

        // setup.py anywhere
        for (const setupPath of findFilesByName(workspacePath, 'setup.py')) {
            const rel = path.relative(workspacePath, setupPath);
            manifestsFound.push(rel);
            frameworks.push(...scanForKeywords(
                fs.readFileSync(setupPath, 'utf-8'),
                PYTHON_FRAMEWORKS, 'Python', rel, frameworks
            ));
        }

        // Pipfile
        for (const pipfilePath of findFilesByName(workspacePath, 'Pipfile')) {
            const rel = path.relative(workspacePath, pipfilePath);
            manifestsFound.push(rel);
            frameworks.push(...scanForKeywords(
                fs.readFileSync(pipfilePath, 'utf-8'),
                PYTHON_FRAMEWORKS, 'Python', rel, frameworks
            ));
        }

        // Fallback: scan .py import statements
        frameworks.push(...scanPythonImports(workspacePath, frameworks));
    }

    // ---- JavaScript / TypeScript ----
    if (detectedLangs.includes('JavaScript') || detectedLangs.includes('TypeScript')) {
        const pkgFiles = findFilesByName(workspacePath, 'package.json')
            .filter(f => !f.includes('node_modules'));

        for (const pkgPath of pkgFiles) {
            const rel = path.relative(workspacePath, pkgPath);
            manifestsFound.push(rel);

            try {
                const pkg     = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                const allDeps = {
                    ...pkg.dependencies    || {},
                    ...pkg.devDependencies || {},
                    ...pkg.peerDependencies || {}
                };

                for (const [name, info] of Object.entries(JS_FRAMEWORKS)) {
                    const alreadyFound = frameworks.some(f => f.name === name);
                    if (!alreadyFound && allDeps[name]) {
                        frameworks.push({
                            name,
                            type:     info.type,
                            language: 'JavaScript/TypeScript',
                            source:   rel
                        });
                    }
                }
            } catch { /* skip malformed */ }
        }
    }

    // ---- Java ----
    if (detectedLangs.includes('Java')) {
        for (const pomPath of findFilesByName(workspacePath, 'pom.xml')) {
            const rel = path.relative(workspacePath, pomPath);
            manifestsFound.push(rel);
            frameworks.push(...scanForKeywords(
                fs.readFileSync(pomPath, 'utf-8'),
                JAVA_FRAMEWORKS, 'Java', rel, frameworks
            ));
        }

        // Gradle
        for (const gradlePath of findFilesByName(workspacePath, 'build.gradle')) {
            const rel = path.relative(workspacePath, gradlePath);
            manifestsFound.push(rel);
            frameworks.push(...scanForKeywords(
                fs.readFileSync(gradlePath, 'utf-8'),
                JAVA_FRAMEWORKS, 'Java', rel, frameworks
            ));
        }5
    }

    // ---- Config file signals (works for any language) ----
    frameworks.push(...detectFromConfigFiles(workspacePath, frameworks));

    const result: FrameworkResult = {
        frameworks,
        totalFound:     frameworks.length,
        manifestsFound: [...new Set(manifestsFound)]
    };

    const outputPath = path.join(layer1Dir, 'frameworks.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(`AIL CP4 | Found ${frameworks.length} frameworks | Sources: ${result.manifestsFound.join(', ')}`);

    return result;
}