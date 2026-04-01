import { NextRequest, NextResponse } from 'next/server';
import { getAdminFromRequest } from '../../admin/helpers';
import { ArchiveFolderKey, uploadArchiveFileToDrive } from '@/lib/googleDrive';

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const admin = await getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folderKey = String(formData.get('folderKey') || '') as ArchiveFolderKey;
    const fileName = String(formData.get('fileName') || '').trim();

    if (!file) return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    if (!folderKey) return NextResponse.json({ error: 'Missing folderKey' }, { status: 400 });
    if (!fileName) return NextResponse.json({ error: 'Missing fileName' }, { status: 400 });

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'File type is not allowed' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File size exceeds 15MB limit' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploaded = await uploadArchiveFileToDrive({
      folderKey,
      fileName,
      mimeType: file.type,
      buffer,
    });

    return NextResponse.json({
      success: true,
      ...uploaded,
    });
  } catch (error: any) {
    console.error('[ArchiveUpload] error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to upload to Google Drive' },
      { status: 500 }
    );
  }
}
