import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text, targetLang = 'id', sourceLang = 'auto' } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Google Translate unofficial free API endpoint
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(
      text
    )}`;

    const maxRetries = 3;
    let attempt = 0;
    let success = false;
    let data;

    while (attempt < maxRetries && !success) {
      try {
        const response = await fetch(url);
        data = await response.json();
        success = true;
      } catch (err) {
        attempt++;
        if (attempt >= maxRetries) throw err;
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }

    // Extract translated text from the weird Google response array
    // The response format is [[["Translated text", "Original text", null, null, 10]], null, "en", ...]
    let translatedText = '';
    if (data && data[0]) {
      data[0].forEach((item: any) => {
        if (item[0]) {
          translatedText += item[0];
        }
      });
    }

    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json({ error: 'Failed to translate' }, { status: 500 });
  }
}
