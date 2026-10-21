import { state, json, failure } from '../../../server/cms';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Read published content only from this deployment's own database.

export async function GET() {
  try {
    return json(JSON.parse((await state()).published));
  } catch (error) {
    return failure(error);
  }
}
