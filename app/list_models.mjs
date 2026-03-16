import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '.env') });

async function list() {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    try {
        const models = await ai.models.list();
        // The SDK might return an array or an object with models/nodes
        console.log('Result type:', typeof models);
        const list = Array.isArray(models) ? models : (models.models || models.nodes || []);
        console.log('Models found:', list.length);
        list.forEach(m => console.log(m.name || m));
    } catch (e) {
        console.error('List failed:', e.message);
    }
}
list();
