import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const fileName = `${randomUUID()}-${file.name}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, fileName), buffer);
  return NextResponse.json({ url: `/uploads/${fileName}` });
}
