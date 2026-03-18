import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

// Read from the copied public directory for Vercel deployment
const NOVEL_DIR = path.join(process.cwd(), 'public', 'chapters');
const MAX_CONTEXT_LENGTH = 15000; // Limit per chapter to fit multiple

// Helper function to extract chapter number from filename
function getChapterNumber(filename: string): number {
  const match = filename.match(/Chapter - (\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}

// Ensure the AI client is initialized only if the key exists
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
    ai = new GoogleGenAI({ apiKey: apiKey });
}

export async function POST(request: Request) {
  try {
    if (!ai) {
        return NextResponse.json({ error: 'Gemini API Key is not configured.' }, { status: 500 });
    }

    const { messages, currentChapterId } = await request.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const latestMessage = messages[messages.length - 1].content;

    // --- STEP 1: EXTRACT KEYWORDS ---
    // Ask Gemini to extract the core entities/keywords from the user's question to search the local files.
    const keywordPrompt = `Ekstrak maksimal 5 kata kunci paling penting (nama tokoh, nama tempat, nama jurus, objek) dari pertanyaan berikut untuk digunakan mencari di dalam buku. Kembalikan HANYA kata kuncinya dipisah dengan koma. Jangan beri penjelasan apapun. Jika menanyakan spesifik chapter X, sertakan 'Chapter X'. Pertanyaan: "${latestMessage}"`;
    
    const keywordResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: keywordPrompt }] }],
    });
    
    const keywordsRaw = keywordResponse.text || latestMessage;
    // Map keywords to lowercase and split by comma or space
    const keywords = keywordsRaw.split(/[, ]+/).map((k: string) => k.trim().toLowerCase()).filter((k: string) => k.length > 3 && k !== "yang" && k !== "dan" && k !== "ke" && k !== "dari");

    // --- STEP 2: SCAN FILES FOR RELEVANCE ---
    const files = fs.readdirSync(NOVEL_DIR).filter(f => f.endsWith('.txt'));
    let scoredChapters: { number: number, content: string, score: number }[] = [];

    // Prioritize explicit chapter mentioned
    const chapterMatch = latestMessage.match(/(?:chapter|ch|bab)\s*(\d+)/i);
    const targetChapterNumber = chapterMatch ? parseInt(chapterMatch[1], 10) : null;

    // Scan all chapters quickly (this is local so readFileSync scale is okay for 1200 files, ~100ms)
    for (const file of files) {
        const filePath = path.join(NOVEL_DIR, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const contentLower = content.toLowerCase();
        let score = 0;

        const chNumber = getChapterNumber(file);

        // Huge score boost if explicitly asked for this chapter
        if (targetChapterNumber === chNumber) {
            score += 1000;
        }

        // Small boost if it's the chapter the user is currently reading
        if (currentChapterId && getChapterNumber(currentChapterId) === chNumber) {
            score += 5;
        }

        // Add points for keyword matches
        for (const kw of keywords) {
             const occurrences = (contentLower.match(new RegExp(kw, "g")) || []).length;
             score += occurrences;
        }

        if (score > 0) {
            scoredChapters.push({
                number: chNumber,
                content: content,
                score: score
            });
        }
    }

    // Sort by highest score, take top 2 (to fit in context limits safely)
    scoredChapters.sort((a, b) => b.score - a.score);
    const topChapters = scoredChapters.slice(0, Math.min(2, scoredChapters.length));

    // --- STEP 3: BUILD FINAL CONTEXT ---
    let novelContext = "Context: I am reading the novel Infinity Mage. ";
    
    if (topChapters.length > 0) {
        novelContext += `Berdasarkan pencarian kata kunci (${keywords.join(", ")}), berikut adalah potongan dari ${topChapters.length} chapter yang paling relevan dengan pertanyaan:\n\n`;
        for (const ch of topChapters) {
             let ctext = ch.content;
             if (ctext.length > MAX_CONTEXT_LENGTH) {
                 ctext = ctext.substring(0, MAX_CONTEXT_LENGTH) + "... (terpotong)";
             }
             novelContext += `--- AWAL BAB ${ch.number} ---\n${ctext}\n--- AKHIR BAB ${ch.number} ---\n\n`;
        }
    } else {
         novelContext += `Sistem tidak dapat menemukan chapter spesifik yang sinkron dengan pertanyaan user. Tolong jawab sebisa mungkin atau tanyakan kembali detailnya. `;
         // Fallback to active chapter if nothing found
         if (currentChapterId) {
             const fallbackCh = getChapterNumber(currentChapterId);
             novelContext += `Bab yang sedang dibaca pengguna adalah Bab ${fallbackCh}.`;
         }
    }

    // Inject the structured context behind the scenes
    const systemInstruction = `Kamu adalah AI ahli novel 'Infinity Mage'. Kamu bertugas menjawab pertanyaan atau merangkum cerita berdasarkan konteks bab-bab relevan yang dilampirkan.
SANGAT PENTING: 
1. JANGAN PERNAH mengarang cerita, berimajinasi, atau memprediksi (jangan gunakan kata "kira-kira", "mungkin", "kemungkinan"). Jika cerita belum ada di konteks, katakan "Kejadian tersebut belum ada detailnya di chapter yang telah diberikan."
2. Jika pengguna meminta merangkum lebih dari satu chapter, dan konteksnya mencakup chapter tersebut, rangkum semuanya secara faktual dan rinci HANYA berdasarkan teks.
3. Gunakan formatting Markdown yang rapi (seperti **bold**, *italic*, dan bullet points). Jawab dalam Bahasa Indonesia.`;

    const geminiHistory = [
        { role: 'user', parts: [{ text: systemInstruction + "\n\n" + novelContext + "User Question: " + latestMessage }] }
    ];

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: geminiHistory,
    });

    return NextResponse.json({ 
        role: 'assistant', 
        content: response.text 
    });

  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
