import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSION_DIR = path.resolve(__dirname, '../../.fb-session');

function logToFile(msg) {
    const logPath = path.resolve(__dirname, '../../fb-automation.log');
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
    console.log(msg);
}

function attachGraphqlTracker(page) {
    const events = [];
    const onResponse = async (resp) => {
        try {
            const req = resp.request();
            if (req.method() === 'POST' && resp.url().includes('/api/graphql')) {
                const status = resp.status();
                const txt = await resp.text().catch(() => '');
                let hasError = status >= 400;
                const errMessages = [];
                if (txt) {
                    for (const line of txt.split('\n')) {
                        const s = line.trim();
                        if (!s.startsWith('{')) continue;
                        try {
                            const parsed = JSON.parse(s);
                            if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
                                hasError = true;
                                for (const e of parsed.errors) {
                                    if (e?.message) errMessages.push(String(e.message));
                                }
                            }
                            if (parsed.errorSummary) {
                                hasError = true;
                                errMessages.push(String(parsed.errorSummary));
                            }
                        } catch (_) {}
                    }
                }
                events.push({ status, hasError, errMessages, ts: Date.now() });
            }
        } catch (_) {}
    };
    page.on('response', onResponse);
    return {
        mark() { return events.length; },
        since(idx) { return events.slice(idx); },
        stop() { page.off('response', onResponse); }
    };
}

async function detectVisibleFbError(page) {
    try {
        const alertTexts = await page.locator('[role="alert"]').allInnerTexts().catch(() => []);
        for (const t of alertTexts) {
            const clean = (t || '').trim();
            if (clean && /שגיאה|לא ניתן|נסה שוב|error|couldn\'t|unable|sorry|something went wrong/i.test(clean)) {
                return clean.slice(0, 200);
            }
        }
    } catch (_) {}
    return null;
}

/**
 * Ensures the browser is currently acting as the Personal Profile and NOT as the "כפלשון" Page.
 * In Facebook's New Pages Experience, the user might be switched into the Page profile or
 * a post might default to "Interact as כפלשון".
 */
async function ensurePersonalProfileActive(page) {
    try {
        // 1. Check if there is an inline "Interact as כפלשון" / "אינטראקציה בתור כפלשון" actor switcher on the post
        const actorSwitcher = page.locator(
            '[aria-label*="אינטראקציה בתור כפל"], [aria-label*="Interact as כפל"], [aria-label*="פועל בתור כפל"], [aria-label*="Acting as כפל"], [aria-label*="הגיב/ה בתור כפל"]'
        ).first();

        if (await actorSwitcher.isVisible({ timeout: 2500 }).catch(() => false)) {
            logToFile('[FB-Personal] Detected post actor is set to "כפלשון". Switching to Personal Profile...');
            await actorSwitcher.click();
            await page.waitForTimeout(2000);

            // Pick the personal profile option in the menu/dialog (the option that does NOT contain כפלשון)
            const menuItems = page.locator('[role="menuitem"], [role="menuitemradio"], [role="radio"], [role="option"]');
            const count = await menuItems.count();
            for (let i = 0; i < count; i++) {
                const item = menuItems.nth(i);
                const text = (await item.innerText().catch(() => '')).trim();
                if (text && !text.includes('כפלשון') && !text.includes('כפל לשון') && !text.includes('ביטול') && !text.includes('Cancel')) {
                    logToFile(`[FB-Personal] Selecting personal profile actor: "${text.split('\n')[0]}"`);
                    await item.click();
                    await page.waitForTimeout(2500);
                    break;
                }
            }
        }

        // 2. Check global profile menu in top bar if the entire session is currently switched into the "כפלשון" Page
        const accountBtn = page.locator(
            '[aria-label="החשבון שלך"], [aria-label="Your profile"], [aria-label="בקרות והגדרות של החשבון"], [aria-label="Account Controls and Settings"]'
        ).first();

        if (await accountBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await accountBtn.click();
            await page.waitForTimeout(2000);

            const menuDialog = page.locator('[role="dialog"]').last();
            const menuText = await menuDialog.innerText().catch(() => '');

            // If the first profile shown in the account menu is כפלשון, click the switch profile button
            const firstLines = menuText.split('\n').slice(0, 3).join(' ');
            if (firstLines.includes('כפלשון') || firstLines.includes('כפל לשון')) {
                logToFile('[FB-Personal] Global Facebook session is currently on "כפלשון" Page! Switching to Personal Profile...');
                const switchBtn = menuDialog.locator(
                    '[aria-label*="החלף אל"], [aria-label*="Switch to"], [role="button"]:has-text("החלף פרופיל"), [role="button"]:has-text("Switch")'
                ).first();

                if (await switchBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
                    await switchBtn.click();
                    await page.waitForTimeout(5000);
                    logToFile('[FB-Personal] Switched global profile to Personal Profile!');
                    return;
                }
            }

            // Close the account menu by pressing Escape
            await page.keyboard.press('Escape');
            await page.waitForTimeout(800);
        }
    } catch (e) {
        logToFile(`[FB-Personal] Profile check warning (non-fatal): ${e.message}`);
    }
}

async function runFbAutomation() {
    const args = process.argv.slice(2);
    const isLoginOnly = args.includes('--login');
    const isCheckOnly = args.includes('--check');
    const isDryRun = args.includes('--dry-run');
    const isDryRunStory = args.includes('--dry-run-story');
    const taskFile = args.find(arg => arg.startsWith('--task='))?.split('=')[1];

    let postUrl = '';
    let fallbackUrls = [];
    let shareToStory = true;

    if (taskFile && fs.existsSync(taskFile)) {
        try {
            const task = JSON.parse(fs.readFileSync(taskFile, 'utf8'));
            if (task.postUrl) postUrl = task.postUrl;
            if (Array.isArray(task.fallbackUrls)) fallbackUrls = task.fallbackUrls;
            if (task.shareToStory !== undefined) shareToStory = !!task.shareToStory;
            logToFile(`[FB-Personal] Loaded task from ${taskFile} (postUrl: ${postUrl}, shareToStory: ${shareToStory})`);
        } catch (e) {
            logToFile(`[FB-Personal] Error reading task file: ${e.message}`);
        }
    }

    const isHeaded = args.includes('--headed') || (isLoginOnly && !isCheckOnly);

    if (isCheckOnly) {
        if (!fs.existsSync(SESSION_DIR) || !fs.existsSync(path.join(SESSION_DIR, 'Default'))) {
            console.log('JSON:{"connected": false}');
            return;
        }
    }

    if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    let browserContext;
    let launchAttempts = 6;

    while (launchAttempts > 0) {
        try {
            browserContext = await chromium.launchPersistentContext(SESSION_DIR, {
                headless: !isHeaded,
                channel: 'msedge',
                viewport: { width: 1280, height: 850 },
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
                ignoreDefaultArgs: ['--enable-automation'],
                args: [
                    '--disable-blink-features=AutomationControlled',
                    '--disable-infobars',
                    '--window-position=60,60',
                ],
            });
            break;
        } catch (err) {
            launchAttempts--;
            logToFile(`[FB-Personal] Launch failed (Attempts left: ${launchAttempts}): ${err.message}`);
            if (launchAttempts === 0) throw err;
            await new Promise(r => setTimeout(r, 2500));
        }
    }

    try {
        const page = await browserContext.newPage();
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
        });

        logToFile('[FB-Personal] Navigating to Facebook...');
        await page.goto('https://www.facebook.com/', {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });
        await page.waitForTimeout(3500);

        const hasEmailInput = (await page.locator('input[name="email"]').count()) > 0;
        const isLoggedIn = !hasEmailInput && !page.url().includes('/login');

        if (isCheckOnly) {
            console.log(`JSON:{"connected": ${isLoggedIn}}`);
            return;
        }

        if (!isLoggedIn) {
            logToFile('[FB-Personal] Not logged into Personal Facebook.');
            if (isLoginOnly) {
                logToFile('[FB-Personal] Please log into your personal Facebook account in the opened window...');
                const detectionInterval = setInterval(async () => {
                    try {
                        if (page.isClosed()) {
                            clearInterval(detectionInterval);
                            return;
                        }
                        const emailCount = await page.locator('input[name="email"]').count();
                        const hasNav = await page.locator('[role="navigation"], [aria-label="Facebook"], [aria-label="פייסבוק"]').count();
                        if (emailCount === 0 && hasNav > 0 && !page.url().includes('/login') && !page.url().includes('checkpoint')) {
                            logToFile('[FB-Personal] Login detected! Ensuring personal profile is selected and closing in 4s...');
                            clearInterval(detectionInterval);
                            await ensurePersonalProfileActive(page);
                            await page.waitForTimeout(3000);
                            await browserContext.close().catch(() => {});
                            process.exit(0);
                        }
                    } catch (e) {
                        // ignore transient navigation errors while user logs in
                    }
                }, 3000);

                await page.waitForEvent('close', { timeout: 0 });
                clearInterval(detectionInterval);
                return;
            } else {
                throw new Error('NOT_LOGGED_IN: יש להתחבר פעם אחת לפרופיל הפייסבוק האישי בלחיצה על כפתור ההתחברות בממשק');
            }
        }

        if (isLoginOnly) {
            logToFile('[FB-Personal] Already logged in! Ensuring personal profile is active and closing in 4s...');
            await ensurePersonalProfileActive(page);
            await page.waitForTimeout(4000);
            return;
        }

        if (!postUrl) {
            throw new Error('לא התקבל קישור לפוסט של דף כפלשון לצורך ריפוסט');
        }

        // First make sure the global Facebook session is in the Personal Profile (NOT כפלשון)
        await ensurePersonalProfileActive(page);

        const urlsToTry = [postUrl, ...fallbackUrls.filter(u => u && u !== postUrl)];

        // Navigate directly to the "כפלשון" Page post URL and click its native "שתף" (Share) button -> "שתף עכשיו" (Share now)
        for (const targetUrl of urlsToTry) {
            logToFile(`[FB-Personal] Opening כפלשון post directly for native Share: ${targetUrl}`);
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await page.waitForTimeout(4500);

            // Ensure the post's actor switcher is set to Personal Profile (not כפלשון)
            await ensurePersonalProfileActive(page);

            // Check if the post opened inside a modal dialog ("הפוסט של כפלשון")
            const postDialog = page.locator('[role="dialog"]').filter({ hasText: 'כפלשון' }).first();
            const hasDialog = await postDialog.isVisible({ timeout: 3000 }).catch(() => false);
            const scope = hasDialog ? postDialog : page;

            if (hasDialog) {
                logToFile('[FB-Personal] Post opened inside modal dialog ("הפוסט של כפלשון"). Scrolling inside dialog to reveal Share button...');
                await postDialog.evaluate((el) => {
                    const scrollables = el.querySelectorAll('div');
                    for (const div of scrollables) {
                        if (div.scrollHeight > div.clientHeight + 50) {
                            div.scrollTop = div.scrollHeight;
                        }
                    }
                }).catch(() => {});
                await page.waitForTimeout(1200);

                const labels = await postDialog.evaluate((el) =>
                    Array.from(el.querySelectorAll('[role="button"]'))
                        .map(b => b.getAttribute('aria-label') || b.innerText.trim())
                        .filter(Boolean)
                ).catch(() => []);
                logToFile(`[FB-Personal] Dialog buttons: ${JSON.stringify(labels)}`);
            }

            const shareCandidateLocators = [
                // In photo viewer or post dialog:
                scope.locator('[role="dialog"] [aria-label*="שיתוף הפוסט"]'),
                scope.locator('[role="dialog"] [aria-label="שיתוף"]'),
                scope.locator('[role="dialog"] [aria-label*="שתף"]'),
                scope.locator('[role="dialog"] [role="button"]:has-text("שיתוף")'),
                scope.locator('[role="dialog"] [role="button"]:has-text("שתף")'),
                // In feed / article / main post container:
                scope.locator('[role="article"] [aria-label*="שיתוף הפוסט"]'),
                scope.locator('[role="article"] [aria-label="שיתוף"]'),
                scope.locator('[role="article"] [aria-label*="שתף"]'),
                scope.locator('[role="article"] [role="button"]:has-text("שיתוף")'),
                scope.locator('[role="article"] [role="button"]:has-text("שתף")'),
                // Direct specific aria-labels:
                scope.locator('[aria-label*="שיתוף הפוסט של כפלשון"]'),
                scope.locator('[aria-label*="שיתוף הפוסט"]'),
                scope.locator('[aria-label="שיתוף"]'),
                scope.locator('[aria-label*="שליחת הפוסט"]'),
                scope.locator('[aria-label*="שלח את זה"]'),
                scope.locator('[aria-label*="Share post"]'),
                scope.locator('[aria-label="Share"]'),
                scope.locator('[role="button"]:has-text("שיתוף")'),
                scope.locator('[role="button"]:has-text("שתף")'),
                scope.locator('[role="button"]:has-text("Share")')
            ];

            let nativeShareBtn = null;
            for (const loc of shareCandidateLocators) {
                const count = await loc.count().catch(() => 0);
                for (let i = 0; i < count; i++) {
                    const btn = loc.nth(i);
                    if (await btn.isVisible().catch(() => false)) {
                        const ariaLabel = (await btn.getAttribute('aria-label').catch(() => '')) || '';
                        const btnText = (await btn.innerText().catch(() => '')) || '';
                        const combined = `${ariaLabel} ${btnText}`.toLowerCase();

                        // Discard top nav account / profile buttons, notifications, comments, likes
                        if (
                            combined.includes('חשבון') ||
                            combined.includes('הפרופיל שלך') ||
                            combined.includes('your profile') ||
                            combined.includes('account') ||
                            combined.includes('התראות') ||
                            combined.includes('notifications') ||
                            combined.includes('הודעות') ||
                            combined.includes('messenger') ||
                            combined.includes('תגובה') ||
                            combined.includes('comment') ||
                            combined.includes('לייק') ||
                            combined.includes('like')
                        ) {
                            continue;
                        }

                        if (
                            combined.includes('שיתוף') ||
                            combined.includes('שתף') ||
                            combined.includes('שליחת') ||
                            combined.includes('share')
                        ) {
                            nativeShareBtn = btn;
                            break;
                        }
                    }
                }
                if (nativeShareBtn) break;
            }

            if (nativeShareBtn && await nativeShareBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
                const shareLabel = await nativeShareBtn.getAttribute('aria-label').catch(() => '');
                logToFile(`[FB-Personal] Clicking native Share button on כפלשון post (aria-label="${shareLabel}")...`);
                await nativeShareBtn.scrollIntoViewIfNeeded().catch(() => {});
                await nativeShareBtn.click({ force: true });
                await page.waitForTimeout(3500);

                // Log all visible buttons/menuitems in the Share dialog/menu that opened
                const shareMenuLabels = await page.evaluate(() =>
                    Array.from(document.querySelectorAll('[role="dialog"] [role="button"], [role="menu"] [role="menuitem"], [role="menuitem"]'))
                        .map(b => b.getAttribute('aria-label') || b.innerText.trim())
                        .filter(Boolean)
                ).catch(() => []);
                logToFile(`[FB-Personal] After Share click buttons: ${JSON.stringify(shareMenuLabels.slice(-20))}`);

                if (isDryRunStory) {
                    const storyBtn = page.locator(
                        '[aria-label="הסטורי שלך"], [role="button"]:has-text("הסטורי שלך"), [aria-label="Your story"], [role="button"]:has-text("Your story")'
                    ).first();
                    logToFile(`[FB-Personal] Dry-run-story: storyBtn visible=${await storyBtn.isVisible()}`);
                    await storyBtn.click({ force: true });
                    await page.waitForTimeout(5000);
                    const postStoryLabels = await page.evaluate(() =>
                        Array.from(document.querySelectorAll('[role="button"], [role="menuitem"]'))
                            .map(b => b.getAttribute('aria-label') || b.innerText.trim())
                            .filter(Boolean)
                    ).catch(() => []);
                    logToFile(`[FB-Personal] After clicking הסטורי שלך buttons: ${JSON.stringify(postStoryLabels.slice(-25))}`);
                    await page.screenshot({ path: path.join(__dirname, '../../fb-story-dryrun.png') }).catch(() => {});
                    return;
                }

                // Click "שיתוף עכשיו" / "שתף עכשיו" / "Share now" in the share dialog
                const confirmShareBtn = page.locator(
                    [
                        '[aria-label="שיתוף עכשיו"]',
                        '[aria-label*="שיתוף עכשיו"]',
                        '[role="button"]:has-text("שיתוף עכשיו")',
                        '[role="menuitem"]:has-text("שיתוף עכשיו")',
                        '[aria-label="שתף עכשיו"]',
                        '[aria-label*="שתף עכשיו"]',
                        '[role="button"]:has-text("שתף עכשיו")',
                        '[role="menuitem"]:has-text("שתף עכשיו")',
                        '[aria-label="Share now"]',
                        '[aria-label*="Share now"]',
                        '[role="button"]:has-text("Share now")',
                        '[role="menuitem"]:has-text("Share now")',
                        '[role="dialog"] [aria-label="פרסם"]',
                        '[role="dialog"] [aria-label="Post"]',
                        '[role="dialog"] [role="button"]:has-text("פרסם")',
                        '[role="dialog"] [role="button"]:has-text("Post")'
                    ].join(', ')
                ).first();

                if (await confirmShareBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
                    const btnText = (await confirmShareBtn.innerText().catch(() => '')) || (await confirmShareBtn.getAttribute('aria-label').catch(() => ''));
                    logToFile(`[FB-Personal] Found confirm share button: "${btnText.trim()}"`);
                    if (isDryRun) {
                        await page.screenshot({ path: path.join(__dirname, '../../fb-dryrun.png') }).catch(() => {});
                        logToFile('[FB-Personal] Dry-run verified confirmShareBtn is visible on native Share menu!');
                        return;
                    }

                    const gqlTracker = attachGraphqlTracker(page);
                    try {
                        const gqlStart = gqlTracker.mark();
                        logToFile('[FB-Personal] Clicking "שיתוף עכשיו" button and validating completion...');
                        await confirmShareBtn.click({ force: true });

                        let btnClosed = false;
                        for (let tick = 0; tick < 24; tick++) {
                            await page.waitForTimeout(500);
                            const stillVis = await confirmShareBtn.isVisible().catch(() => false);
                            const errMsg = await detectVisibleFbError(page);
                            if (errMsg) {
                                throw new Error(`FACEBOOK_UI_ERROR: ${errMsg}`);
                            }
                            if (!stillVis) {
                                btnClosed = true;
                                break;
                            }
                        }

                        // Give late GraphQL mutation response ~1.5s to land cleanly
                        await page.waitForTimeout(1500);
                        const gqlEvents = gqlTracker.since(gqlStart);
                        const gqlErr = gqlEvents.find(e => e.hasError);
                        const postUiErr = await detectVisibleFbError(page);

                        if (postUiErr) {
                            throw new Error(`FACEBOOK_UI_ERROR: ${postUiErr}`);
                        }
                        if (gqlErr) {
                            throw new Error(`FACEBOOK_GRAPHQL_ERROR: ${(gqlErr.errMessages || []).join('; ') || 'HTTP ' + gqlErr.status}`);
                        }
                        if (!btnClosed) {
                            throw new Error('FEED_REPOST_NOT_CONFIRMED: כפתור השיתוף נשאר פתוח ולא נסגר');
                        }

                        logToFile(`[FB-Personal] Feed Repost validated! (gqlEvents=${gqlEvents.length}, closed=${btnClosed})`);

                        let storyOk = shareToStory ? false : null;
                        let storyError = null;

                        if (shareToStory) {
                            try {
                                logToFile('[FB-Personal] Also sharing כפלשון post to Personal Story ("הסטורי שלך")...');
                                await nativeShareBtn.scrollIntoViewIfNeeded().catch(() => {});
                                await nativeShareBtn.click({ force: true });
                                await page.waitForTimeout(3000);

                                const storyBtn = page.locator(
                                    '[aria-label="הסטורי שלך"], [role="button"]:has-text("הסטורי שלך"), [aria-label="Your story"], [role="button"]:has-text("Your story")'
                                ).first();
                                if (await storyBtn.isVisible({ timeout: 6000 }).catch(() => false)) {
                                    const storyGqlStart = gqlTracker.mark();
                                    await storyBtn.click({ force: true });
                                    await page.waitForTimeout(2500);

                                    // Handle optional secondary "Share to Story" confirmation dialog if Facebook renders one
                                    const storyConfirmBtn = page.locator(
                                        '[role="dialog"] [aria-label*="שתף לסטורי"], [role="dialog"] [role="button"]:has-text("שתף לסטורי"), [role="dialog"] [aria-label*="Share to story"], [role="dialog"] [aria-label*="Share to Story"], [role="dialog"] [role="button"]:has-text("Share to Story")'
                                    ).first();
                                    if (await storyConfirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                                        logToFile('[FB-Personal] Clicking secondary Story confirm button...');
                                        await storyConfirmBtn.click({ force: true });
                                        await page.waitForTimeout(2500);
                                    }

                                    for (let tick = 0; tick < 12; tick++) {
                                        const sVis = await storyBtn.isVisible().catch(() => false);
                                        const sErr = await detectVisibleFbError(page);
                                        if (sErr) {
                                            storyError = sErr;
                                            break;
                                        }
                                        const sEvents = gqlTracker.since(storyGqlStart);
                                        if (!sVis && sEvents.some(e => !e.hasError)) {
                                            break;
                                        }
                                        await page.waitForTimeout(500);
                                    }

                                    const storyEvents = gqlTracker.since(storyGqlStart);
                                    const storyGqlErr = storyEvents.find(e => e.hasError);
                                    const finalStoryUiErr = storyError || await detectVisibleFbError(page);
                                    const storyBtnStillVisible = await storyBtn.isVisible().catch(() => false);

                                    if (finalStoryUiErr) {
                                        storyError = finalStoryUiErr;
                                        logToFile(`[FB-Personal] Story share UI error: ${storyError}`);
                                    } else if (storyGqlErr) {
                                        storyError = (storyGqlErr.errMessages || []).join('; ') || `GraphQL HTTP ${storyGqlErr.status}`;
                                        logToFile(`[FB-Personal] Story share GraphQL error: ${storyError}`);
                                    } else if (storyBtnStillVisible) {
                                        storyError = 'תפריט השיתוף לסטורי נשאר פתוח';
                                        logToFile(`[FB-Personal] Story share warning: ${storyError}`);
                                    } else {
                                        storyOk = true;
                                        logToFile(`[FB-Personal] Story share validated! (gqlEvents=${storyEvents.length})`);
                                    }
                                } else {
                                    storyError = 'כפתור "הסטורי שלך" לא הופיע בתפריט השיתוף';
                                    logToFile(`[FB-Personal] Story warning: ${storyError}`);
                                }
                            } catch (storyErr) {
                                storyError = storyErr.message;
                                logToFile(`[FB-Personal] Story share warning (non-fatal): ${storyErr.message}`);
                            }
                        }

                        const resultObj = {
                            ok: true,
                            validated: true,
                            feedOk: true,
                            storyOk,
                            storyError,
                            postUrl: targetUrl
                        };
                        console.log(`RESULT_JSON:${JSON.stringify(resultObj)}`);
                        return;
                    } finally {
                        gqlTracker.stop();
                    }
                } else {
                    await page.screenshot({ path: path.join(__dirname, '../../fb-dryrun.png') }).catch(() => {});
                    logToFile('[FB-Personal] Native Share clicked, but confirm button not matched yet. Saved fb-dryrun.png');
                    if (isDryRun) return;
                }
            }
        }

        throw new Error('לא נמצא כפתור השיתוף על הפוסט של כפלשון — ודא שהפרופיל האישי מחובר');

    } catch (err) {
        logToFile(`[FB-Personal] ERROR: ${err.message}`);
        console.log(`RESULT_JSON:${JSON.stringify({ ok: false, validated: false, feedOk: false, error: err.message })}`);
        if (!isHeaded && browserContext) {
            const pages = browserContext.pages();
            if (pages.length > 0) {
                await pages[pages.length - 1].screenshot({ path: path.join(__dirname, '../../fb-error.png') }).catch(() => {});
            }
        }
        if (isCheckOnly) {
            console.log('JSON:{"connected": false}');
        }
        process.exit(1);
    } finally {
        if (browserContext) await browserContext.close().catch(() => {});
        if (taskFile && fs.existsSync(taskFile)) {
            try { fs.unlinkSync(taskFile); } catch (e) {}
        }
    }
}

runFbAutomation();
