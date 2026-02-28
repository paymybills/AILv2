export function getPanelHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>AIL Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap" rel="stylesheet"/>
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
            --bg:        #0a0a0f;
            --surface:   #111118;
            --border:    #1e1e2e;
            --accent:    #7c6af7;
            --accent2:   #4fffb0;
            --warn:      #ffb347;
            --text:      #e2e2f0;
            --muted:     #5a5a7a;
            --danger:    #ff4f6a;
            --running:   #4fffb0;
        }

        body {
            background: var(--bg);
            color: var(--text);
            font-family: 'Syne', sans-serif;
            min-height: 100vh;
            overflow-x: hidden;
        }

        /* Noise texture overlay */
        body::before {
            content: '';
            position: fixed;
            inset: 0;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
            pointer-events: none;
            z-index: 0;
            opacity: 0.4;
        }

        .container {
            position: relative;
            z-index: 1;
            max-width: 780px;
            margin: 0 auto;
            padding: 48px 32px;
        }

        /* Header */
        .header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 56px;
            animation: fadeDown 0.5s ease both;
        }

        .logo-block { display: flex; flex-direction: column; gap: 6px; }

        .logo {
            font-size: 13px;
            font-family: 'Space Mono', monospace;
            letter-spacing: 0.25em;
            color: var(--accent);
            text-transform: uppercase;
        }

        h1 {
            font-size: 32px;
            font-weight: 800;
            letter-spacing: -0.03em;
            line-height: 1.1;
            color: var(--text);
        }

        h1 span { color: var(--accent); }

        .subtitle {
            font-size: 13px;
            color: var(--muted);
            font-family: 'Space Mono', monospace;
            margin-top: 8px;
        }

        .status-pill {
            display: flex;
            align-items: center;
            gap: 8px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 100px;
            padding: 8px 16px;
            font-size: 12px;
            font-family: 'Space Mono', monospace;
            color: var(--muted);
        }

        .status-dot {
            width: 7px; height: 7px;
            border-radius: 50%;
            background: var(--accent2);
            box-shadow: 0 0 8px var(--accent2);
            animation: pulse 2s ease infinite;
        }

        /* Pipeline */
        .pipeline {
            display: flex;
            flex-direction: column;
            gap: 0;
        }

        .layer-card {
            position: relative;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 28px 32px;
            margin-bottom: 4px;
            transition: border-color 0.3s, transform 0.2s;
            animation: fadeUp 0.5s ease both;
        }

        .layer-card:nth-child(1) { animation-delay: 0.1s; }
        .layer-card:nth-child(2) { animation-delay: 0.2s; }
        .layer-card:nth-child(3) { animation-delay: 0.3s; }
        .layer-card:nth-child(4) { animation-delay: 0.4s; }

        .layer-card:hover { border-color: #2e2e4e; transform: translateX(4px); }
        .layer-card.active { border-color: var(--accent); }
        .layer-card.complete { border-color: var(--accent2); }
        .layer-card.locked { opacity: 0.45; pointer-events: none; }

        /* Connector line between cards */
        .layer-card:not(:last-child)::after {
            content: '';
            position: absolute;
            bottom: -12px;
            left: 52px;
            width: 1px;
            height: 20px;
            background: var(--border);
            z-index: 2;
        }

        .layer-card.complete:not(:last-child)::after { background: var(--accent2); opacity: 0.5; }

        .card-inner {
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .layer-num {
            width: 44px; height: 44px;
            border-radius: 12px;
            border: 1px solid var(--border);
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Space Mono', monospace;
            font-size: 14px;
            font-weight: 700;
            color: var(--muted);
            flex-shrink: 0;
            transition: all 0.3s;
        }

        .layer-card.active .layer-num {
            background: var(--accent);
            border-color: var(--accent);
            color: #fff;
            box-shadow: 0 0 20px rgba(124,106,247,0.4);
        }

        .layer-card.complete .layer-num {
            background: var(--accent2);
            border-color: var(--accent2);
            color: #0a0a0f;
            box-shadow: 0 0 20px rgba(79,255,176,0.3);
        }

        .layer-info { flex: 1; }

        .layer-tag {
            font-size: 10px;
            font-family: 'Space Mono', monospace;
            letter-spacing: 0.2em;
            color: var(--muted);
            text-transform: uppercase;
            margin-bottom: 4px;
        }

        .layer-title {
            font-size: 17px;
            font-weight: 600;
            color: var(--text);
            margin-bottom: 4px;
        }

        .layer-desc {
            font-size: 12px;
            color: var(--muted);
            font-family: 'Space Mono', monospace;
            line-height: 1.6;
        }

        .layer-status {
            font-size: 11px;
            font-family: 'Space Mono', monospace;
            color: var(--muted);
            margin-top: 6px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .layer-status.running { color: var(--running); }
        .layer-status.complete { color: var(--accent2); }
        .layer-status.error { color: var(--danger); }

        /* Spinner */
        .spinner {
            width: 10px; height: 10px;
            border: 2px solid transparent;
            border-top-color: var(--running);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            display: none;
        }

        .layer-status.running .spinner { display: block; }

        /* Button */
        .run-btn {
            background: transparent;
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 10px 20px;
            font-family: 'Space Mono', monospace;
            font-size: 12px;
            color: var(--text);
            cursor: pointer;
            transition: all 0.2s;
            white-space: nowrap;
            flex-shrink: 0;
        }

        .run-btn:hover {
            background: var(--accent);
            border-color: var(--accent);
            color: #fff;
            box-shadow: 0 0 16px rgba(124,106,247,0.35);
        }

        .run-btn:active { transform: scale(0.97); }

        .run-btn.running {
            background: transparent;
            border-color: var(--running);
            color: var(--running);
            cursor: not-allowed;
        }

        .run-btn.done {
            background: transparent;
            border-color: var(--accent2);
            color: var(--accent2);
            cursor: default;
        }

        /* Output area */
        .output-area {
            margin-top: 16px;
            background: #0d0d14;
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 16px 20px;
            font-family: 'Space Mono', monospace;
            font-size: 11px;
            color: var(--muted);
            line-height: 1.8;
            display: none;
            max-height: 160px;
            overflow-y: auto;
        }

        .output-area.visible { display: block; }
        .output-area .line { color: var(--text); }
        .output-area .line.ok { color: var(--accent2); }
        .output-area .line.info { color: var(--accent); }

        /* Footer */
        .footer {
            margin-top: 48px;
            padding-top: 24px;
            border-top: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            animation: fadeUp 0.5s 0.5s ease both;
        }

        .footer-text {
            font-family: 'Space Mono', monospace;
            font-size: 11px;
            color: var(--muted);
        }

        .footer-text span { color: var(--accent); }

        .run-all-btn {
            background: var(--accent);
            border: none;
            border-radius: 10px;
            padding: 12px 24px;
            font-family: 'Space Mono', monospace;
            font-size: 12px;
            font-weight: 700;
            color: #fff;
            cursor: pointer;
            transition: all 0.2s;
            letter-spacing: 0.05em;
        }

        .run-all-btn:hover {
            background: #9d8fff;
            box-shadow: 0 0 24px rgba(124,106,247,0.5);
            transform: translateY(-1px);
        }

        /* Animations */
        @keyframes fadeDown {
            from { opacity: 0; transform: translateY(-16px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeUp {
            from { opacity: 0; transform: translateY(16px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0.3; }
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
    </style>
</head>
<body>
<div class="container">

    <!-- Header -->
    <div class="header">
        <div class="logo-block">
            <div class="logo">Architectural Intelligence Ledger</div>
            <h1>AIL <span>//</span> Analysis Pipeline</h1>
            <div class="subtitle">// MIT Manipal — Microsoft AI Unlocked 2025</div>
        </div>
        <div class="status-pill">
            <div class="status-dot"></div>
            Extension Active
        </div>
    </div>

    <!-- Pipeline -->
    <div class="pipeline">

        <!-- Layer 1 -->
        <div class="layer-card" id="card-1">
            <div class="card-inner">
                <div class="layer-num">01</div>
                <div class="layer-info">
                    <div class="layer-tag">Layer 1</div>
                    <div class="layer-title">Repository Ingestion</div>
                    <div class="layer-desc">Language detection · Frameworks · Entry points · Baseline metrics</div>
                    <div class="layer-status" id="status-1">— not started</div>
                </div>
                <button class="run-btn" id="btn-1" onclick="runLayer(1)">Run →</button>
            </div>
            <div class="output-area" id="output-1"></div>
        </div>

        <!-- Layer 2 -->
        <div class="layer-card locked" id="card-2">
            <div class="card-inner">
                <div class="layer-num">02</div>
                <div class="layer-info">
                    <div class="layer-tag">Layer 2</div>
                    <div class="layer-title">AST Analysis Engine</div>
                    <div class="layer-desc">Entity extraction · Relationship graph · Call edges · Complexity</div>
                    <div class="layer-status" id="status-2">— waiting for Layer 1</div>
                </div>
                <button class="run-btn" id="btn-2" onclick="runLayer(2)">Run →</button>
            </div>
            <div class="output-area" id="output-2"></div>
        </div>

        <!-- Layer 3 -->
        <div class="layer-card locked" id="card-3">
            <div class="card-inner">
                <div class="layer-num">03</div>
                <div class="layer-info">
                    <div class="layer-tag">Layer 3</div>
                    <div class="layer-title">Temporal Git Intelligence</div>
                    <div class="layer-desc">Commit parsing · Structural diff · ADR generation · Archaeology</div>
                    <div class="layer-status" id="status-3">— waiting for Layer 2</div>
                </div>
                <button class="run-btn" id="btn-3" onclick="runLayer(3)">Run →</button>
            </div>
            <div class="output-area" id="output-3"></div>
        </div>

        <!-- Layer 4 -->
        <div class="layer-card locked" id="card-4">
            <div class="card-inner">
                <div class="layer-num">04</div>
                <div class="layer-info">
                    <div class="layer-tag">Layer 4</div>
                    <div class="layer-title">Agentic Reasoning</div>
                    <div class="layer-desc">Knowledge graph · Chat agent · Blast radius · Health monitor</div>
                    <div class="layer-status" id="status-4">— waiting for Layer 3</div>
                </div>
                <button class="run-btn" id="btn-4" onclick="runLayer(4)">Run →</button>
            </div>
            <div class="output-area" id="output-4"></div>
        </div>

    </div>

    <!-- Footer -->
    <div class="footer">
        <div class="footer-text">Output saved to <span>.ail/</span> in workspace root</div>
        <button class="run-all-btn" onclick="runAll()">Run Full Pipeline ↗</button>
    </div>

</div>

<script>
    const vscode = acquireVsCodeApi();

    const layerState = { 1: 'idle', 2: 'locked', 3: 'locked', 4: 'locked' };

    const layerLogs = {
        1: ['Scanning workspace files...', 'Detecting languages...', 'Scanning frameworks...', 'Finding entry points...', 'Computing metrics...', '✓ manifest saved → .ail/layer1-manifest.json'],
        2: ['Reading Layer 1 manifest...', 'Initializing Tree-sitter parser...', 'Extracting entities...', 'Building relationship graph...', 'Computing call edges...', '✓ graph saved → .ail/layer2-graph.json'],
        3: ['Fetching git history...', 'Parsing commits...', 'Generating structural diffs...', 'Running LLM archaeological context...', 'Drafting ADRs...', '✓ git intelligence saved → .ail/layer3-git.json'],
        4: ['Loading knowledge graph...', 'Initializing agent...', 'Indexing nodes for search...', 'Warming blast radius engine...', 'Starting health monitor...', '✓ Agent ready → AIL Chat active']
    };

    function runLayer(n) {
        if (layerState[n] === 'locked' || layerState[n] === 'running' || layerState[n] === 'complete') return;

        layerState[n] = 'running';

        const card   = document.getElementById('card-' + n);
        const btn    = document.getElementById('btn-' + n);
        const status = document.getElementById('status-' + n);
        const output = document.getElementById('output-' + n);

        card.classList.add('active');
        btn.classList.add('running');
        btn.textContent = '...';

        status.className = 'layer-status running';
        status.innerHTML = '<div class="spinner"></div> running';

        output.innerHTML = '';
        output.classList.add('visible');

        // Send message to extension
        vscode.postMessage({ command: 'runLayer' + n });

        // Simulate log lines appearing
        const logs = layerLogs[n];
        logs.forEach((line, i) => {
            setTimeout(() => {
                const div = document.createElement('div');
                div.className = 'line' + (i === logs.length - 1 ? ' ok' : '');
                div.textContent = '> ' + line;
                output.appendChild(div);
                output.scrollTop = output.scrollHeight;
            }, i * 340);
        });
    }

    function markComplete(n) {
        layerState[n] = 'complete';

        const card   = document.getElementById('card-' + n);
        const btn    = document.getElementById('btn-' + n);
        const status = document.getElementById('status-' + n);

        card.classList.remove('active');
        card.classList.add('complete');
        btn.classList.remove('running');
        btn.classList.add('done');
        btn.textContent = '✓';

        status.className = 'layer-status complete';
        status.textContent = '✓ complete';

        // Unlock next layer
        const next = n + 1;
        if (next <= 4) {
            layerState[next] = 'idle';
            const nextCard   = document.getElementById('card-' + next);
            const nextStatus = document.getElementById('status-' + next);
            nextCard.classList.remove('locked');
            nextStatus.textContent = '— ready to run';
        }
    }

    function runAll() {
        let delay = 0;
        [1, 2, 3, 4].forEach(n => {
            setTimeout(() => {
                if (layerState[n] === 'idle') runLayer(n);
            }, delay);
            delay += layerLogs[n].length * 340 + 600;
        });
    }

    // Listen for messages from extension
    window.addEventListener('message', event => {
        const msg = event.data;
        if (msg.command === 'layerStatus') {
            if (msg.status === 'complete') {
                const logs = layerLogs[msg.layer];
                const totalTime = logs.length * 340 + 200;
                setTimeout(() => markComplete(msg.layer), totalTime);
            }
        }
    });
</script>
</body>
</html>`;
}