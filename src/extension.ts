import * as vscode from 'vscode';
import { PanelManager } from './panel/panelManager';

interface ValuedQuickPickItem extends vscode.QuickPickItem {
    value: string;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('AIL Extension is now active!');

    const helloWorld = vscode.commands.registerCommand('ail-extension.helloWorld', () => {
        triggerAILPopup(context);
    });

    const runAIL = vscode.commands.registerCommand('ail-extension.runAIL', () => {
        triggerAILPopup(context);
    });

    context.subscriptions.push(helloWorld, runAIL);
}

async function triggerAILPopup(context: vscode.ExtensionContext) {
    const confirm = await vscode.window.showInformationMessage(
        'AIL: Ready to analyze your workspace. Start analysis?',
        'Run AIL Analysis'
    );
    if (confirm !== 'Run AIL Analysis') { return; }

    const config = vscode.workspace.getConfiguration('ail');

    // Always ask the user which provider they want to use
    const providerChoice = await vscode.window.showQuickPick<ValuedQuickPickItem>(
        [
            { label: '$(sparkle) Gemini', description: 'Google Gemini API', value: 'gemini' },
            { label: '$(azure) Azure OpenAI', description: 'Azure OpenAI Service', value: 'azure' }
        ],
        { placeHolder: 'Select your AI provider', ignoreFocusOut: true }
    );

    if (!providerChoice) { return; }

    const provider = providerChoice.value;
    await config.update('aiProvider', provider, vscode.ConfigurationTarget.Global);

    if (provider === 'gemini') {
        let geminiKey = config.get<string>('geminiApiKey');
        if (!geminiKey) {
            const input = await vscode.window.showInputBox({
                prompt: 'Enter your Google Gemini API Key',
                password: true,
                ignoreFocusOut: true,
                placeHolder: 'AIzaSy...'
            });
            if (input) {
                await config.update('geminiApiKey', input, vscode.ConfigurationTarget.Global);
                geminiKey = input;
            } else {
                vscode.window.showWarningMessage('AIL: No Gemini API Key provided. RAG features will not work.');
            }
        }

        // Fetch available models and let the user pick
        if (geminiKey) {
            try {
                const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`;
                const res = await fetch(listUrl);
                if (res.ok) {
                    const data = await res.json() as any;
                    const models: ValuedQuickPickItem[] = (data.models || [])
                        .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
                        .map((m: any) => ({
                            label: m.displayName || m.name,
                            description: m.name.replace('models/', ''),
                            detail: m.description?.slice(0, 100) || '',
                            value: m.name.replace('models/', '')
                        }));

                    if (models.length > 0) {
                        const currentModel = config.get<string>('geminiModel');
                        const modelChoice = await vscode.window.showQuickPick<ValuedQuickPickItem>(models, {
                            placeHolder: currentModel ? `Current: ${currentModel} — pick a new model or Escape to keep` : 'Select a Gemini model',
                            ignoreFocusOut: true
                        });
                        if (modelChoice) {
                            await config.update('geminiModel', modelChoice.value, vscode.ConfigurationTarget.Global);
                        }
                    }
                }
            } catch (err) {
                console.warn('AIL: Could not fetch Gemini models, using default.', err);
            }
        }
    } else if (provider === 'azure') {
        let azureEndpoint = config.get<string>('azureOpenAiEndpoint');
        let azureKey = config.get<string>('azureOpenAiApiKey');

        if (!azureEndpoint) {
            const endpointInput = await vscode.window.showInputBox({
                prompt: 'Enter your Azure OpenAI Endpoint URL',
                ignoreFocusOut: true,
                placeHolder: 'https://my-resource.openai.azure.com/'
            });
            if (endpointInput) {
                await config.update('azureOpenAiEndpoint', endpointInput, vscode.ConfigurationTarget.Global);
            }
        }

        if (!azureKey) {
            const keyInput = await vscode.window.showInputBox({
                prompt: 'Enter your Azure OpenAI API Key',
                password: true,
                ignoreFocusOut: true
            });
            if (keyInput) {
                await config.update('azureOpenAiApiKey', keyInput, vscode.ConfigurationTarget.Global);
            } else {
                vscode.window.showWarningMessage('AIL: No Azure API Key provided. RAG features will not work.');
            }
        }
    }

    PanelManager.createOrShow(context);
}

export function deactivate() { }