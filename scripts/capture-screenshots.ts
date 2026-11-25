import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function run() {
  const browser = await chromium.launch();
  const artifactDir = 'C:/Users/MWESIGWA JONATHAN/.gemini/antigravity/brain/0b302481-7d9a-4984-9aa7-c4df67e636a2';

  const distDir = path.resolve('dist');
  const cssFile = fs.readdirSync(path.join(distDir, 'assets')).find((f) => f.endsWith('.css'));
  const cssContent = fs.readFileSync(path.join(distDir, 'assets', cssFile!), 'utf8');

  const katexCssPath = path.resolve('node_modules/katex/dist/katex.min.css');
  const katexCss = fs.existsSync(katexCssPath) ? fs.readFileSync(katexCssPath, 'utf8') : '';

  const getHtml = (isDark: boolean) => `
<!DOCTYPE html>
<html lang="en" class="${isDark ? 'dark' : ''}" style="${isDark ? 'color-scheme: dark;' : 'color-scheme: light;'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${cssContent}
    ${katexCss}
    body {
      margin: 0;
      background-color: var(--thread-bg);
      color: var(--thread-text);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
  </style>
</head>
<body class="bg-thread-bg text-thread-text antialiased min-h-screen flex flex-col">
  <header class="shrink-0 h-[60px] border-b border-thread-border px-4 flex items-center justify-between gap-3 bg-thread-bg">
    <div class="flex items-center gap-3 min-w-0">
      <svg class="w-5 h-5 text-thread-accent shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
      <h1 class="text-sm font-semibold text-thread-text truncate">Thread AI</h1>
    </div>
    <div class="flex items-center gap-3 shrink-0">
      <span class="text-xs text-thread-muted">4/5 left</span>
      <button class="p-2 rounded-xl text-thread-muted hover:text-thread-text hover:bg-thread-soft flex items-center justify-center min-h-[44px] min-w-[44px]">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>
    </div>
  </header>

  <main class="flex-1 overflow-y-auto px-4 py-6">
    <div class="max-w-[70ch] mx-auto w-full space-y-6">
      <div class="flex flex-col items-end w-full">
        <div class="max-w-[85%] sm:max-w-md px-4 py-2.5 rounded-2xl rounded-tr-none bg-thread-bubble-mine text-thread-bubble-mine-text text-sm whitespace-pre-wrap break-words shadow-sm">
          What is cellular respiration? Compare its stages, provide the chemical formula, and compute net ATP.
        </div>
      </div>

      <div class="ai-response-item flex flex-col items-start w-full">
        <div class="flex items-center gap-1.5 text-xs font-semibold text-thread-muted mb-1.5 select-none">
          <svg class="w-3.5 h-3.5 text-thread-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          <span>Thread AI</span>
        </div>

        <div class="w-full text-thread-text text-base thread-ai-markdown">
          <h2>Cellular Respiration Mechanism</h2>
          <p>Cellular respiration is the biochemical mechanism by which cells harvest chemical energy stored in glucose molecules to generate adenosine triphosphate (ATP).</p>

          <h3>Process Stages</h3>
          <ol>
            <li><strong>Glycolysis:</strong> Anaerobic pathway in the cytosol yielding 2 pyruvate, 2 net ATP, and 2 NADH.</li>
            <li><strong>Citric Acid Cycle:</strong> Mitochondrial matrix oxidation of acetyl-CoA producing reducing equivalents ($6\\,\\mathrm{NADH}$, $2\\,\\mathrm{FADH_2}$).</li>
            <li><strong>Oxidative Phosphorylation:</strong> Chemiosmotic ATP synthase driven by proton gradient across inner membrane.</li>
          </ol>

          <h3>Overall Net Formula</h3>
          <p>The net balanced reaction for aerobic glucose breakdown:</p>
          <div class="katex-display"><span class="katex"><span class="katex-html"><span class="base"><span class="mord"><span class="mathrm">C</span><span class="msupsub"><span class="vlist-t vlist-t2"><span class="vlist-r"><span class="vlist" style="height:0.15em;"><span style="top:-0.15em;margin-right:0.05em;"><span class="pstrut" style="height:2.7em;"></span><span class="sizing reset-size6 size3 mtight"><span class="mord mtight">6</span></span></span></span><span class="vlist-s">&#8203;</span></span><span class="vlist-r"><span class="vlist" style="height:0.15em;"><span></span></span></span></span></span><span class="mathrm">H</span><span class="msupsub"><span class="vlist-t vlist-t2"><span class="vlist-r"><span class="vlist" style="height:0.15em;"><span style="top:-0.15em;margin-right:0.05em;"><span class="pstrut" style="height:2.7em;"></span><span class="sizing reset-size6 size3 mtight"><span class="mord mtight">12</span></span></span></span><span class="vlist-s">&#8203;</span></span><span class="vlist-r"><span class="vlist" style="height:0.15em;"><span></span></span></span></span></span><span class="mathrm">O</span><span class="msupsub"><span class="vlist-t vlist-t2"><span class="vlist-r"><span class="vlist" style="height:0.15em;"><span style="top:-0.15em;margin-right:0.05em;"><span class="pstrut" style="height:2.7em;"></span><span class="sizing reset-size6 size3 mtight"><span class="mord mtight">6</span></span></span></span><span class="vlist-s">&#8203;</span></span><span class="vlist-r"><span class="vlist" style="height:0.15em;"><span></span></span></span></span></span></span><span class="mbin">+</span><span class="mord">6</span><span class="mord"><span class="mathrm">O</span><span class="msupsub"><span class="vlist-t vlist-t2"><span class="vlist-r"><span class="vlist" style="height:0.15em;"><span style="top:-0.15em;margin-right:0.05em;"><span class="pstrut" style="height:2.7em;"></span><span class="sizing reset-size6 size3 mtight"><span class="mord mtight">2</span></span></span></span><span class="vlist-s">&#8203;</span></span><span class="vlist-r"><span class="vlist" style="height:0.15em;"><span></span></span></span></span></span><span class="mspace" style="margin-right:0.27em;"></span><span class="mrel">&rarr;</span><span class="mspace" style="margin-right:0.27em;"></span><span class="mord">6</span><span class="mord"><span class="mathrm">CO</span><span class="msupsub"><span class="vlist-t vlist-t2"><span class="vlist-r"><span class="vlist" style="height:0.15em;"><span style="top:-0.15em;margin-right:0.05em;"><span class="pstrut" style="height:2.7em;"></span><span class="sizing reset-size6 size3 mtight"><span class="mord mtight">2</span></span></span></span><span class="vlist-s">&#8203;</span></span><span class="vlist-r"><span class="vlist" style="height:0.15em;"><span></span></span></span></span></span><span class="mbin">+</span><span class="mord">6</span><span class="mord"><span class="mathrm">H</span><span class="msupsub"><span class="vlist-t vlist-t2"><span class="vlist-r"><span class="vlist" style="height:0.15em;"><span style="top:-0.15em;margin-right:0.05em;"><span class="pstrut" style="height:2.7em;"></span><span class="sizing reset-size6 size3 mtight"><span class="mord mtight">2</span></span></span></span><span class="vlist-s">&#8203;</span></span><span class="vlist-r"><span class="vlist" style="height:0.15em;"><span></span></span></span></span></span><span class="mathrm">O</span><span class="mbin">+</span><span class="mord text"><span class="mord">&Delta;G&#778; = -2870 kJ/mol</span></span></span></span></span></div>

          <p>Fractional energy conversion efficiency is roughly <span class="katex"><span class="katex-html"><span class="base"><span class="mord"><span class="mopen nulldelimiter"></span><span class="mfrac"><span class="vlist-t vlist-t2"><span class="vlist-r"><span class="vlist" style="height:0.84em;"><span style="top:-2.65em;"><span class="pstrut" style="height:3em;"></span><span class="sizing reset-size6 size3 mtight"><span class="mord mtight">38</span></span></span><span style="top:-3.23em;"><span class="pstrut" style="height:3em;"></span><span class="frac-line" style="border-bottom-width:0.04em;"></span></span><span style="top:-3.39em;"><span class="pstrut" style="height:3em;"></span><span class="sizing reset-size6 size3 mtight"><span class="mord mtight">100</span></span></span></span><span class="vlist-s">&#8203;</span></span><span class="vlist-r"><span class="vlist" style="height:0.35em;"><span></span></span></span></span></span><span class="mclose nulldelimiter"></span></span></span></span></span> (&sim;38%).</p>

          <h3>Pathway Comparison</h3>
          <div class="my-3 overflow-x-auto rounded-lg border border-thread-border max-w-full">
            <table class="min-w-full divide-y divide-thread-border text-sm">
              <thead class="bg-thread-soft text-thread-text font-semibold">
                <tr>
                  <th class="px-3 py-2 text-left text-xs uppercase tracking-wider">Pathway</th>
                  <th class="px-3 py-2 text-left text-xs uppercase tracking-wider">Cellular Location</th>
                  <th class="px-3 py-2 text-left text-xs uppercase tracking-wider">Reactants</th>
                  <th class="px-3 py-2 text-left text-xs uppercase tracking-wider">Net ATP</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-thread-border bg-transparent">
                <tr>
                  <td class="px-3 py-2 text-sm">Glycolysis</td>
                  <td class="px-3 py-2 text-sm">Cytoplasm</td>
                  <td class="px-3 py-2 text-sm">Glucose, 2 NAD+, 2 ADP</td>
                  <td class="px-3 py-2 text-sm">2 ATP</td>
                </tr>
                <tr>
                  <td class="px-3 py-2 text-sm">Krebs Cycle</td>
                  <td class="px-3 py-2 text-sm">Mitochondrial Matrix</td>
                  <td class="px-3 py-2 text-sm">Acetyl-CoA, Oxaloacetate</td>
                  <td class="px-3 py-2 text-sm">2 ATP</td>
                </tr>
                <tr>
                  <td class="px-3 py-2 text-sm">Oxidative Phos.</td>
                  <td class="px-3 py-2 text-sm">Inner Mitochondrial Membrane</td>
                  <td class="px-3 py-2 text-sm">NADH, FADH2, O2, ADP</td>
                  <td class="px-3 py-2 text-sm">26–28 ATP</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3>Theoretical ATP Calculation</h3>
          <div class="relative my-3 rounded-xl overflow-hidden bg-thread-surface border border-thread-border text-thread-text">
            <div class="flex items-center justify-between px-3.5 py-1.5 bg-thread-soft/50 border-b border-thread-border text-xs text-thread-muted font-mono">
              <span>python</span>
              <button class="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-thread-muted hover:text-thread-text hover:bg-thread-soft transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                <span>Copy</span>
              </button>
            </div>
            <div class="p-3.5 overflow-x-auto text-xs sm:text-sm font-mono leading-relaxed">
              <pre class="!bg-transparent !p-0 !m-0"><code>def calculate_atp(glucose_moles: float) -&gt; float:
    theoretical_max_per_mole = 32.0
    return round(glucose_moles * theoretical_max_per_mole, 2)</code></pre>
            </div>
          </div>
        </div>

        <div class="mt-2 flex items-center">
          <button class="min-h-[44px] min-w-[44px] -ml-2 px-2 py-1.5 rounded-lg text-xs text-thread-muted hover:text-thread-text hover:bg-thread-soft flex items-center gap-1.5 transition-colors" aria-label="Copy reply" title="Copy reply">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            <span class="font-medium">Copy</span>
          </button>
        </div>
      </div>
    </div>
  </main>

  <footer class="shrink-0 p-3 border-t border-thread-border bg-thread-bg">
    <div class="max-w-[70ch] mx-auto bg-thread-surface border border-thread-border rounded-3xl shadow-sm p-2 flex items-end gap-2">
      <textarea rows="1" class="flex-1 min-h-[44px] max-h-[144px] py-2.5 px-3 bg-transparent text-sm text-thread-text placeholder:text-thread-muted resize-none focus:outline-none leading-relaxed" placeholder="Ask Thread AI..."></textarea>
      <button class="w-10 h-10 min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center shrink-0 bg-thread-accent text-white">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
      </button>
    </div>
  </footer>
</body>
</html>
`;

  const views = [
    { name: 'ai-chat-light-desktop.png', width: 1280, height: 900, dark: false },
    { name: 'ai-chat-dark-desktop.png', width: 1280, height: 900, dark: true },
    { name: 'ai-chat-light-mobile.png', width: 360, height: 800, dark: false },
    { name: 'ai-chat-dark-mobile.png', width: 360, height: 800, dark: true },
  ];

  for (const v of views) {
    const page = await browser.newPage({
      viewport: { width: v.width, height: v.height },
      colorScheme: v.dark ? 'dark' : 'light',
    });
    await page.setContent(getHtml(v.dark));
    const outPath = path.join(artifactDir, v.name);
    await page.screenshot({ path: outPath, fullPage: true });
    console.log('Saved screenshot:', outPath);
    await page.close();
  }

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
