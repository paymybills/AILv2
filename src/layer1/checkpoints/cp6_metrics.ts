import * as fs from 'fs';
import * as path from 'path';
import { FileScanResult } from './cp2_filescanner';

export interface FileMetric {
    relativePath: string;
    lines:        number;
    sizeBytes:    number;
    extension:    string;
}

export interface MetricsResult {
    totalFiles:        number;
    totalLines:        number;
    totalSizeBytes:    number;
    totalSizeKB:       number;
    avgLinesPerFile:   number;
    largestFiles:      FileMetric[];  // top 10 by lines
    languageLineBreak: Record<string, number>; // lines per language
}

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
    '.py':   'Python',
    '.js':   'JavaScript',
    '.ts':   'TypeScript',
    '.jsx':  'JavaScript',
    '.tsx':  'TypeScript',
    '.java': 'Java',
    '.go':   'Go',
    '.rs':   'Rust',
    '.cpp':  'C++',
    '.c':    'C',
    '.cs':   'C#',
    '.rb':   'Ruby',
    '.php':  'PHP'
};

// Source code extensions only — skip .json, .md, .txt for line counts
const SOURCE_EXTENSIONS = new Set(Object.keys(EXTENSION_TO_LANGUAGE));

export function runCheckpoint6(
    workspacePath: string,
    scanResult:    FileScanResult,
    layer1Dir:     string
): MetricsResult {

    const fileMetrics:        FileMetric[]             = [];
    const languageLineBreak:  Record<string, number>   = {};

    let totalLines     = 0;
    let totalSizeBytes = 0;

    // Only process source files
    const sourceFiles = scanResult.files.filter(f => SOURCE_EXTENSIONS.has(f.extension));

    for (const file of sourceFiles) {
        const fullPath = path.join(workspacePath, file.relativePath);

        let content: string;
        try { content = fs.readFileSync(fullPath, 'utf-8'); }
        catch { continue; }

        const lines = content.split('\n').length;

        totalLines     += lines;
        totalSizeBytes += file.sizeBytes;

        fileMetrics.push({
            relativePath: file.relativePath,
            lines,
            sizeBytes:    file.sizeBytes,
            extension:    file.extension
        });

        // Accumulate lines per language
        const lang = EXTENSION_TO_LANGUAGE[file.extension];
        if (lang) {
            languageLineBreak[lang] = (languageLineBreak[lang] || 0) + lines;
        }
    }

    // Top 10 largest files by line count
    const largestFiles = [...fileMetrics]
        .sort((a, b) => b.lines - a.lines)
        .slice(0, 10);

    const result: MetricsResult = {
        totalFiles:        sourceFiles.length,
        totalLines,
        totalSizeBytes,
        totalSizeKB:       parseFloat((totalSizeBytes / 1024).toFixed(2)),
        avgLinesPerFile:   sourceFiles.length > 0
                            ? Math.round(totalLines / sourceFiles.length)
                            : 0,
        largestFiles,
        languageLineBreak
    };

    const outputPath = path.join(layer1Dir, 'metrics.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(`AIL CP6 | ${totalLines} total lines | ${result.totalSizeKB} KB | Largest: ${largestFiles[0]?.relativePath}`);

    return result;
}