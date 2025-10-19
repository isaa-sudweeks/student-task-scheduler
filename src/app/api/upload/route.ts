import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { logger } from '@/server/logger';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'application/pdf',
]);

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
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    logger.warn('Upload rejected: file too large', {
      name: file.name,
      size: file.size,
    });
    return NextResponse.json({ error: 'File too large' }, { status: 413 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    logger.warn('Upload rejected: unsupported file type', {
      name: file.name,
      type: file.type,
    });
    return NextResponse.json({ error: 'Unsupported file type' }, { status: 415 });
  }

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
