import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Read from the copied public directory for Vercel deployment
const NOVEL_DIR = path.join(process.cwd(), 'public', 'chapters');

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const filename = decodeURIComponent(params.id);
    const filePath = path.join(NOVEL_DIR, filename);
    
    // Check if filename is safe
    if (!filePath.startsWith(path.normalize(NOVEL_DIR))) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    const content = await fs.promises.readFile(filePath, 'utf-8');
    
    // Split into paragraphs, filtering out empty ones
    const paragraphs = content
      .split(/\r?\n/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
      
    // Format the result
    return NextResponse.json({
      id: filename,
      title: filename.replace('.txt', ''),
      paragraphs,
    });
  } catch (error) {
    console.error('Error reading chapter file:', error);
    return NextResponse.json({ error: 'Failed to read chapter' }, { status: 404 });
  }
}
