import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const formData = await request.formData();
    const file = formData.get('audio') as File | null;
    const duration = parseFloat(formData.get('duration') as string || '0');

    if (!file) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    // Convert to base64 data URI
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mimeType = file.type || 'audio/webm';
    const dataUri = `data:${mimeType};base64,${base64}`;

    return NextResponse.json({
      url: dataUri,
      duration: Math.round(duration),
    });
  } catch (error) {
    console.error('Voice upload error:', error);
    return NextResponse.json({ error: 'Failed to process voice message' }, { status: 500 });
  }
}
