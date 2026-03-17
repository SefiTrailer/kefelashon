import fs from 'fs';
import path from 'path';

const dataPath = './data.json';
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

// We'll collect all filenames from all apply-missing-*.mjs files
const files = fs.readdirSync('.').filter(f => f.startsWith('apply-missing-') && f.endsWith('.mjs'));
files.push('apply-final-missing.mjs'); // Include the final fix file

let totalMarked = 0;

for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    // Extract keys from the improvements/improvements object.
    const regex = /"([^"]+\.(?:jpg|png))":/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
        const filename = match[1];
        if (data[filename]) {
            data[filename].isAIAdded = true;
            data[filename].isApproved = false;
            totalMarked++;
        }
    }
}

// Special case for ניסים סאל.png from the final fix script
if (data["ניסים סאל.png"]) {
    data["ניסים סאל.png"].isAIAdded = true;
    data["ניסים סאל.png"].isApproved = false;
    totalMarked++;
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
console.log(`Successfully marked ${totalMarked} images as AI-Added and set isApproved: false.`);
