import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function getChromiumExecutablePath(): string | undefined {
  if (process.platform === 'win32') {
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
    return undefined;
  }
  return '/usr/bin/chromium';
}

async function run() {
  const execPath = getChromiumExecutablePath();

  const launchOptions = {
    headless: true,
    executablePath: execPath,
    ignoreHTTPSErrors: true,
    protocolTimeout: 120000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-sync",
      "--disable-features=site-per-process",
      "--disable-features=VizDisplayCompositor",
      "--disable-ipc-flooding-protection",
      "--no-first-run",
      "--no-default-browser-check",
      "--single-process",
      "--no-zygote",
      "--font-render-hinting=none",
      "--remote-debugging-port=9222"
    ]
  };

  try {
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    await page.goto('about:blank');
    const content = await page.content();
    console.log(content);
    await browser.close();
  } catch (err: any) {
    console.error("=== PUPPETEER LAUNCH FAILURE DIAGNOSTICS ===");
    console.error("Full error:", err);
    console.error("Full stack trace:", err ? err.stack : 'No stack trace');
    
    // Puppeteer version
    const puppeteerPkgPath = path.resolve(process.cwd(), 'node_modules/puppeteer/package.json');
    let puppeteerVersion = 'unknown';
    if (fs.existsSync(puppeteerPkgPath)) {
      try {
        puppeteerVersion = JSON.parse(fs.readFileSync(puppeteerPkgPath, 'utf8')).version;
      } catch (e) {}
    }
    console.error("Puppeteer version:", puppeteerVersion);
    
    // Node version
    console.error("Node version:", process.version);
    
    // Browser executable path
    console.error("Browser executable path:", execPath);
    
    // Browser version
    let browserVersion = 'unknown';
    if (execPath) {
      try {
        browserVersion = execSync(`"${execPath}" --version`).toString().trim();
      } catch (e: any) {
        browserVersion = `error running command: ${e.message}`;
      }
    }
    console.error("Browser version:", browserVersion);
    
    // Complete launch options object
    console.error("Complete launch options object:", JSON.stringify(launchOptions, null, 2));
    
    process.exit(1);
  }
}

run();
