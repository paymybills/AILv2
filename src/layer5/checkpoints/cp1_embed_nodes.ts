import * as fs from 'fs';
import * as path from 'path';

export interface NodeEmbedding {
    id: string;
    type: string;
    text: string;           // The pre-computed text representation of this node
    embedding?: number[];   // Vector representation (1536 dims for text-embedding-ada-002/3-small)
}

export interface EmbedResult {
    totalNodes: number;
    embeddedNodes: number;
    skippedNodes: number;
}

/**
 * CP1: Convert Layer 4 Nodes into Embeddings using Azure OpenAI.
 * Note: To prevent huge API bills during dev, we can either mock this or require a VS Code setting.
 */
export async function runCheckpoint1(workspacePath: string, indexDir: string): Promise<EmbedResult> {
    const graphPath = path.join(workspacePath, '.ail', 'layer4', 'analysis', 'knowledge_graph.json');
    if (!fs.existsSync(graphPath)) {
        throw new Error('knowledge_graph.json not found. Did Layer 4 fail?');
    }

    const graphData = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
    const nodes = graphData.nodes || [];

    const nodeEmbeddings: NodeEmbedding[] = [];
    let skipped = 0;

    for (const node of nodes) {
        // Skip unresolved modules or simple imports to save API token costs
        if (node.metadata?.external || node.metadata?.unresolved) {
            skipped++;
            continue;
        }

        // Generate a rich text representation for embedding
        let textRep = `Type: ${node.type}\nName: ${node.name}\nFile: ${node.file || 'unknown'}`;
        if (node.metadata?.churnScore) {
            textRep += `\nGit Churn Score: ${node.metadata.churnScore} (commits: ${node.metadata.commits})`;
        }
        if (node.metadata?.params) {
            textRep += `\nSignature: ${node.name}(${node.metadata.params.join(', ')})`;
        }

        nodeEmbeddings.push({
            id: node.id,
            type: node.type,
            text: textRep,
            // embedding: [] // We will fetch this from Azure OpenAI in the production/chat phase
        });
    }

    // ------------------------------------------------------------------------------------------------
    // TODO: In a real environment, we would batch send `nodeEmbeddings.map(n => n.text)` to Azure OpenAI 
    // Embeddings API here and map the returned float[] arrays back to `node.embedding`.
    // For this prototype, we save the text representations and will optionally compute embeddings on demand.
    // ------------------------------------------------------------------------------------------------

    const outputPath = path.join(indexDir, 'node_embeddings.json');
    fs.writeFileSync(outputPath, JSON.stringify({ nodes: nodeEmbeddings }, null, 2));

    console.log(`AIL L5-CP1 | Processed ${nodeEmbeddings.length} nodes for embedding. Skipped ${skipped}.`);

    return {
        totalNodes: nodes.length,
        embeddedNodes: nodeEmbeddings.length,
        skippedNodes: skipped
    };
}
