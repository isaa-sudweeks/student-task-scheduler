import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const ALLOWED_EXTENSIONS = new Set(['.pdf']);

function sanitizeFileName(name: string): string {
  const baseName = path.basename(name);
  const extension = path.extname(baseName).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error('Unsupported file type');
  }

  const stem = baseName.slice(0, baseName.length - extension.length);
  const safeStem = stem.replace(/[^a-zA-Z0-9_-]/g, '_') || 'file';

  return `${safeStem}${extension}`;
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  let safeFileName: string;
  try {
    safeFileName = sanitizeFileName(file.name);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unsupported file type' },
      { status: 400 }
    );
  }

  const fileName = `${randomUUID()}-${safeFileName}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });

  const destination = path.join(uploadDir, fileName);
  const relative = path.relative(uploadDir, destination);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  await writeFile(destination, buffer);
  return NextResponse.json({ url: `/uploads/${fileName}` });
}
