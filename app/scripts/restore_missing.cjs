const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');

const targetDir = path.join(__dirname, '../תמונות מקור');
const oldDir = path.join(__dirname, '../../temp_old_images_for_restore/app/public/images');

// pHash implementation
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
                dct[u][v] = 0.25 * ((u === 0) ? 1 / Math.sqrt(2) : 1) * ((v === 0) ? 1 / Math.sqrt(2) : 1) * sum;
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
        return null;
    }
}

function hammingDist(h1, h2) {
    let d = 0;
    for (let i = 0; i < 64; i++) { if (h1[i] !== h2[i]) d++; }
    return d;
}

async function start() {
    console.log("Checking out old images from git b869021...");
    try {
        execSync('git worktree add temp_old_images_for_restore b869021', { cwd: path.join(__dirname, '../../') });
    } catch (e) {
        console.log("Worktree probably exists already.");
    }

    if (!fs.existsSync(oldDir)) {
        console.error("Old dir not found:", oldDir);
        return;
    }

    console.log("Hashing current images (Set 2)...");
    const currentFiles = fs.readdirSync(targetDir).filter(f => f.match(/\.(png|jpe?g|webp)$/i));
    const currentHashes = [];
    for (const f of currentFiles) {
        const p = path.join(targetDir, f);
        const h = await computePHash(p);
        if (h) currentHashes.push(h);
    }
    console.log(`Hashed ${currentHashes.length} existing files.`);

    console.log("Checking 1241 Git images (Set 1)...");
    const oldFiles = fs.readdirSync(oldDir).filter(f => f.match(/\.(png|jpe?g|webp)$/i));

    let restoredCount = 0;
    for (const f of oldFiles) {
        const p = path.join(oldDir, f);
        const h = await computePHash(p);

        if (h) {
            let found = false;
            for (const ch of currentHashes) {
                if (hammingDist(h, ch) <= 10) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                fs.copyFileSync(p, path.join(targetDir, f));
                console.log(`[Missing -> Restored] ${f}`);
                restoredCount++;
                currentHashes.push(h); // prevent duplicates if similar exists
            }
        }
    }
    console.log(`Total restored to source folder: ${restoredCount}`);

    console.log("Cleaning up worktree...");
    try {
        execSync('git worktree remove temp_old_images_for_restore --force', { cwd: path.join(__dirname, '../../') });
    } catch (e) { }

    console.log("Done.");
}

start();
