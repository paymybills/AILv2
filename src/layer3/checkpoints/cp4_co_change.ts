import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface CoChangePair {
    fileA: string;
    fileB: string;
    coChanges: number;       // Number of commits where both changed
    totalChangesA: number;   // Total commits for fileA
    totalChangesB: number;   // Total commits for fileB
    couplingStrength: number; // coChanges / max(totalA, totalB) — 0 to 1
}

export interface CoChangeResult {
    pairs: CoChangePair[];
    totalPairsAnalyzed: number;
    stronglyCoupled: CoChangePair[]; // > 0.5 coupling
}

/**
 * CP4: Analyze which files change together (co-change coupling).
 * Files that always change together reveal hidden architectural coupling.
 */
export function runCheckpoint4(gitRepos: string[], workspacePath: string, analysisDir: string): CoChangeResult {
    // Map: commitHash → set of changed files
    const commitFiles = new Map<string, Set<string>>();
    // Map: file → total commit count
    const fileTotalCommits = new Map<string, number>();

    for (const repoPath of gitRepos) {
        try {
            // Get commit hashes with their changed files (last 300 commits for perf)
            const raw = execSync(
                'git log -300 --name-only --pretty=format:"COMMIT|||%H"',
                { cwd: repoPath, encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 }
            );

            let prefix = path.relative(workspacePath, repoPath).replace(/\\/g, '/');
            if (prefix && !prefix.endsWith('/')) { prefix += '/'; }

            let currentHash = '';
            for (const line of raw.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed) { continue; }

                if (trimmed.startsWith('COMMIT|||')) {
                    currentHash = trimmed.split('|||')[1];
                    if (!commitFiles.has(currentHash)) {
                        commitFiles.set(currentHash, new Set());
                    }
                    continue;
                }

                if (currentHash) {
                    const file = prefix + trimmed;
                    commitFiles.get(currentHash)!.add(file);
                    fileTotalCommits.set(file, (fileTotalCommits.get(file) || 0) + 1);
                }
            }
        } catch (err: any) {
            console.warn(`Co-change analysis failed in repo ${repoPath}: ${err.message || err}`);
        }
    }

    // Build co-change counts for file pairs
    const pairMap = new Map<string, number>(); // "fileA|||fileB" → count

    for (const [, files] of commitFiles) {
        const fileList = Array.from(files).filter(f =>
            !f.includes('node_modules') && !f.includes('.lock') && !f.includes('package-lock')
        );

        // Only analyze commits with a reasonable number of files (skip mass renames etc.)
        if (fileList.length < 2 || fileList.length > 30) { continue; }

        for (let i = 0; i < fileList.length; i++) {
            for (let j = i + 1; j < fileList.length; j++) {
                // Sort to ensure consistent key ordering
                const [a, b] = [fileList[i], fileList[j]].sort();
                const key = `${a}|||${b}`;
                pairMap.set(key, (pairMap.get(key) || 0) + 1);
            }
        }
    }

    // Convert to CoChangePair array and calculate coupling strength
    const pairs: CoChangePair[] = [];
    for (const [key, coChanges] of pairMap) {
        if (coChanges < 2) { continue; } // Ignore single co-occurrences (noise)

        const [fileA, fileB] = key.split('|||');
        const totalA = fileTotalCommits.get(fileA) || 1;
        const totalB = fileTotalCommits.get(fileB) || 1;
        const couplingStrength = coChanges / Math.max(totalA, totalB);

        pairs.push({ fileA, fileB, coChanges, totalChangesA: totalA, totalChangesB: totalB, couplingStrength });
    }

    // Sort by coupling strength descending
    pairs.sort((a, b) => b.couplingStrength - a.couplingStrength);

    const stronglyCoupled = pairs.filter(p => p.couplingStrength > 0.5);

    const result: CoChangeResult = {
        pairs: pairs.slice(0, 200), // Top 200 pairs
        totalPairsAnalyzed: pairMap.size,
        stronglyCoupled: stronglyCoupled.slice(0, 50),
    };

    const outputPath = path.join(analysisDir, 'co_change.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(`AIL L3-CP4 | ${pairMap.size} file pairs analyzed | ${stronglyCoupled.length} strongly coupled (>50%)`);
    return result;
}
