import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID }                 from 'crypto';

const R2 = new S3Client({
  region:   'auto',
  endpoint: process.env.R2_ENDPOINT ?? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID     ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
});

const BUCKET     = process.env.R2_BUCKET_NAME  ?? '';
const PUBLIC_URL = process.env.R2_PUBLIC_URL   ?? '';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file     = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // ✅ Validate type + size
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only images allowed' }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Max file size is 5MB' }, { status: 400 });
    }

    const folder    = (formData.get('folder') as string) ?? 'products';
    const ext       = file.name.split('.').pop() ?? 'jpg';
    const key       = `${folder}/${randomUUID()}.${ext}`;
    const buffer    = Buffer.from(await file.arrayBuffer());

    await R2.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      Body:        buffer,
      ContentType: file.type,
    }));

    const url = `${PUBLIC_URL}/${key}`;
    return NextResponse.json({ url, key });
  } catch (err) {
    console.error('R2 upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
