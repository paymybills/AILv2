import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface CommitImpact {
    hash: string;
    message: string;
    author: string;
    date: string;
    directFiles: string[];       // Files actually changed in this commit
    transitiveFiles: string[];   // Files that import the changed files (downstream)
    directCount: number;
    transitiveCount: number;
    blastRadius: number;         // directCount + transitiveCount
}

export interface BlastRadiusResult {
    commits: CommitImpact[];
    avgBlastRadius: number;
    maxBlastRadius: CommitImpact | null;
    highImpactCommits: CommitImpact[]; // Top 10% by blast radius
}

/**
 * CP5: Compute blast radius for each commit.
 * Cross-references changed files with Layer 2's import graph to find transitive impact.
 */
export function runCheckpoint5(gitRepos: string[], workspacePath: string, analysisDir: string): BlastRadiusResult {
    // Load the import graph from Layer 2
    const importGraphPath = path.join(workspacePath, '.ail', 'layer2', 'analysis', 'imports.json');
    let reverseImportMap = new Map<string, Set<string>>(); // file → set of files that import it

    if (fs.existsSync(importGraphPath)) {
        const importData = JSON.parse(fs.readFileSync(importGraphPath, 'utf-8'));
        const imports = importData.imports || [];
        for (const imp of imports) {
            if (!imp.isExternal && imp.targetFile) {
                if (!reverseImportMap.has(imp.targetFile)) {
                    reverseImportMap.set(imp.targetFile, new Set());
                }
                reverseImportMap.get(imp.targetFile)!.add(imp.sourceFile);
            }
        }
    }

    // Helper: find all transitive dependents of a file
    function getTransitiveDependents(file: string, visited = new Set<string>()): Set<string> {
        if (visited.has(file)) { return new Set(); }
        visited.add(file);

        const directDeps = reverseImportMap.get(file);
        if (!directDeps) { return new Set(); }

        const result = new Set<string>();
        for (const dep of directDeps) {
            result.add(dep);
            // Recurse (cap depth to avoid infinite loops)
            if (visited.size < 200) {
                for (const transitive of getTransitiveDependents(dep, visited)) {
                    result.add(transitive);
                }
            }
        }
        return result;
    }

    const commitImpacts: CommitImpact[] = [];

    for (const repoPath of gitRepos) {
        try {
            // Get last 100 commits with the files they changed
            const raw = execSync(
                'git log -100 --name-only --pretty=format:"COMMIT|||%H|||%an|||%aI|||%s"',
                { cwd: repoPath, encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 }
            );

            let prefix = path.relative(workspacePath, repoPath).replace(/\\/g, '/');
            if (prefix && !prefix.endsWith('/')) { prefix += '/'; }

            let current: Partial<CommitImpact> | null = null;
            let currentDirectFiles: string[] = [];

            for (const line of raw.split('\n')) {
                const trimmed = line.trim();
                if (!trimmed) { continue; }

                if (trimmed.startsWith('COMMIT|||')) {
                    // Finalize previous commit
                    if (current && current.hash) {
                        const transitiveSet = new Set<string>();
                        for (const file of currentDirectFiles) {
                            for (const dep of getTransitiveDependents(file)) {
                                if (!currentDirectFiles.includes(dep)) {
                                    transitiveSet.add(dep);
                                }
                            }
                        }

                        current.directFiles = currentDirectFiles;
                        current.transitiveFiles = Array.from(transitiveSet);
                        current.directCount = currentDirectFiles.length;
                        current.transitiveCount = transitiveSet.size;
                        current.blastRadius = currentDirectFiles.length + transitiveSet.size;
                        commitImpacts.push(current as CommitImpact);
                    }

                    const parts = trimmed.split('|||');
                    current = {
                        hash: parts[1],
                        author: parts[2],
                        date: parts[3],
                        message: parts[4] || '',
                    };
                    currentDirectFiles = [];
                    continue;
                }

                if (current) {
                    const file = prefix + trimmed;
                    if (!file.includes('node_modules') && !file.includes('.lock')) {
                        currentDirectFiles.push(file);
                    }
                }
            }

            // Finalize last commit
            if (current && current.hash) {
                const transitiveSet = new Set<string>();
                for (const file of currentDirectFiles) {
                    for (const dep of getTransitiveDependents(file)) {
                        if (!currentDirectFiles.includes(dep)) {
                            transitiveSet.add(dep);
                        }
                    }
                }
                current.directFiles = currentDirectFiles;
                current.transitiveFiles = Array.from(transitiveSet);
                current.directCount = currentDirectFiles.length;
                current.transitiveCount = transitiveSet.size;
                current.blastRadius = currentDirectFiles.length + transitiveSet.size;
                commitImpacts.push(current as CommitImpact);
            }
        } catch (err: any) {
            console.warn(`Blast radius analysis failed in repo ${repoPath}: ${err.message || err}`);
        }
    }

    // Sort by blast radius descending
    commitImpacts.sort((a, b) => b.blastRadius - a.blastRadius);

    const avgBlastRadius = commitImpacts.length > 0
        ? parseFloat((commitImpacts.reduce((s, c) => s + c.blastRadius, 0) / commitImpacts.length).toFixed(1))
        : 0;

    const highImpactThreshold = Math.max(1, Math.floor(commitImpacts.length * 0.1));
    const highImpactCommits = commitImpacts.slice(0, highImpactThreshold);

    const result: BlastRadiusResult = {
        commits: commitImpacts,
        avgBlastRadius,
        maxBlastRadius: commitImpacts.length > 0 ? commitImpacts[0] : null,
        highImpactCommits,
    };

    const outputPath = path.join(analysisDir, 'blast_radius.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

    console.log(`AIL L3-CP5 | ${commitImpacts.length} commits | avg blast radius: ${avgBlastRadius} | max: ${commitImpacts[0]?.blastRadius || 0}`);
    return result;
}
