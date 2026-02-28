import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { runCheckpoint1 }                        from './checkpoints/cp1_workspace';
import { runCheckpoint2 }                        from './checkpoints/cp2_filescanner';
import { runCheckpoint3 }                        from './checkpoints/cp3_language_detector';
import { runCheckpoint4 }                        from './checkpoints/cp4_framework_scanner';
import { runCheckpoint5 }                        from './checkpoints/cp5_entrypoint_finder';
import { runCheckpoint6 }                        from './checkpoints/cp6_metrics';
import { runCheckpoint7 }                        from './checkpoints/cp7_assemble_manifest';
import { runCheckpoint8 }                        from './checkpoints/cp8_notify';

export function runLayer1(): void {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('AIL: No workspace folder open!');
        return;
    }

    const workspacePath = workspaceFolders[0].uri.fsPath;

    // Create folder structure
    const ailRoot   = path.join(workspacePath, '.ail');
    const layer1Dir = path.join(ailRoot, 'layer1');

    if (!fs.existsSync(ailRoot))   { fs.mkdirSync(ailRoot); }
    if (!fs.existsSync(layer1Dir)) { fs.mkdirSync(layer1Dir); }

    // Run all checkpoints in order, passing outputs forward
    runCheckpoint1(workspacePath, layer1Dir);
    const scanResult    = runCheckpoint2(workspacePath, layer1Dir);
    const langResult    = runCheckpoint3(scanResult,    layer1Dir);
    const fwResult      = runCheckpoint4(workspacePath, langResult, layer1Dir);
    const epResult      = runCheckpoint5(workspacePath, langResult, fwResult, layer1Dir);
    const metricsResult = runCheckpoint6(workspacePath, scanResult, layer1Dir);
    const manifest      = runCheckpoint7(workspacePath, langResult, fwResult, epResult, metricsResult, layer1Dir);
    runCheckpoint8(manifest);
}
