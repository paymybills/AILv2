import * as fs from 'fs';
import * as path from 'path';
import { EmbedResult } from './cp1_embed_nodes';

export interface Layer5Manifest {
    version: string;
    timestamp: string;
    embedStats: EmbedResult;
}

/**
 * CP2: Assemble Layer 5 GraphRAG meta-data manifest.
 */
export function runCheckpoint2(embedStats: EmbedResult, layer5Dir: string): Layer5Manifest {
    const manifest: Layer5Manifest = {
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        embedStats
    };

    const outputPath = path.join(layer5Dir, 'meta-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

    console.log(`AIL L5-CP2 | Manifest generated: ${embedStats.embeddedNodes} nodes ready for GraphRAG search.`);
    return manifest;
}
