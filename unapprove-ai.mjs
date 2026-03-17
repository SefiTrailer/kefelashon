import fs from 'fs';

const dataPath = './data.json';
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

let unapprovedCount = 0;

for (const filename in data) {
    if (data[filename].isAIImproved === true) {
        data[filename].isApproved = false;
        unapprovedCount++;
    }
}

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
console.log(`Successfully unapproved ${unapprovedCount} AI-improved images.`);
