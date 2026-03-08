const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const currentDir = path.join(__dirname, '../תמונות מקור');
const oldDir = path.join(__dirname, '../../../temp_old_images/app/public/images');
const candidatesDir = path.join(__dirname, '../deleted_candidates');

// --- Perceptual Hashing (pHash) Implementation ---
async function computePHash(imagePath) {
    try {
        const { data } = await sharp(imagePath)
            .resize(32, 32, { fit: 'fill' })
            .greyscale()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const matrix = [];
        for (let y = 0; y < 32; y++) {
            matrix[y] = new Float64Array(32);
            for (let x = 0; x < 32; x++) {
                matrix[y][x] = data[y * 32 + x];
            }
        }

        const dct = [];
        for (let u = 0; u < 8; u++) {
            dct[u] = new Float64Array(8);
            for (let v = 0; v < 8; v++) {
                let sum = 0;
                for (let i = 0; i < 32; i++) {
                    for (let j = 0; j < 32; j++) {
                        sum += matrix[i][j] *
                            Math.cos(((2 * i + 1) * u * Math.PI) / 64) *
                            Math.cos(((2 * j + 1) * v * Math.PI) / 64);
                    }
                }
                let cu = (u === 0) ? (1 / Math.sqrt(2)) : 1;
                let cv = (v === 0) ? (1 / Math.sqrt(2)) : 1;
                dct[u][v] = 0.25 * cu * cv * sum;
            }
        }

        let total = 0;
        let pHashValues = [];
        for (let u = 0; u < 8; u++) {
            for (let v = 0; v < 8; v++) {
                if (u === 0 && v === 0) continue;
                total += dct[u][v];
                pHashValues.push(dct[u][v]);
            }
        }
        let median = total / 63;

        let hash = '';
        for (let u = 0; u < 8; u++) {
            for (let v = 0; v < 8; v++) {
                if (u === 0 && v === 0) continue;
                hash += (dct[u][v] > median) ? '1' : '0';
            }
        }
        return hash.padEnd(64, '0');
    } catch (err) {
        console.error(`Error hashing ${imagePath}:`, err.message);
        return null;
    }
}

function hammingDistance(hash1, hash2) {
    let diff = 0;
    for (let i = 0; i < 64; i++) {
        if (hash1[i] !== hash2[i]) diff++;
    }
    return diff;
}

async function start() {
    if (!fs.existsSync(oldDir)) {
        console.error("Old dir not found:", oldDir);
        return;
    }

    const oldFiles = fs.readdirSync(oldDir).filter(f => f.match(/\.(png|jpe?g|webp)$/i));
    console.log(`Processing ${oldFiles.length} old valid images...`);

    const oldHashes = [];
    let countOld = 0;
    for (const f of oldFiles) {
        const p = path.join(oldDir, f);
        const h = await computePHash(p);
        if (h) oldHashes.push({ file: f, hash: h });
        countOld++;
        if (countOld % 100 === 0) console.log(`Hashed ${countOld} old files...`);
    }

    const currentFiles = fs.readdirSync(currentDir).filter(f => f.match(/\.(png|jpe?g|webp)$/i));
    console.log(`Processing ${currentFiles.length} current images...`);

    if (!fs.existsSync(candidatesDir)) {
        fs.mkdirSync(candidatesDir, { recursive: true });
    }

    let unmatchedCount = 0;
    let matchedCount = 0;

    for (let i = 0; i < currentFiles.length; i++) {
        const f = currentFiles[i];
        const p = path.join(currentDir, f);
        const h = await computePHash(p);

        let foundMatch = false;
        if (h) {
            for (const old of oldHashes) {
                if (hammingDistance(h, old.hash) <= 10) {
                    foundMatch = true;
                    break;
                }
            }
        }

        if (!foundMatch) {
            unmatchedCount++;
            fs.renameSync(p, path.join(candidatesDir, f));
            console.log(`[Unmatched -> Moved] ${f}`);
        } else {
            matchedCount++;
        }

        if (i > 0 && i % 100 === 0) console.log(`Processed ${i} current files... Moved ${unmatchedCount} so far.`);
    }

    console.log(`\nSummary:\nMatched (Kept in source): ${matchedCount}\nUnmatched (Moved to candidates dir): ${unmatchedCount}\n`);

    // Cleanup worktree in git
    try {
        const execSync = require('child_process').execSync;
        console.log("Removing git worktree...");
        execSync('git worktree remove ../../../temp_old_images --force', { cwd: path.join(__dirname, '..') });
    } catch (e) {
        console.error("Failed to remove worktree automatically");
    }

    console.log("Done.");
}

start();
