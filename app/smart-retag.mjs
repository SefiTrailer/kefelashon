import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

const DATA_FILE = path.resolve(__dirname, '../data.json');
const MASTER_TAGS_FILE = path.resolve(__dirname, '../tags_master.json');

const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
const master = JSON.parse(fs.readFileSync(MASTER_TAGS_FILE, 'utf-8'));
const categories = master.categories;

const SYSTEM_PROMPT = `
אתה מומחה לשפה העברית ולמשחקי מילים כפל-לשון.
עליך לסווג תמונה ל-1 עד 3 קטגוריות מתוך הרשימה המצורפת בלבד.
רשימת הקטגוריות המותרות:
${categories.join(', ')}

חובה להחזיר אך ורק את שמות הקטגוריות מופרדים בפסיק.
אם שום קטגוריה לא מתאימה במדויק, בחר "מילים ומשחקי לשון".
`;

async function getBestTags(title, explanation, retries = 3) {
    const prompt = `שם התמונה: ${title}\nהסבר: ${explanation}\n\nבחר את הקטגוריות המתאימות ביותר מהרשימה.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [{ text: prompt }]
                }
            ],
            config: {
                systemInstruction: SYSTEM_PROMPT,
                temperature: 0.3,
            }
        });
        
        const text = response.text.trim();
        
        // Clean up response: remove any non-category words and validate
        const suggested = text.split(',')
            .map(t => t.trim())
            .filter(t => categories.includes(t));
            
        return suggested.length > 0 ? suggested.join(', ') : "מילים ומשחקי לשון";
    } catch (e) {
        if (retries > 0 && e.message.includes('429')) {
            console.log(`⚠️ Quota exceeded for "${title}". Waiting 30s... (Retries left: ${retries})`);
            await new Promise(r => setTimeout(r, 30000));
            return getBestTags(title, explanation, retries - 1);
        }
        console.error(`Error for ${title}:`, e.message);
        return null;
    }
}

async function main() {
    const entries = Object.entries(data);
    console.log(`Processing ${entries.length} entries...`);
    
    let processed = 0;
    for (const [filename, item] of entries) {
        if (!item.title || !item.explanation) {
            continue;
        }

        // Check if current topic is already perfect (strictly in master list)
        const currentTopics = (item.topic || "").split(',').map(t => t.trim()).filter(Boolean);
        const allInMaster = currentTopics.length > 0 && currentTopics.every(t => categories.includes(t));
        
        // We only retag if not all in master OR if it was previously AI generated and we want more accuracy
        // Actually, user wants a thorough cleanup, so let's re-process those that look "weak"
        if (!allInMaster || currentTopics.length === 0) {
            console.log(`[${processed}/${entries.length}] Refining: ${item.title}`);
            const newTags = await getBestTags(item.title, item.explanation);
            if (newTags) {
                console.log(`   Old: ${item.topic} -> New: ${newTags}`);
                data[filename].topic = newTags;
            }
            
            processed++;
            // Save every 20 entries
            if (processed % 20 === 0) {
                fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
            }
            
            // Rate limiting delay
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('✅ Done refining tags.');
}

main();
