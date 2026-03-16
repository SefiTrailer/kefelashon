import sharp from 'sharp';

/**
 * Generates an Average Hash (aHash) for an image.
 * 1. Resize to 8x8
 * 2. Grayscale
 * 3. Calculate average pixel value
 * 4. Generate 64-bit hash (1 if pixel > average, 0 otherwise)
 * @param {string} imagePath 
 * @returns {Promise<string>} 64-bit hex string
 */
export async function generateAHash(imagePath) {
    try {
        const { data, info } = await sharp(imagePath)
            .resize(8, 8, { fit: 'fill' })
            .grayscale()
            .raw()
            .toBuffer({ resolveWithObject: true });

        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i];
        }
        const avg = sum / data.length;

        let hash = "";
        for (let i = 0; i < data.length; i++) {
            hash += data[i] > avg ? "1" : "0";
        }

        // Convert bitstring to hex
        let hex = "";
        for (let i = 0; i < hash.length; i += 4) {
            hex += parseInt(hash.substr(i, 4), 2).toString(16);
        }

        return hex;
    } catch (err) {
        console.error(`Error hashing ${imagePath}:`, err);
        return null;
    }
}

/**
 * Calculates Hamming distance between two hex hashes.
 */
export function getHammingDistance(h1, h2) {
    if (!h1 || !h2 || h1.length !== h2.length) return 999;
    let distance = 0;
    for (let i = 0; i < h1.length; i++) {
        let v1 = parseInt(h1[i], 16);
        let v2 = parseInt(h2[i], 16);
        let xor = v1 ^ v2;
        // Count set bits
        while (xor > 0) {
            if (xor & 1) distance++;
            xor >>= 1;
        }
    }
    return distance;
}
