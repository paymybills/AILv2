import * as fs from 'fs';
import * as path from 'path';
import { CommitHistoryResult } from './cp1_commit_history';
import { ContributorResult } from './cp2_contributors';
import { FileChurnResult } from './cp3_file_churn';
import { CoChangeResult } from './cp4_co_change';
import { BlastRadiusResult } from './cp5_blast_radius';

export interface Layer3Manifest {
    version: string;
    timestamp: string;
    commitHistory: CommitHistoryResult;
    contributors: ContributorResult;
    fileChurn: FileChurnResult;
    coChange: CoChangeResult;
    blastRadius: BlastRadiusResult;
    summary: {
        totalCommits: number;
        totalContributors: number;
        totalFilesAnalyzed: number;
        hotFileCount: number;
        staleFileCount: number;
        stronglyCoupledPairs: number;
        avgBlastRadius: number;
        dateRange: { first: string; last: string };
    };
}

/**
 * CP6: Assemble Layer 3 manifest (formerly CP4).
 */
export function runCheckpoint6(
    commitResult: CommitHistoryResult,
    contribResult: ContributorResult,
    churnResult: FileChurnResult,
    coChangeResult: CoChangeResult,
    blastResult: BlastRadiusResult,
    layer3Dir: string
): Layer3Manifest {

    const manifest: Layer3Manifest = {
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        commitHistory: commitResult,
        contributors: contribResult,
        fileChurn: churnResult,
        coChange: coChangeResult,
        blastRadius: blastResult,
        summary: {
            totalCommits: commitResult.totalCommits,
            totalContributors: contribResult.totalContributors,
            totalFilesAnalyzed: churnResult.totalFiles,
            hotFileCount: churnResult.hotFiles.length,
            staleFileCount: churnResult.staleFiles.length,
            stronglyCoupledPairs: coChangeResult.stronglyCoupled.length,
            avgBlastRadius: blastResult.avgBlastRadius,
            dateRange: commitResult.dateRange,
        },
    };

    const outputPath = path.join(layer3Dir, 'meta-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

    console.log('AIL L3-CP6 | Layer 3 meta-data.json assembled');
    return manifest;
}
