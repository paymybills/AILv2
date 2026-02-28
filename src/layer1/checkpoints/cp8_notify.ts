import * as vscode from 'vscode';
import { Layer1Manifest } from './cp7_assemble_manifest';

export function runCheckpoint8(manifest: Layer1Manifest): void {

    const langList = manifest.languages.languages
        .map(l => `${l.name} ${l.percentage}%`)
        .join(', ');

    const fwList = manifest.frameworks.frameworks
        .map(f => f.name)
        .join(', ') || 'none detected';

    const summary = [
        `✓ Layer 1 complete`,
        `Language: ${langList}`,
        `Frameworks: ${fwList}`,
        `Entry point: ${manifest.entryPoints.primaryEntry ?? 'not found'}`,
        `Total LOC: ${manifest.metrics.totalLines.toLocaleString()}`
    ].join(' · ');

    vscode.window.showInformationMessage(summary);

    console.log('AIL CP8 |', summary);
}