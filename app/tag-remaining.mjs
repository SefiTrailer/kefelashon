import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const DATA_FILE = path.resolve(__dirname, '../data.json');

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY not found in .env');
    process.exit(1);
}
const ai = new GoogleGenAI({ apiKey });

// Load existing data
const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));

const SYSTEM_PROMPT = `
אתה מומחה לשפה העברית ולמשחקי מילים כפל-לשון.
בהינתן כותרת והסבר של תמונה, הצע 2-4 נושאים (topics) מתאימים בעברית, מופרדים בפסיקים.
נושאים נפוצים: אוכל, צבא, חיות, פוליטיקה, יהדות, חגים, משפחה, טכנולוגיה, ספורט, מוזיקה, קולנוע, פתגמים, לשון.
החזר אך ורק את הנושאים כמחרוזת אחת מופרדת בפסיקים.
`;

async function getTopics(item) {
    const prompt = `כותרת: ${item.title}\nהסבר: ${item.explanation}\nנושאים:`;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                systemInstruction: SYSTEM_PROMPT,
                temperature: 0.7
            }
        });
        return response.text.trim().replace(/[".]/g, '');
    } catch (e) {
        console.error(`❌ Error for ${item.title}:`, e.message);
        return null;
    }
}

async function main() {
    const entries = Object.entries(data).filter(([filename, item]) => {
        const hasExplanation = item.explanation && !item.explanation.includes('התמונה ממחישה את הכפל המשמעות');
        const missingTopic = !item.topic || item.topic.trim() === '';
        return hasExplanation && missingTopic;
    });

    console.log(`🔍 Found ${entries.length} images with explanations but no topics.`);

    let count = 0;
    // Process in small batches to avoid interference with ai-tag.mjs
    const LIMIT = 20; 
    const toProcess = entries.slice(0, LIMIT);

    for (const [filename, item] of toProcess) {
        console.log(`⏳ Processing topics for: ${item.title}`);
        const topic = await getTopics(item);
        if (topic) {
            data[filename].topic = topic;
            data[filename].isApproved = false;
            console.log(`✅ Topics: ${topic}`);
            count++;
            
            // Save after each for safety
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
        }
        
        await new Promise(r => setTimeout(r, 4000));
    }

    console.log(`\n🎉 Batch finished! Processed ${count} images.`);
}

main();
