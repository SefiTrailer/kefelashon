import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
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
    let launchAttempts = 3;
    
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
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-infobars',
                    '--window-position=0,0',
                    '--ignore-certifcate-errors',
                    '--ignore-certifcate-errors-spki-list',
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

        const absoluteImagePath = path.resolve(imagePath);
        if (!fs.existsSync(absoluteImagePath)) throw new Error(`Image not found at ${absoluteImagePath}`);

        logToFile('[X-Automation] Preparing to post...');
        
        const postButton = page.locator('[data-testid="SideNav_NewTweet_Button"]').first();
        if (await postButton.isVisible()) {
            await postButton.click();
        }

        const composer = page.locator('[data-testid="tweetTextarea_0"]').first();
        await composer.waitFor();
        await composer.fill(caption);

        logToFile('[X-Automation] Uploading image...');
        // Use .first() to avoid strict mode violation if multiple inputs exist
        const fileInput = page.locator('input[data-testid="fileInput"]').first();
        await fileInput.setInputFiles(absoluteImagePath);
        
        logToFile('[X-Automation] Waiting for image attachment to be ready...');
        // Wait for the attachment removal button - it has [role="button"] inside the attachments div
        // This is more robust than aria-label="Remove" which is language-specific
        await page.waitForSelector('[data-testid="attachments"] [role="button"]', { timeout: 45000 });
        
        logToFile('[X-Automation] Waiting for Post button to be enabled...');
        const submitButton = page.locator('[data-testid="tweetButton"], [data-testid="tweetButtonInline"]').first();
        await submitButton.waitFor({ state: 'visible', timeout: 30000 });
        
        // Final check: Post button must be enabled
        await page.waitForFunction((btn) => {
            return !btn.disabled && btn.getAttribute('aria-disabled') !== 'true';
        }, await submitButton.elementHandle(), { timeout: 15000 });

        logToFile('[X-Automation] Clicking Post...');
        if (await submitButton.isVisible()) {
            await submitButton.click();
        } else {
            throw new Error('Could not find Post button');
        }

        await Promise.race([
            composer.waitFor({ state: 'hidden', timeout: 30000 }),
            page.waitForSelector('[data-testid="toast"]', { timeout: 30000 })
        ]);

        logToFile('[X-Automation] Success! Image posted to X.');
        await page.waitForTimeout(2000);

    } catch (err) {
        logToFile(`[X-Automation] ERROR: ${err.message}`);
        if (isLoginOnly && browserContext) {
            logToFile('[X-Automation] Error during login setup, but keeping window open for manual fix...');
            // In login mode, if something fails (like navigation), still wait for user to close
            const pages = browserContext.pages();
            if (pages.length > 0) {
                await pages[0].waitForEvent('close', { timeout: 0 }).catch(() => {});
            }
        } else {
            if (browserContext && !isHeaded) {
                const pages = browserContext.pages();
                if (pages.length > 0) {
                    await pages[0].screenshot({ path: path.join(__dirname, '../../x-error.png') }).catch(() => {});
                }
            }
            if (isCheckOnly) {
                console.log('JSON:{"connected": false}');
            }
            process.exit(1);
        }
    } finally {
        if (browserContext) await browserContext.close();
        if (taskFile && fs.existsSync(taskFile)) {
            try { fs.unlinkSync(taskFile); } catch (e) {}
        }
    }
}

runAutomation().catch(err => {
    logToFile(`[X-Automation] FATAL ERROR: ${err.message}`);
    process.exit(1);
});
