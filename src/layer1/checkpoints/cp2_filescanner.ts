import * as fs from 'fs';
import * as path from 'path';

const EXCLUDE_DIRS = new Set([
    'node_modules', '.git', 'venv', '.venv',
    '__pycache__', 'dist', 'build', '.next',
    'out', 'target', '.ail', 'env', 'AutoAI_ENV'
]);

export interface ScannedFile {
    relativePath: string;
    extension:    string;
    sizeBytes:    number;
}

export interface FileScanResult {
    extensionCounts: Record<string, number>;  // ← moved to top
    totalFiles:      number;
    files:           ScannedFile[];
}

export function runCheckpoint2(workspacePath: string, analysisDir: string): FileScanResult {

    const files: ScannedFile[] = [];

    function walk(dirPath: string) {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dirPath, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (!EXCLUDE_DIRS.has(entry.name)) {
                    walk(path.join(dirPath, entry.name));
                }
            } else if (entry.isFile()) {
                const fullPath     = path.join(dirPath, entry.name);
                const relativePath = path.relative(workspacePath, fullPath);
                const extension    = path.extname(entry.name).toLowerCase();
                const sizeBytes    = fs.statSync(fullPath).size;

                files.push({ relativePath, extension, sizeBytes });
            }
        }
    }

    walk(workspacePath);

    // Count by extension
    const extensionCounts: Record<string, number> = {};
    for (const file of files) {
        const ext = file.extension || '(no extension)';
        extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
    }

    // Sort extensionCounts by count descending
    const sortedExtensionCounts = Object.fromEntries(
        Object.entries(extensionCounts).sort(([, a], [, b]) => b - a)
    );

    const result: FileScanResult = {
        extensionCounts: sortedExtensionCounts,  // ← first
        totalFiles:      files.length,
        files
    };

    const outputPath = path.join(analysisDir, 'file_scan.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(`AIL CP2 | Found ${files.length} files | Saved analysis/file_scan.json`);

    return result;
}