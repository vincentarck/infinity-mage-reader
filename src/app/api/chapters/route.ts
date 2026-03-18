import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Read from the copied public directory for Vercel deployment
const NOVEL_DIR = path.join(process.cwd(), 'public', 'chapters');

export async function GET() {
  try {
    const files = await fs.promises.readdir(NOVEL_DIR);
    
    // Parse chapter number and title
    const chapters = files
      .filter(file => file.endsWith('.txt'))
      .map(file => {
        // Filename format: "Chapter - 1 - meet the magic (1) 4.txt"
        const match = file.match(/Chapter\s*-\s*(\d+)/i);
        const chapterNumber = match ? parseInt(match[1], 10) : 0;
        
        return {
          id: file, // use filename as id
          number: chapterNumber,
          title: file.replace('.txt', ''),
        };
      })
      .sort((a, b) => a.number - b.number); // Sort numerically
      
    return NextResponse.json(chapters);
  } catch (error) {
    console.error('Error reading novel directory:', error);
    return NextResponse.json({ error: 'Failed to read chapters directory' }, { status: 500 });
  }
}
