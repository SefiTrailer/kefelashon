import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Session directory (local to app)
const SESSION_DIR = path.resolve(__dirname, '../../.x-session');

function logToFile(msg) {
    const logPath = path.resolve(__dirname, '../../x-automation.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
    console.log(msg);
}

async function runAutomation() {
    const args = process.argv.slice(2);
    const isLoginOnly = args.includes('--login');
    const isCheckOnly = args.includes('--check');
    const taskFile = args.find(arg => arg.startsWith('--task='))?.split('=')[1];
    
    let imagePath = args.find(arg => arg.startsWith('--image='))?.split('=')[1];
    let caption = args.find(arg => arg.startsWith('--caption='))?.split('=')[1] || '';
    
    // Load from task file if provided (more stable for complex characters)
    if (taskFile && fs.existsSync(taskFile)) {
        try {
            const task = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
            if (task.imagePath) imagePath = task.imagePath;
            if (task.caption) caption = task.caption;
            logToFile(`[X-Automation] Loaded task from ${taskFile}`);
        } catch (e) {
            logToFile(`[X-Automation] Error reading task file: ${e.message}`);
        }
    }
    
    const isHeaded = args.includes('--headed') || (isLoginOnly && !isCheckOnly);

    logToFile(`[X-Automation] Starting... (Headed: ${isHeaded}, LoginOnly: ${isLoginOnly})`);

    // Ensure session dir exists
    if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    let browserContext;
    let launchAttempts = 8;
    
    while (launchAttempts > 0) {
        try {
            browserContext = await chromium.launchPersistentContext(SESSION_DIR, {
                headless: !isHeaded,
                channel: 'msedge', // Use system Edge
                viewport: { width: 1280, height: 720 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
                ignoreDefaultArgs: ['--enable-automation'],
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars',
                    '--window-position=0,0',
                ],
            });
            break; // Success
        } catch (err) {
            launchAttempts--;
            logToFile(`[X-Automation] Launch failed (Attempts left: ${launchAttempts}): ${err.message}`);
            if (launchAttempts === 0) throw err;
            await new Promise(r => setTimeout(r, 3000)); // Wait before retry
        }
    }

    let cleanupOptFile = null;

    try {
        const page = await browserContext.newPage();

        // Stealth: Hide automation flags
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        logToFile('[X-Automation] Navigating to X.com...');
        
        // Use domcontentloaded for better reliability on noisy sites like X
        await page.goto('https://x.com/home', { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        });

        // Check if we are logged in - increasing timeout for slower starts
        let isLoggedIn = false;
        try {
            // Give it a moment to settle
            await page.waitForTimeout(3000);
            
            // X.com usually shows the side nav or the composer when logged in
            await page.waitForSelector('[data-testid="SideNav_AccountMenu_Button"], [data-testid="tweetTextarea_0"], [data-testid="SideNav_NewTweet_Button"]', { timeout: 15000 });
            isLoggedIn = true;
        } catch (e) {
            logToFile('[X-Automation] Login check failed or timed out. Taking screenshot...');
            const screenshotPath = path.resolve(process.cwd(), 'x-login-check.png');
            await page.screenshot({ path: screenshotPath });
            logToFile(`[X-Automation] Screenshot saved to ${screenshotPath}`);
            isLoggedIn = false;
        }
        
        if (isCheckOnly) {
            console.log(`JSON:{"connected": ${isLoggedIn}}`);
            return;
        }

        if (!isLoggedIn) {
            logToFile('[X-Automation] Not logged in.');
            if (isLoginOnly) {
                logToFile('[X-Automation] Login mode: Please log in manually in the opened window.');
                
                // Real-time detection loop
                const detectionInterval = setInterval(async () => {
                    try {
                        if (page.isClosed()) {
                            clearInterval(detectionInterval);
                            return;
                        }
                        // Use the same robust selectors as the main check
                        const homeElement = await page.$('[data-testid="SideNav_AccountMenu_Button"], [data-testid="tweetTextarea_0"], [data-testid="SideNav_NewTweet_Button"]');
                        if (homeElement) {
                            logToFile('\n[X-Automation] SUCCESS: Login detected!');
                            logToFile('[X-Automation] You can now CLOSE the browser window.');
                            clearInterval(detectionInterval);
                        }
                    } catch (e) {
                        // Page might have closed or crashed
                        clearInterval(detectionInterval);
                    }
                }, 3000);

                await page.waitForEvent('close', { timeout: 0 });
                clearInterval(detectionInterval);
                return;
            } else {
                throw new Error('Not logged in. Please run with --login to authenticate.');
            }
        }

        // Verify login on start
        logToFile('[X-Automation] Checking login state...');
        const loginModal = page.locator('[data-testid="login_modal"], [data-testid="sheetDialog"]').first();
        const loginLink = page.locator('a[href="/login"]').first();
        
        if (await loginModal.isVisible() || await loginLink.isVisible()) {
            throw new Error('NOT_LOGGED_IN: Please click the manual X login button in the Admin Panel to restore your session.');
        }

        if (isCheckOnly) {
            logToFile('[X-Automation] Logged in check passed.');
            console.log('JSON:{"connected": true}');
            await page.waitForTimeout(2000);
            return;
        }

        if (isLoginOnly) {
            logToFile('[X-Automation] Already logged in. You can close the window or it will close automatically in 5s.');
            await page.waitForTimeout(5000);
            return;
        }

        if (!imagePath) throw new Error('No image path provided.');

        let absoluteImagePath = path.resolve(imagePath);
        if (!fs.existsSync(absoluteImagePath)) throw new Error(`Image not found at ${absoluteImagePath}`);

        // Optimize image for Twitter (X) if needed (max 1440px, progressive mozjpeg 84%)
        try {
            const ext = path.extname(absoluteImagePath).toLowerCase();
            const stat = fs.statSync(absoluteImagePath);
            if (stat.size > 400 * 1024 || ext === '.webp') {
                const optDir = path.join(__dirname, 'temp_opt');
                if (!fs.existsSync(optDir)) fs.mkdirSync(optDir, { recursive: true });
                const optFile = path.join(optDir, `x_opt_${Date.now()}_${path.basename(absoluteImagePath, ext)}.jpg`);
                await sharp(absoluteImagePath)
                    .resize({ width: 1440, height: 1440, fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 84, progressive: true, mozjpeg: true })
                    .toFile(optFile);
                if (fs.existsSync(optFile) && fs.statSync(optFile).size > 0) {
                    logToFile(`[X-Automation] Optimized image for Twitter: ${(stat.size / 1024).toFixed(0)}KB -> ${(fs.statSync(optFile).size / 1024).toFixed(0)}KB`);
                    absoluteImagePath = optFile;
                    cleanupOptFile = optFile;
                }
            }
        } catch (optErr) {
            logToFile(`[X-Automation] Image optimization notice: ${optErr.message}`);
        }

        logToFile('[X-Automation] Preparing to post...');

        // Helper: resolve the active composer container (prefer foreground compose modal over masked timeline composer)
        const composeDialogLocator = page.locator('[role="dialog"]').filter({
            has: page.locator('[data-testid="tweetTextarea_0"]')
        });

        let scope = page;
        let scopeType = 'inline';

        if (await composeDialogLocator.last().isVisible({ timeout: 1500 }).catch(() => false)) {
            scope = composeDialogLocator.last();
            scopeType = 'dialog-existing';
        } else {
            // If an unrelated blocking mask/modal is open (e.g., X prompt/upsell), dismiss it with Escape
            const mask = page.locator('[data-testid="mask"]').first();
            if (await mask.isVisible({ timeout: 500 }).catch(() => false)) {
                logToFile('[X-Automation] Blocking [data-testid="mask"] detected without compose textarea. Sending Escape...');
                await page.keyboard.press('Escape');
                await page.waitForTimeout(800);
            }

            // Re-check if compose dialog appeared or open one cleanly via SideNav_NewTweet_Button
            if (await composeDialogLocator.last().isVisible({ timeout: 500 }).catch(() => false)) {
                scope = composeDialogLocator.last();
                scopeType = 'dialog-existing';
            } else {
                const postButton = page.locator('[data-testid="SideNav_NewTweet_Button"]').first();
                if (await postButton.isVisible({ timeout: 2500 }).catch(() => false)) {
                    logToFile('[X-Automation] Opening compose modal via SideNav_NewTweet_Button...');
                    await postButton.click();
                    const dialogAppeared = await composeDialogLocator.last().waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
                    if (dialogAppeared) {
                        scope = composeDialogLocator.last();
                        scopeType = 'dialog-opened';
                    }
                }
            }
        }

        logToFile(`[X-Automation] Composer scope selected: ${scopeType}`);

        const composer = scope.locator('[data-testid="tweetTextarea_0"]').first();
        await composer.waitFor({ state: 'visible', timeout: 15000 });
        await composer.click();
        await composer.fill(caption);

        // Verify Draft.js editor actually received the caption text; fallback to keyboard typing if empty
        let actualText = (await composer.innerText().catch(() => '')).trim();
        if (caption.trim() && actualText.length === 0) {
            logToFile('[X-Automation] composer.fill resulted in empty Draft.js state; typing caption via keyboard...');
            await composer.click();
            await page.keyboard.insertText(caption);
            actualText = (await composer.innerText().catch(() => '')).trim();
        }
        if (caption.trim() && actualText.length === 0) {
            throw new Error('VALIDATION_FAILED: Composer text remained empty after fill/insertText');
        }

        logToFile('[X-Automation] Uploading image...');
        const fileInput = scope.locator('input[data-testid="fileInput"]').first();
        await fileInput.setInputFiles(absoluteImagePath);

        logToFile('[X-Automation] Waiting for image attachment to be ready...');
        await scope.locator('[data-testid="attachments"] [role="button"]').first().waitFor({ state: 'visible', timeout: 45000 });

        logToFile('[X-Automation] Waiting for Post button to be enabled...');
        const submitButton = scope.locator('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]').first();
        await submitButton.waitFor({ state: 'visible', timeout: 30000 });

        // Wait for Post button to become enabled once media finishes processing
        await page.waitForFunction((btn) => {
            return btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true';
        }, await submitButton.elementHandle(), { timeout: 30000 });

        const btnState = await submitButton.evaluate(btn => ({
            disabled: Boolean(btn.disabled),
            ariaDisabled: btn.getAttribute('aria-disabled'),
            text: (btn.innerText || '').trim(),
            testId: btn.getAttribute('data-testid')
        }));

        if (args.includes('--dry-run')) {
            await page.waitForTimeout(1000);
            const dryRunSummary = {
                ok: true,
                dryRun: true,
                validated: !btnState.disabled && btnState.ariaDisabled !== 'true',
                scopeType,
                buttonState: btnState,
                textLength: actualText.length
            };
            logToFile(`[X-Automation] DRY-RUN summary: ${JSON.stringify(dryRunSummary)}`);
            await page.screenshot({ path: path.join(__dirname, '../../x-dryrun.png') }).catch(() => {});
            console.log(`RESULT_JSON:${JSON.stringify(dryRunSummary)}`);
            return;
        }

        logToFile('[X-Automation] Clicking Post and awaiting CreateTweet API confirmation...');
        const createTweetPromise = page.waitForResponse(
            (resp) => resp.request().method() === 'POST' && resp.url().includes('/CreateTweet'),
            { timeout: 30000 }
        ).then(async (resp) => ({
            status: resp.status(),
            body: await resp.json().catch(() => null)
        })).catch((err) => ({ status: 0, error: err.message, body: null }));

        await submitButton.click();

        const createTweet = await createTweetPromise;
        // Also wait briefly for UI toast/modal close to settle
        await Promise.race([
            scope.locator('[data-testid="attachments"]').first().waitFor({ state: 'hidden', timeout: 10000 }),
            page.waitForSelector('[data-testid="toast"]', { timeout: 10000 }),
            composer.waitFor({ state: 'hidden', timeout: 10000 })
        ]).catch(() => {});

        const gqlErrors = Array.isArray(createTweet?.body?.errors) ? createTweet.body.errors : [];
        const rawResult = createTweet?.body?.data?.create_tweet?.tweet_results?.result || null;
        const tweetNode = rawResult?.tweet || rawResult;
        const tweetId = tweetNode?.rest_id ? String(tweetNode.rest_id) : null;
        const screenName =
            tweetNode?.core?.user_results?.result?.legacy?.screen_name ||
            tweetNode?.core?.user_results?.result?.core?.screen_name ||
            null;
        const tweetUrl = tweetId
            ? (screenName ? `https://x.com/${screenName}/status/${tweetId}` : `https://x.com/i/web/status/${tweetId}`)
            : null;

        if (!createTweet || createTweet.status < 200 || createTweet.status >= 300 || gqlErrors.length > 0 || !tweetId) {
            const errDetail = gqlErrors.map(e => e.message).filter(Boolean).join('; ') || createTweet?.error || `HTTP ${createTweet?.status || 0}, missing tweet rest_id`;
            const failPayload = {
                ok: false,
                validated: false,
                status: createTweet?.status || 0,
                errors: gqlErrors,
                error: errDetail
            };
            console.log(`RESULT_JSON:${JSON.stringify(failPayload)}`);
            throw new Error(`CREATE_TWEET_VALIDATION_FAILED: ${errDetail}`);
        }

        const successPayload = {
            ok: true,
            validated: true,
            tweetId,
            tweetUrl,
            scopeType
        };
        logToFile(`[X-Automation] Validated! Tweet ID=${tweetId} (${tweetUrl})`);
        console.log(`RESULT_JSON:${JSON.stringify(successPayload)}`);
        await page.waitForTimeout(1500);

    } catch (err) {
        logToFile(`[X-Automation] ERROR: ${err.message}`);
        if (!isCheckOnly && !isLoginOnly && !String(err.message).startsWith('CREATE_TWEET_VALIDATION_FAILED')) {
            console.log(`RESULT_JSON:${JSON.stringify({ ok: false, validated: false, error: err.message })}`);
        }
        if (isLoginOnly && browserContext) {
            logToFile('[X-Automation] Error during login setup, but keeping window open for manual fix...');
            // In login mode, if something fails (like navigation), still wait for user to close
            const pages = browserContext.pages();
            if (pages.length > 0) {
                await pages[pages.length - 1].waitForEvent('close', { timeout: 0 }).catch(() => {});
            }
        } else {
            if (browserContext && !isHeaded) {
                const pages = browserContext.pages();
                if (pages.length > 0) {
                    await pages[pages.length - 1].screenshot({ path: path.join(__dirname, '../../x-error.png') }).catch(() => {});
                }
            }
            if (isCheckOnly) {
                console.log('JSON:{"connected": false}');
            }
            process.exit(1);
        }
    } finally {
        if (browserContext) await browserContext.close();
        if (cleanupOptFile && fs.existsSync(cleanupOptFile)) {
            try { fs.unlinkSync(cleanupOptFile); } catch (_) {}
        }
        if (taskFile && fs.existsSync(taskFile)) {
            try { fs.unlinkSync(taskFile); } catch (e) {}
        }
    }
}

runAutomation().catch(err => {
    logToFile(`[X-Automation] FATAL ERROR: ${err.message}`);
    process.exit(1);
});
