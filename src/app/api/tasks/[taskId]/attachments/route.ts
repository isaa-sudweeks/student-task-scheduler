import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { db } from '@/server/db';
import { logger } from '@/server/logger';
import { invalidateTaskListCache } from '@/server/api/routers/task/utils';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB
const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'application/pdf',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.png', '.jpg', '.jpeg']);

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

export async function POST(
  req: Request,
  { params }: { params: { taskId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const taskId = params.taskId;
  if (!taskId) {
    return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
  }

  const task = await db.task.findFirst({
    where: { id: taskId, userId: session.user.id },
    select: { id: true, userId: true },
  });

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    logger.warn('Task attachment upload rejected: file too large', {
      taskId,
      name: file.name,
      size: file.size,
    });
    return NextResponse.json({ error: 'File too large' }, { status: 413 });
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    logger.warn('Task attachment upload rejected: unsupported file type', {
      taskId,
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
      { status: 400 },
    );
  }

  const uniqueName = `${randomUUID()}-${safeFileName}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'tasks');
  await mkdir(uploadDir, { recursive: true });

  const destination = path.join(uploadDir, uniqueName);
  const relative = path.relative(uploadDir, destination);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
  }

  await writeFile(destination, buffer);
  const url = `/uploads/tasks/${uniqueName}`;

  const attachment = await db.attachment.create({
    data: {
      taskId: task.id,
      originalName: safeFileName,
      fileName: uniqueName,
      mimeType: file.type,
      size: file.size,
      url,
    },
    select: {
      id: true,
      originalName: true,
      url: true,
      size: true,
      mimeType: true,
      createdAt: true,
    },
  });

  await invalidateTaskListCache(task.userId);

  return NextResponse.json({ attachment });
}
