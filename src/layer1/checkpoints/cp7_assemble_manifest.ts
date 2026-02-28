import * as fs from 'fs';
import * as path from 'path';
import { FileScanResult }   from './cp2_filescanner';
import { LanguageResult }   from './cp3_language_detector';
import { FrameworkResult }  from './cp4_framework_scanner';
import { EntryPointResult } from './cp5_entrypoint_finder';
import { MetricsResult }    from './cp6_metrics';

export interface Layer1Manifest {
    version:         string;
    timestamp:       string;
    workspacePath:   string;
    primaryLanguage: string;
    extensionCounts: Record<string, number>;
    languages:       LanguageResult;
    frameworks:      FrameworkResult;
    entryPoints:     EntryPointResult;
    metrics:         MetricsResult;
}

export function runCheckpoint7(
    workspacePath: string,
    scanResult:    FileScanResult,
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
        extensionCounts: scanResult.extensionCounts,
        languages:       langResult,
        frameworks:      fwResult,
        entryPoints:     epResult,
        metrics:         metricsResult
    };

    const outputPath = path.join(layer1Dir, 'meta-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

    console.log('AIL CP7 | meta-data.json assembled → .ail/layer1/meta-data.json');

    return manifest;
}