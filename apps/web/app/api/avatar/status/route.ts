import { avatarRequest } from '@/server/avatar/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = (req: Request) => avatarRequest(req, 'status');
