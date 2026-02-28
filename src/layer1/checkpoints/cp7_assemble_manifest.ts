import * as fs from 'fs';
import * as path from 'path';
import { LanguageResult }   from './cp3_language_detector';
import { FrameworkResult }  from './cp4_framework_scanner';
import { EntryPointResult } from './cp5_entrypoint_finder';
import { MetricsResult }    from './cp6_metrics';

export interface Layer1Manifest {
    version:        string;
    timestamp:      string;
    workspacePath:  string;
    primaryLanguage: string;
    languages:      LanguageResult;
    frameworks:     FrameworkResult;
    entryPoints:    EntryPointResult;
    metrics:        MetricsResult;
}

export function runCheckpoint7(
    workspacePath: string,
    langResult:    LanguageResult,
    fwResult:      FrameworkResult,
    epResult:      EntryPointResult,
    metricsResult: MetricsResult,
    layer1Dir:     string
): Layer1Manifest {

    const manifest: Layer1Manifest = {
        version:         '1.0.0',
        timestamp:       new Date().toISOString(),
        workspacePath,
        primaryLanguage: langResult.primary,
        languages:       langResult,
        frameworks:      fwResult,
        entryPoints:     epResult,
        metrics:         metricsResult
    };

    // Save as the single source of truth for Layer 2
    const outputPath = path.join(layer1Dir, 'manifest.json');
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

    console.log('AIL CP7 | Layer 1 manifest assembled → .ail/layer1/manifest.json');

    return manifest;
}