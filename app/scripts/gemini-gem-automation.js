import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSION_DIR = path.resolve(__dirname, '../../.gemini-session');
const LOG_PATH = path.resolve(__dirname, '../../gemini-automation.log');
const DEFAULT_SKILL_NAME = 'יוצר-משחקי-מילים-ויזואליים';

function logToFile(msg) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(LOG_PATH, `[${timestamp}] ${msg}\n`);
    console.log(msg);
}

function randBetween(minMs, maxMs) {
    return Math.floor(minMs + Math.random() * (maxMs - minMs + 1));
}

async function humanPause(page, minMs = 350, maxMs = 750) {
    await page.waitForTimeout(randBetween(minMs, maxMs));
}

async function typeHumanText(page, text) {
    const lines = String(text || '').trim().split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        if (i > 0) {
            await page.keyboard.press('Shift+Enter');
            await humanPause(page, 180, 360);
        }
        const line = lines[i];
        if (!line) continue;
        // Type in small natural segments with realistic pacing (keeps Hebrew input clean & natural)
        const words = line.split(/(\s+)/);
        for (const chunk of words) {
            if (!chunk) continue;
            await page.keyboard.type(chunk, { delay: randBetween(22, 42) });
            if (chunk.trim().length > 0) {
                await page.waitForTimeout(randBetween(25, 75));
            }
        }
    }
}

async function launchBrowserContext(isHeaded) {
    if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    let launchAttempts = 5;
    while (launchAttempts > 0) {
        try {
            return await chromium.launchPersistentContext(SESSION_DIR, {
                headless: !isHeaded,
                channel: 'chrome',
                acceptDownloads: true,
                viewport: { width: 1366, height: 860 },
                ignoreDefaultArgs: ['--enable-automation'],
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars',
                    '--window-position=40,40'
                ]
            });
        } catch (err) {
            launchAttempts--;
            const msg = err.message || '';
            logToFile(`[Gemini-Gem] Browser launch retry (${launchAttempts} left): ${msg}`);
            if (launchAttempts === 0) {
                if (msg.includes('exitCode=21') || msg.includes('Target page, context or browser has been closed')) {
                    const profileErr = new Error('BROWSER_PROFILE_IN_USE');
                    throw profileErr;
                }
                throw err;
            }
            await new Promise(r => setTimeout(r, 2500));
        }
    }
}

async function isComposerVisible(page, maxWaitMs = 0) {
    const selectors = [
        'rich-textarea div[contenteditable="true"]',
        'div.ql-editor[contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
        '[aria-label*="Enter a prompt"]',
        '[aria-label*="הזן הנחיה"]',
        '[aria-label*="Ask Gemini"]',
        '[aria-label*="שאל את Gemini"]',
        '[aria-label*="יש לך שאלה"]',
        '[aria-label*="סקילים"]'
    ];
    const deadline = Date.now() + maxWaitMs;
    while (true) {
        for (const sel of selectors) {
            const loc = page.locator(sel).first();
            if (await loc.isVisible().catch(() => false)) {
                return loc;
            }
        }
        if (Date.now() >= deadline) break;
        await page.waitForTimeout(500);
    }
    return null;
}

async function isActuallyLoggedOut(page) {
    const u = (page.url() || '').toLowerCase();
    if (u.includes('accounts.google.com') || u.includes('/signin') || u.includes('servicelogin')) {
        return true;
    }
    const signInBtn = page.locator('a[href*="accounts.google.com"], button:has-text("Sign in"), a:has-text("Sign in"), button:has-text("כניסה"), a:has-text("כניסה")').first();
    const hasSignIn = await signInBtn.isVisible().catch(() => false);
    const hasLoggedInMarkers = await page.locator('button[aria-label*="Google Account"], button[aria-label*="חשבון Google"], a[href*="/app"], span:has-text("שיחה חדשה"), span:has-text("New chat")').first().isVisible().catch(() => false);
    return hasSignIn && !hasLoggedInMarkers;
}

async function ensureHighReasoningMode(page) {
    try {
        const modelBtnSelector = 'button[data-test-id="bard-mode-menu-button"]';
        const modelBtn = page.locator(modelBtnSelector).first();

        try {
            await modelBtn.waitFor({ state: 'visible', timeout: 12000 });
        } catch {
            logToFile('[Gemini-Gem] Warning: bard-mode-menu-button did not appear within 12s.');
            return;
        }

        const btnTextBefore = (await modelBtn.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
        logToFile(`[Gemini-Gem] Current mode button text: "${btnTextBefore}"`);

        const isFastOrLite = btnTextBefore.includes('Flash-Lite') || btnTextBefore.includes('3.5') || btnTextBefore.includes('מהיר') || btnTextBefore.includes('Fast');
        if (!isFastOrLite && (btnTextBefore.includes('גבוהה') || btnTextBefore.includes('High'))) {
            logToFile(`[Gemini-Gem] Mode already high depth: "${btnTextBefore}"`);
            return;
        }

        const anyMenuItem = page.locator('.cdk-overlay-pane [role="menuitemradio"], .cdk-overlay-pane [role="menuitem"]').first();
        await modelBtn.click();
        await humanPause(page, 600, 950);
        if (!(await anyMenuItem.isVisible().catch(() => false))) {
            await modelBtn.click();
            await anyMenuItem.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
        }

        // 1. Hover "רמת ההעמקה" / "Reasoning" submenu naturally to reveal depth options visibly
        const depthTrigger = page.locator('.cdk-overlay-pane [role="menuitem"]').filter({ hasText: /רמת ההעמקה|Reasoning|Depth/i }).first();
        if (await depthTrigger.isVisible().catch(() => false)) {
            await depthTrigger.hover();
            await humanPause(page, 550, 900);
        }

        const highItem = page.locator('.cdk-overlay-pane [role="menuitemradio"]').filter({ hasText: /גבוהה|High/i }).first();
        if (await highItem.isVisible().catch(() => false)) {
            const alreadyChecked = (await highItem.getAttribute('aria-checked').catch(() => '')) === 'true';
            if (alreadyChecked) {
                logToFile('[Gemini-Gem] Reasoning depth (רמת ההעמקה) already set to: גבוהה');
            } else {
                logToFile('[Gemini-Gem] Clicking visible reasoning depth option: גבוהה');
                await highItem.click();
                await humanPause(page, 650, 1000);
            }
        } else {
            // Safe fallback if submenu collapsed before click
            const depthAction = await page.evaluate(() => {
                const radios = Array.from(document.querySelectorAll('.cdk-overlay-pane [role="menuitemradio"]'));
                const target = radios.find(el => {
                    const t = (el.innerText || '');
                    return t.includes('גבוהה') || t.includes('High');
                });
                if (!target) {
                    return { status: 'NOT_FOUND', items: radios.map(r => (r.innerText || '').replace(/\s+/g, ' ').trim()) };
                }
                if (target.getAttribute('aria-checked') === 'true') {
                    return { status: 'ALREADY_HIGH' };
                }
                const btn = target.querySelector('button') || target;
                btn.click();
                return { status: 'CLICKED_HIGH' };
            });
            if (depthAction.status === 'CLICKED_HIGH') {
                logToFile('[Gemini-Gem] Setting reasoning depth (רמת ההעמקה) to: גבוהה (fallback)');
                await humanPause(page, 650, 1000);
            } else if (depthAction.status === 'ALREADY_HIGH') {
                logToFile('[Gemini-Gem] Reasoning depth already set to: גבוהה');
            } else {
                logToFile(`[Gemini-Gem] Warning: "גבוהה" depth option not in menu overlay. Items seen: ${JSON.stringify(depthAction.items)}`);
            }
        }

        // 2. Ensure menu overlay is closed before typing into composer
        if (await anyMenuItem.isVisible().catch(() => false)) {
            await page.keyboard.press('Escape');
            await humanPause(page, 350, 600);
        }

        const btnTextAfter = (await modelBtn.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
        logToFile(`[Gemini-Gem] Final mode button text: "${btnTextAfter}"`);
    } catch (e) {
        logToFile(`[Gemini-Gem] Model/depth switch note (non-fatal): ${e.message}`);
        await page.keyboard.press('Escape').catch(() => {});
    }
}

async function ensureImageToolActive(page) {
    try {
        const deselectBtn = page.locator('button[aria-label*="ביטול הבחירה"], button[aria-label*="Deselect"]').first();
        if (await deselectBtn.isVisible().catch(() => false)) {
            logToFile('[Gemini-Gem] Image creation tool already active.');
            return;
        }

        const plusBtn = page.locator(
            'button[aria-label="העלאה וכלים"], button[aria-label*="העלאה וכלים"], button[aria-label*="Upload and tools"], button[aria-label*="Add files or tools"]'
        ).first();

        try {
            await plusBtn.waitFor({ state: 'visible', timeout: 8000 });
        } catch {
            logToFile('[Gemini-Gem] Warning: upload/tools (+) button not visible within 8s.');
            return;
        }

        await plusBtn.click();
        await humanPause(page, 600, 950);

        const imgTool = page.locator(
            '.cdk-overlay-pane [role="menuitem"], .cdk-overlay-pane [role="menuitemcheckbox"], .cdk-overlay-pane [role="option"], .cdk-overlay-pane button'
        ).filter({ hasText: /יצירת תמונה|Create image|Generate image/i }).first();

        if (await imgTool.isVisible().catch(() => false)) {
            await imgTool.click();
            logToFile('[Gemini-Gem] Activated image tool visibly: יצירת תמונה');
            await humanPause(page, 650, 950);
        } else {
            logToFile('[Gemini-Gem] Notice: "יצירת תמונה" option not visible in + menu (likely in Skill mode).');
            await page.keyboard.press('Escape').catch(() => {});
            await humanPause(page, 300, 500);
        }
    } catch (e) {
        logToFile(`[Gemini-Gem] Image tool activation note (non-fatal): ${e.message}`);
        await page.keyboard.press('Escape').catch(() => {});
    }
}

async function ensureImageToolInactive(page) {
    try {
        const deselectBtn = page.locator('button[aria-label*="ביטול הבחירה"], button[aria-label*="Deselect"]').first();
        if (await deselectBtn.isVisible().catch(() => false)) {
            await deselectBtn.click();
            logToFile('[Gemini-Gem] Deselected standalone image tool chip so @Skill mentions are available.');
            await humanPause(page, 450, 750);
        }
    } catch (e) {
        logToFile(`[Gemini-Gem] Image tool deselect note (non-fatal): ${e.message}`);
    }
}

async function attachSkillMention(page, composer, skillName) {
    const targetName = (skillName || DEFAULT_SKILL_NAME).trim();
    logToFile(`[Gemini-Gem] Attaching Gemini Skill via @ menu: "${targetName}"`);

    await composer.click();
    await humanPause(page, 300, 550);

    // Clear any stale draft left in localStorage on a fresh chat
    const existingText = (await composer.innerText().catch(() => '')).trim();
    if (existingText.length > 0) {
        logToFile(`[Gemini-Gem] Clearing stale composer draft (${existingText.length} chars)...`);
        await composer.fill('');
        await humanPause(page, 350, 600);
        await composer.click();
        await humanPause(page, 250, 450);
    }

    // Type '@' naturally to open the Skills & Connectors menu
    await page.keyboard.type('@', { delay: randBetween(60, 110) });
    await humanPause(page, 700, 1200);

    const skillLocator = page.locator('.at-mentions-v2-item, [role="menu"] [role="menuitem"]').filter({ hasText: targetName }).first();
    let visible = await skillLocator.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);

    // If not immediately visible in the initial list, type a short prefix to filter the @ menu
    if (!visible && targetName.length >= 3) {
        const prefix = targetName.split(/[-\s]/)[0].slice(0, 6);
        logToFile(`[Gemini-Gem] Filtering @ menu with prefix: "${prefix}"`);
        await page.keyboard.type(prefix, { delay: randBetween(40, 80) });
        await humanPause(page, 600, 1000);
        visible = await skillLocator.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false);
    }

    // Fallback: match by first Skill under "סקילים" group if user renamed it slightly
    let finalOption = visible ? skillLocator : null;
    if (!finalOption) {
        const partialWord = targetName.split(/[-\s]/).find(w => w.length >= 3) || '';
        if (partialWord) {
            const partialLoc = page.locator('.at-mentions-v2-item, [role="menu"] [role="menuitem"]').filter({ hasText: partialWord }).first();
            if (await partialLoc.isVisible().catch(() => false)) {
                finalOption = partialLoc;
            }
        }
    }

    if (!finalOption) {
        const seenItems = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.at-mentions-v2-item, [role="menu"] [role="menuitem"]'))
                .map(el => (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 80))
                .filter(Boolean)
                .slice(0, 10)
        ).catch(() => []);
        logToFile(`[Gemini-Gem] Skill "${targetName}" not found in @ menu. Items seen: ${JSON.stringify(seenItems)}`);
        await composer.fill('').catch(() => {});
        return { ok: false, error: 'SKILL_NOT_FOUND', seenItems };
    }

    await finalOption.click();
    await humanPause(page, 600, 950);

    const chipCount = await composer.locator('[data-at-mention-chip="true"], .inline-chip').count().catch(() => 0);
    if (chipCount === 0) {
        logToFile('[Gemini-Gem] Warning: clicked skill option but no inline chip detected in composer.');
        return { ok: false, error: 'SKILL_CHIP_NOT_ATTACHED' };
    }

    logToFile(`[Gemini-Gem] Skill chip attached cleanly inside composer (chips=${chipCount}).`);
    return { ok: true };
}

async function isCdpAvailable(port = 9222) {
    try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) });
        return res.ok;
    } catch {
        return false;
    }
}

function isRateLimitedUrl(u) {
    const s = (u || '').toLowerCase();
    return s.includes('google.com/sorry') || s.includes('/sorry/index');
}

function normalizeStartUrl(rawUrl) {
    const u = (rawUrl || '').trim();
    if (!u) return 'https://gemini.google.com/app';
    // Deprecated Gem root URL (/gem/<gemId> with no chatId) or /gems/view or /customize/skills -> always open /app
    if (
        u.includes('/customize/skills') ||
        u.includes('/gems/view') ||
        /^https?:\/\/gemini\.google\.com\/gem\/[^/?#]+\/?(?:\?.*)?$/i.test(u)
    ) {
        return 'https://gemini.google.com/app';
    }
    return u;
}

function taskHasHistory(page) {
    return Boolean(page.url && page.url().match(/\/(?:app|gem\/[^/]+)\/[0-9a-f]{8,}/i));
}

async function submitPromptAndWaitForImage(
    page,
    composerFallback,
    promptText,
    { skillName = '', useImageTool = false, clearDraft = false, maxWaitMs = 135000 } = {}
) {
    await ensureHighReasoningMode(page);

    if (skillName) {
        // Gemini disables @Skills when standalone image tool chip is locked on
        await ensureImageToolInactive(page);
    } else if (useImageTool) {
        await ensureImageToolActive(page);
    } else {
        await ensureImageToolInactive(page);
        logToFile('[Gemini-Gem] Running in native chat mode (without locking image tool chip).');
    }

    if (taskHasHistory(page)) {
        const settleDeadline = Date.now() + 5000;
        while (Date.now() < settleDeadline) {
            const settled = await page.evaluate(() => {
                const imgs = Array.from(document.querySelectorAll('model-response img'));
                return imgs.length === 0 || imgs.every(img => img.complete);
            }).catch(() => true);
            if (settled) break;
            await page.waitForTimeout(500);
        }
    }

    const { beforeSrcs, beforeResponseCount } = await page.evaluate(() => {
        return {
            beforeSrcs: Array.from(document.querySelectorAll('img'))
                .filter(img => img.naturalWidth >= 256 || img.width >= 256)
                .map(img => img.src),
            beforeResponseCount: document.querySelectorAll('model-response').length
        };
    });
    const beforeSet = new Set(beforeSrcs);
    logToFile(`[Gemini-Gem] Existing large images before prompt: ${beforeSet.size} (responses: ${beforeResponseCount})`);

    const activeComposer = (await isComposerVisible(page, 5000)) || composerFallback;

    if (skillName) {
        const skillRes = await attachSkillMention(page, activeComposer, skillName);
        if (!skillRes.ok) {
            return { newImgInfo: null, finishedWithoutImage: false, lastText: '', fatalError: skillRes.error };
        }
    } else {
        await activeComposer.click();
        await humanPause(page, 300, 550);
        if (clearDraft) {
            const existingText = (await activeComposer.innerText().catch(() => '')).trim();
            if (existingText.length > 0) {
                await activeComposer.fill('');
                await humanPause(page, 300, 500);
                await activeComposer.click();
                await humanPause(page, 250, 450);
            }
        }
    }

    // Type the prompt naturally line-by-line (Shift+Enter between lines so multi-line prompts don't submit early)
    await typeHumanText(page, promptText.trim());
    await humanPause(page, 550, 950);

    // Click the visible Send button naturally (fallback to Enter if not visible)
    const sendBtn = page.locator('button[aria-label*="שליחת הודעה"], button[aria-label*="Send message"]').first();
    if (await sendBtn.isVisible().catch(() => false) && !(await sendBtn.isDisabled().catch(() => true))) {
        await sendBtn.click();
    } else {
        await page.keyboard.press('Enter');
    }
    logToFile(`[Gemini-Gem] Prompt submitted${skillName ? ` (with @${skillName})` : ''}: "${promptText.trim()}"`);

    let newImgInfo = null;
    let textDoneTicks = 0;
    let lastText = '';
    let finishedWithoutImage = false;
    const genDeadline = Date.now() + maxWaitMs;

    while (Date.now() < genDeadline) {
        await page.waitForTimeout(2500);
        const pollState = await page.evaluate(({ existingArr, minRespIdx }) => {
            const existing = new Set(existingArr);
            const responses = Array.from(document.querySelectorAll('model-response'));
            const imgs = Array.from(document.querySelectorAll('img'));
            const found = [];
            for (let idx = 0; idx < imgs.length; idx++) {
                const img = imgs[idx];
                const src = img.src || '';
                if (!src || existing.has(src)) continue;
                if (img.complete && img.naturalWidth >= 400 && img.naturalHeight >= 400) {
                    if (minRespIdx > 0) {
                        const parentResp = img.closest('model-response');
                        if (parentResp) {
                            const respIdx = responses.indexOf(parentResp);
                            if (respIdx !== -1 && respIdx < minRespIdx) continue;
                        } else if (responses.length <= minRespIdx) {
                            continue;
                        }
                    }
                    found.push({
                        idx,
                        src,
                        width: img.naturalWidth,
                        height: img.naturalHeight
                    });
                }
            }

            let respFinishedTextOnly = false;
            let latestText = '';
            if (found.length === 0 && responses.length > minRespIdx) {
                const latestResp = responses[responses.length - 1];
                latestText = (latestResp.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300);
                const stopBtn = document.querySelector(
                    'button[aria-label*="Stop"], button[aria-label*="עצירה"], button[aria-label*="הפסק"], mat-icon[fonticon="stop"]'
                );
                const hasStopVisible = Boolean(stopBtn && stopBtn.getBoundingClientRect().width > 0);
                const hasPendingMedia = Boolean(
                    latestResp.querySelector('mat-progress-spinner, [aria-busy="true"], generated-image:not(:has(img[src]))')
                    || Array.from(latestResp.querySelectorAll('img')).some(i => !i.complete || !i.src)
                );
                const hasFeedbackBtns = Boolean(latestResp.querySelector(
                    'button[aria-label*="תשובה טובה"], button[aria-label*="Good response"], button[aria-label*="ביצוע מחדש"], button[aria-label*="Redo"]'
                ));
                if (!hasStopVisible && !hasPendingMedia && hasFeedbackBtns && latestText.length > 0) {
                    respFinishedTextOnly = true;
                }
            }
            return { found, respFinishedTextOnly, latestText };
        }, { existingArr: Array.from(beforeSet), minRespIdx: beforeResponseCount });

        if (pollState.latestText) {
            lastText = pollState.latestText;
        }

        if (pollState.found.length > 0) {
            newImgInfo = pollState.found[pollState.found.length - 1];
            logToFile(`[Gemini-Gem] New generated image detected (${newImgInfo.width}x${newImgInfo.height})!`);
            await humanPause(page, 1800, 2500);
            break;
        }

        if (pollState.respFinishedTextOnly) {
            textDoneTicks++;
            if (textDoneTicks >= 3) {
                finishedWithoutImage = true;
                logToFile(`[Gemini-Gem] Response completed with text only (no image): "${lastText}"`);
                break;
            }
        } else {
            textDoneTicks = 0;
        }
    }

    if (!newImgInfo && !lastText) {
        lastText = await page.evaluate(() => {
            const els = document.querySelectorAll('model-response, .model-response-text, message-content');
            const last = els.length ? els[els.length - 1] : null;
            return last ? (last.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300) : '';
        }).catch(() => '');
    }

    return { newImgInfo, finishedWithoutImage, lastText, fatalError: null };
}

async function runAutomation() {
    const args = process.argv.slice(2);
    const isLoginOnly = args.includes('--login');
    const isCheckOnly = args.includes('--check');
    const taskFile = args.find(a => a.startsWith('--task='))?.split('=')[1];

    let task = {
        gemUrl: 'https://gemini.google.com/app',
        skillName: DEFAULT_SKILL_NAME,
        chatUrl: '',
        prompt: '',
        outputDir: path.resolve(__dirname, '../../תמונות חדשות'),
        headed: false
    };

    if (taskFile && fs.existsSync(taskFile)) {
        try {
            const rawJson = fs.readFileSync(taskFile, 'utf8').replace(/^\uFEFF/, '');
            const loaded = JSON.parse(rawJson);
            task = { ...task, ...loaded };
        } catch (e) {
            logToFile(`[Gemini-Gem] Error reading task file: ${e.message}`);
        }
    }

    const isHeaded = isLoginOnly || args.includes('--headed') || Boolean(task.headed);
    const activeSkillName = (task.skillName || DEFAULT_SKILL_NAME).trim();

    // ── Mode 1: Interactive Login on User's Visible Desktop ──
    if (isLoginOnly) {
        if (!fs.existsSync(SESSION_DIR)) {
            fs.mkdirSync(SESSION_DIR, { recursive: true });
        }
        const startUrl = 'https://gemini.google.com/app';
        const chromePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
        ];
        const chromePath = chromePaths.find(p => p && fs.existsSync(p)) || '';
        const debugPort = 9222;

        if (!(await isCdpAvailable(debugPort))) {
            logToFile(`[Gemini-Gem] Launching interactive Chrome on user desktop for login: ${startUrl}`);
            if (process.platform === 'win32' && chromePath) {
                const child = spawn(chromePath, [
                    `--user-data-dir=${SESSION_DIR}`,
                    `--remote-debugging-port=${debugPort}`,
                    '--no-first-run',
                    '--no-default-browser-check',
                    '--start-maximized',
                    startUrl
                ], { detached: true, stdio: 'ignore' });
                child.unref();

                setTimeout(() => {
                    try {
                        const psCmd = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow); }'; Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | ForEach-Object { [Win32]::ShowWindow($_.MainWindowHandle, 3); [Win32]::SetForegroundWindow($_.MainWindowHandle) }`;
                        execSync(`powershell -NoProfile -Command "${psCmd}"`, { stdio: 'ignore', windowsHide: true });
                    } catch (_) {}
                }, 2500);
            }
        } else {
            logToFile('[Gemini-Gem] Reusing already-open interactive Chrome on port 9222.');
        }

        let browser = null;
        for (let attempt = 0; attempt < 15; attempt++) {
            await new Promise(r => setTimeout(r, 1200));
            try {
                browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
                break;
            } catch (_) {}
        }

        if (!browser) {
            logToFile('[Gemini-Gem] Could not attach CDP to interactive Chrome window.');
            console.log(`RESULT_JSON:${JSON.stringify({ ok: false, loggedIn: false, error: 'CDP_CONNECT_FAILED' })}`);
            return;
        }

        let loggedIn = false;
        let disconnected = false;
        browser.on('disconnected', () => { disconnected = true; });

        try {
            const deadline = Date.now() + 240000;
            while (Date.now() < deadline && !disconnected) {
                try {
                    const contexts = browser.contexts();
                    const pages = contexts.flatMap(c => c.pages());
                    if (!pages || pages.length === 0) break;

                    const activePage = pages[pages.length - 1];
                    const composer = await isComposerVisible(activePage);
                    if (composer && !(await isActuallyLoggedOut(activePage))) {
                        loggedIn = true;
                        await new Promise(r => setTimeout(r, 2000));
                        break;
                    }
                    await new Promise(r => setTimeout(r, 1500));
                } catch (loopErr) {
                    logToFile(`[Gemini-Gem] Interactive login loop ended: ${loopErr.message}`);
                    break;
                }
            }
        } finally {
            await browser.close().catch(() => {});
        }

        const result = { ok: loggedIn, loggedIn, gemUrl: 'https://gemini.google.com/app', skillName: activeSkillName };
        console.log(`RESULT_JSON:${JSON.stringify(result)}`);
        return;
    }

    let cdpBrowser = null;
    let browserContext = null;
    let page = null;
    let usedCdp = false;

    if (await isCdpAvailable(9222)) {
        try {
            logToFile('[Gemini-Gem] Attaching to active Chrome session on CDP port 9222...');
            cdpBrowser = await chromium.connectOverCDP('http://127.0.0.1:9222');
            browserContext = cdpBrowser.contexts()[0];
            page = await browserContext.newPage();
            usedCdp = true;
        } catch (cdpErr) {
            logToFile(`[Gemini-Gem] CDP attach fallback to persistent launch: ${cdpErr.message}`);
            cdpBrowser = null;
        }
    }

    if (!usedCdp) {
        browserContext = await launchBrowserContext(isHeaded);
        page = browserContext.pages()[0] || await browserContext.newPage();
    }

    try {
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        let startUrl = task.chatUrl ? task.chatUrl.trim() : normalizeStartUrl(task.gemUrl);
        let isFollowUpChat = Boolean(task.chatUrl && task.chatUrl.trim());

        logToFile(`[Gemini-Gem] Navigating to: ${startUrl}`);
        await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await humanPause(page, 2500, 3800);
        logToFile(`[Gemini-Gem] Landed URL: ${page.url()}`);

        // Handle Google's Gems -> Skills redirect cleanly (both for old /gem/<id> and old /gem/<id>/<chatId>)
        if (page.url().includes('/customize/skills') || page.url().includes('/gems/view')) {
            const oldChatMatch = startUrl.match(/\/gem\/[^/]+\/([0-9a-f]{8,})/i);
            const fallbackUrl = oldChatMatch
                ? `https://gemini.google.com/app/${oldChatMatch[1]}`
                : 'https://gemini.google.com/app';
            logToFile(`[Gemini-Gem] Redirected to Skills page (${page.url()}); navigating to ${fallbackUrl}...`);
            if (!oldChatMatch) isFollowUpChat = false;
            await page.goto(fallbackUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await humanPause(page, 2500, 3800);
            logToFile(`[Gemini-Gem] Landed URL after redirect recovery: ${page.url()}`);
        }

        if (isRateLimitedUrl(page.url())) {
            const errShot = path.resolve(__dirname, '../../gemini-error.png');
            await page.screenshot({ path: errShot }).catch(() => {});
            logToFile(`[Gemini-Gem] Rate limit / anti-bot check detected at ${page.url()}`);
            console.log(`RESULT_JSON:${JSON.stringify({ ok: false, error: 'RATE_LIMITED_OR_CAPTCHA', url: page.url(), screenshot: errShot })}`);
            process.exitCode = 1;
            return;
        }

        // ── Mode 2: Check Session Status ──
        const composer = await isComposerVisible(page, isCheckOnly ? 15000 : 25000);
        if (isCheckOnly) {
            const loggedOut = await isActuallyLoggedOut(page);
            const connected = Boolean(composer) && !loggedOut && !isRateLimitedUrl(page.url());
            console.log(`RESULT_JSON:${JSON.stringify({ connected, url: page.url(), skillName: activeSkillName })}`);
            return;
        }

        if (isRateLimitedUrl(page.url())) {
            const errShot = path.resolve(__dirname, '../../gemini-error.png');
            await page.screenshot({ path: errShot }).catch(() => {});
            logToFile(`[Gemini-Gem] Rate limit / anti-bot check detected at ${page.url()}`);
            console.log(`RESULT_JSON:${JSON.stringify({ ok: false, error: 'RATE_LIMITED_OR_CAPTCHA', url: page.url(), screenshot: errShot })}`);
            process.exitCode = 1;
            return;
        }

        if (!composer) {
            const errShot = path.resolve(__dirname, '../../gemini-error.png');
            await page.screenshot({ path: errShot }).catch(() => {});
            const loggedOut = await isActuallyLoggedOut(page);
            const errCode = loggedOut ? 'NOT_LOGGED_IN' : 'COMPOSER_NOT_FOUND';
            logToFile(`[Gemini-Gem] Composer not found at ${page.url()} -> ${errCode}.`);
            console.log(`RESULT_JSON:${JSON.stringify({ ok: false, error: errCode, url: page.url(), screenshot: errShot })}`);
            process.exitCode = 1;
            return;
        }

        // ── Mode 3: Generate / Refine Image via Gemini Skill ──
        if (!task.prompt || !task.prompt.trim()) {
            console.log(`RESULT_JSON:${JSON.stringify({ ok: false, error: 'Missing prompt' })}`);
            process.exitCode = 1;
            return;
        }

        if (isFollowUpChat) {
            const settleDeadline = Date.now() + 6000;
            while (Date.now() < settleDeadline) {
                const settled = await page.evaluate(() => {
                    const hasResp = document.querySelectorAll('model-response').length > 0;
                    const imgs = Array.from(document.querySelectorAll('model-response img'));
                    const allComplete = imgs.length === 0 || imgs.every(img => img.complete);
                    return hasResp && allComplete;
                }).catch(() => false);
                if (settled) break;
                await page.waitForTimeout(500);
            }
            await humanPause(page, 900, 1400);
        } else {
            // Give Angular/Skills sidebar a natural moment to finish hydrating before opening @ menu
            await humanPause(page, 1800, 2600);
        }

        // For new chats: attach @Skill (native image generation via Skill instructions).
        // For follow-up edits in an existing chat: Skill context & prior image are already in the thread.
        let attemptRes = await submitPromptAndWaitForImage(page, composer, task.prompt, {
            skillName: isFollowUpChat ? '' : activeSkillName,
            useImageTool: false,
            clearDraft: !isFollowUpChat,
            maxWaitMs: 135000
        });

        if (attemptRes.fatalError) {
            const errShot = path.resolve(__dirname, '../../gemini-error.png');
            await page.screenshot({ path: errShot }).catch(() => {});
            console.log(`RESULT_JSON:${JSON.stringify({ ok: false, error: attemptRes.fatalError, skillName: activeSkillName, url: page.url(), screenshot: errShot })}`);
            process.exitCode = 1;
            return;
        }

        // If Gemini responded with text only (no image), gently follow up ONCE in the SAME chat asking it to produce the image
        if (!attemptRes.newImgInfo && attemptRes.finishedWithoutImage) {
            logToFile(`[Gemini-Gem] Gemini responded with text only ("${attemptRes.lastText?.slice(0, 100)}"). Following up once in same chat to generate the image...`);
            await humanPause(page, 1500, 2500);
            const inChatComposer = await isComposerVisible(page, 15000);
            if (inChatComposer) {
                const demandPrompt = "השבת בטקסט בלבד ללא תמונה. נא ליצור ולהפיק כעת את התמונה בפועל לפי התכנון הזה.";
                attemptRes = await submitPromptAndWaitForImage(page, inChatComposer, demandPrompt, {
                    skillName: '',
                    useImageTool: true,
                    clearDraft: false,
                    maxWaitMs: 120000
                });
            }
        }

        const newImgInfo = attemptRes.newImgInfo;
        if (!newImgInfo) {
            const errShot = path.resolve(__dirname, '../../gemini-error.png');
            await page.screenshot({ path: errShot });
            const lastText = attemptRes.lastText || '';
            const errCode = attemptRes.finishedWithoutImage ? 'NO_IMAGE_RETURNED' : 'TIMEOUT_WAITING_FOR_IMAGE';
            const currentChatUrl = page.url() || '';
            logToFile(`[Gemini-Gem] Failed (${errCode}) at ${currentChatUrl}. Last response: "${lastText}"`);
            console.log(`RESULT_JSON:${JSON.stringify({ ok: false, error: errCode, message: lastText, chatUrl: currentChatUrl, screenshot: errShot })}`);
            process.exitCode = 1;
            return;
        }

        fs.mkdirSync(task.outputDir, { recursive: true });
        const outFilename = `gem_${Date.now()}.png`;
        const outPath = path.join(task.outputDir, outFilename);
        let saved = false;

        // Strategy A: Hover the generated image and click Gemini's native "Download full size" button
        try {
            const targetImg = page.locator('img').nth(newImgInfo.idx);
            await targetImg.scrollIntoViewIfNeeded();
            await targetImg.hover();
            await humanPause(page, 800, 1300);

            const scopedContainer = targetImg.locator('xpath=ancestor::*[self::generated-image or self::single-image or self::model-response][1]');
            let downloadBtn = scopedContainer.locator(
                'button[aria-label*="Download full size"], button[aria-label*="Download"], button[aria-label*="הורדת תמונה"], button[aria-label*="הורד"], button[data-test-id*="download"]'
            ).last();

            if (!(await downloadBtn.waitFor({ state: 'visible', timeout: 2500 }).then(() => true).catch(() => false))) {
                downloadBtn = page.locator(
                    'button[aria-label*="Download full size"], button[aria-label*="Download"], button[aria-label*="הורדת תמונה"], button[aria-label*="הורד"], button[data-test-id*="download"]'
                ).last();
            }

            if (await downloadBtn.waitFor({ state: 'visible', timeout: 2500 }).then(() => true).catch(() => false)) {
                const [download] = await Promise.all([
                    page.waitForEvent('download', { timeout: 15000 }),
                    downloadBtn.click()
                ]);
                await download.saveAs(outPath);
                if (fs.existsSync(outPath) && fs.statSync(outPath).size > 10000) {
                    saved = true;
                    logToFile(`[Gemini-Gem] Downloaded full-size image via native button: ${outPath}`);
                }
            }
        } catch (dlErr) {
            logToFile(`[Gemini-Gem] Native download button fallback: ${dlErr.message}`);
        }

        // Strategy B: Draw rendered DOM <img> onto offscreen <canvas> or fallback to browser fetch
        if (!saved) {
            try {
                const b64 = await page.evaluate(async ({ imgIdx, imgSrc }) => {
                    const img = document.querySelectorAll('img')[imgIdx];
                    if (img && img.complete && img.naturalWidth > 0) {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.naturalWidth;
                            canvas.height = img.naturalHeight;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            const dataUrl = canvas.toDataURL('image/png');
                            if (dataUrl && dataUrl.includes(',')) {
                                return dataUrl.split(',')[1];
                            }
                        } catch (_) {}
                    }
                    const resp = await fetch(imgSrc);
                    const blob = await resp.blob();
                    return await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result.split(',')[1]);
                        reader.onerror = reject;
                        reader.readAsDataURL(blob);
                    });
                }, { imgIdx: newImgInfo.idx, imgSrc: newImgInfo.src });

                if (b64) {
                    fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
                    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 5000) {
                        saved = true;
                        logToFile(`[Gemini-Gem] Extracted image bytes via browser canvas/fetch: ${outPath}`);
                    }
                }
            } catch (fetchErr) {
                logToFile(`[Gemini-Gem] Browser canvas/fetch fallback: ${fetchErr.message}`);
            }
        }

        // Strategy C: Direct element screenshot of the generated image
        if (!saved) {
            const targetImg = page.locator('img').nth(newImgInfo.idx);
            await targetImg.screenshot({ path: outPath });
            saved = fs.existsSync(outPath);
            logToFile(`[Gemini-Gem] Saved image via element screenshot: ${outPath}`);
        }

        const currentChatUrl = page.url();
        const resultObj = {
            ok: saved,
            filePath: outPath,
            filename: outFilename,
            chatUrl: currentChatUrl,
            skillName: activeSkillName,
            width: newImgInfo.width,
            height: newImgInfo.height
        };
        console.log(`RESULT_JSON:${JSON.stringify(resultObj)}`);
    } finally {
        if (usedCdp) {
            if (page) await page.close().catch(() => {});
            if (cdpBrowser) await cdpBrowser.close().catch(() => {});
        } else if (browserContext) {
            await browserContext.close().catch(() => {});
        }
    }
}

runAutomation().catch(err => {
    logToFile(`[Gemini-Gem] Fatal error: ${err.message}`);
    console.log(`RESULT_JSON:${JSON.stringify({ ok: false, error: err.message })}`);
    process.exit(1);
});
