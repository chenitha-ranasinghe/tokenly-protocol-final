/**
 * POST /api/archionlabs/models
 * GET  /api/archionlabs/models?modelId=xxx  (serve stored model file)
 *
 * Accepts IFC or GLB/GLTF file uploads from the ArchionLabs 3D viewer.
 * Stores files in the configured BIM_MODEL_DIR (default: /tmp/bim-models/).
 *
 * In production, set BIM_MODEL_BUCKET and configure the S3 client to store
 * on AWS S3 / Cloudflare R2 instead of the local filesystem.
 *
 * Supported types:
 *  - .ifc   — Industry Foundation Classes (BIM standard)
 *  - .glb   — Binary glTF (optimised for web rendering)
 *  - .gltf  — JSON glTF
 *
 * Max file size: 100 MB (configurable via BIM_MAX_SIZE_MB env var)
 *
 * Response:
 *  { modelId, modelUrl, modelType: 'glb' | 'ifc', fileName, sizeBytes }
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';
import { authenticateRequest } from '@/lib/session';
import { enforceRateLimit } from '@/lib/rate-limit-request';
import { jsonError } from '@/lib/api-response';
import { writeAuditLog } from '@/lib/audit';

// ── Config ────────────────────────────────────────────────────────────────────

const MODEL_DIR     = process.env.BIM_MODEL_DIR ?? '/tmp/bim-models';
const MAX_SIZE_MB   = Number(process.env.BIM_MAX_SIZE_MB ?? '100');
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const APP_URL       = process.env.NEXT_PUBLIC_APP_URL ?? '';

const ALLOWED_TYPES: Record<string, 'glb' | 'ifc'> = {
  'model/gltf-binary':   'glb',
  'model/gltf+json':     'glb',
  'application/octet-stream': 'glb', // GLB without correct MIME
  'application/x-step':  'ifc',
  'application/ifc':     'ifc',
};

const ALLOWED_EXTENSIONS: Record<string, 'glb' | 'ifc'> = {
  '.glb':  'glb',
  '.gltf': 'glb',
  '.ifc':  'ifc',
};

// ── Ensure storage directory exists ──────────────────────────────────────────

async function ensureDir(): Promise<void> {
  try {
    await fs.mkdir(MODEL_DIR, { recursive: true });
  } catch {
    // Already exists
  }
}

// ── POST — Upload ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth
  const user = await authenticateRequest(request);
  if (!user) return jsonError('You must be signed in to upload BIM models.', 401, 'UNAUTHORIZED');

  // Rate limit: 10 uploads per user per hour
  const rl = await enforceRateLimit(request, `bim:upload:${user.id}`, 10, 3600);
  if (rl) return rl;

  // Must be multipart/form-data
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return jsonError('Request must be multipart/form-data with a "file" field.', 400, 'BAD_REQUEST');
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('Could not parse form data. Ensure Content-Type is multipart/form-data.', 400, 'BAD_REQUEST');
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return jsonError('No file provided. Include a "file" field in the form data.', 400, 'VALIDATION_ERROR');
  }

  // Size check
  if (file.size > MAX_SIZE_BYTES) {
    return jsonError(
      `File too large. Maximum allowed size is ${MAX_SIZE_MB} MB (received ${(file.size / 1024 / 1024).toFixed(1)} MB).`,
      413,
      'FILE_TOO_LARGE'
    );
  }
  if (file.size === 0) {
    return jsonError('File is empty.', 400, 'VALIDATION_ERROR');
  }

  // Determine model type from extension first, then MIME type
  const ext      = path.extname(file.name).toLowerCase();
  const byExt    = ALLOWED_EXTENSIONS[ext];
  const byMime   = ALLOWED_TYPES[file.type];
  const modelType: 'glb' | 'ifc' | undefined = byExt ?? byMime;

  if (!modelType) {
    return jsonError(
      `Unsupported file type: ${file.type || 'unknown'} (${ext}). Accepted: .glb, .gltf, .ifc`,
      415,
      'UNSUPPORTED_FILE_TYPE'
    );
  }

  // Read file bytes
  const buffer = Buffer.from(await file.arrayBuffer());

  // Basic magic-byte validation
  if (modelType === 'glb') {
    // GLB magic bytes: 0x46546C67 ("glTF")
    if (buffer.length >= 4 && buffer.readUInt32LE(0) !== 0x46546C67) {
      // Could be JSON GLTF — check for opening brace
      const start = buffer.slice(0, 100).toString('utf8').trim();
      if (!start.startsWith('{') && !start.startsWith('\ufeff{')) {
        return jsonError('File does not appear to be a valid GLB or GLTF file.', 400, 'VALIDATION_ERROR');
      }
    }
  }
  if (modelType === 'ifc') {
    // IFC files start with "ISO-10303-21;"
    const header = buffer.slice(0, 20).toString('ascii');
    if (!header.includes('ISO-10303')) {
      return jsonError('File does not appear to be a valid IFC file (missing ISO-10303 header).', 400, 'VALIDATION_ERROR');
    }
  }

  // Store file
  await ensureDir();
  const modelId   = uuidv4();
  const storedExt = modelType === 'ifc' ? '.ifc' : ext || '.glb';
  const fileName  = `${modelId}${storedExt}`;
  const filePath  = path.join(MODEL_DIR, fileName);

  try {
    await fs.writeFile(filePath, buffer);
  } catch (err) {
    console.error('[BIM_UPLOAD] Write error:', err);
    return jsonError('Failed to store model file. Please try again.', 500, 'INTERNAL');
  }

  // Build the serve URL
  const modelUrl = `${APP_URL}/api/archionlabs/models?modelId=${modelId}&type=${modelType}`;

  await writeAuditLog('bim_model_uploaded', String(user.id), {
    targetId:   modelId,
    targetType: 'bim_model',
    details:    { fileName: file.name, modelType, sizeBytes: file.size },
  });

  console.info(`[BIM_UPLOAD] Model ${modelId} (${modelType}) uploaded by user ${user.id} — ${(file.size / 1024).toFixed(0)} KB`);

  return NextResponse.json(
    {
      modelId,
      modelUrl,
      modelType,
      fileName:  file.name,
      sizeBytes: file.size,
      message:   `${modelType.toUpperCase()} model uploaded successfully. Load it in the 3D viewer.`,
    },
    { status: 201 }
  );
}

// ── GET — Serve stored model file ─────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const modelId  = searchParams.get('modelId') ?? '';
  const typePram = searchParams.get('type') ?? 'glb';

  // Validate modelId is a UUID (prevent path traversal)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(modelId)) {
    return jsonError('Invalid model ID.', 400, 'BAD_REQUEST');
  }

  const storedExt = typePram === 'ifc' ? '.ifc' : '.glb';
  const filePath  = path.join(MODEL_DIR, `${modelId}${storedExt}`);

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch {
    return jsonError('Model not found or has expired.', 404, 'NOT_FOUND');
  }

  const mimeType = typePram === 'ifc'
    ? 'application/x-step'
    : 'model/gltf-binary';

  return new NextResponse(new Uint8Array(buffer), {
    status:  200,
    headers: {
      'Content-Type':        mimeType,
      'Content-Length':      String(buffer.length),
      'Cache-Control':       'private, max-age=3600',
      'Content-Disposition': `inline; filename="${modelId}${storedExt}"`,
      // Allow Three.js to load cross-origin in the same app
      'Access-Control-Allow-Origin': APP_URL || '*',
    },
  });
}
