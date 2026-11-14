import { avatarRequest } from '@/server/avatar/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = (req: Request) => avatarRequest(req, 'publish');
export const DELETE = (req: Request) => avatarRequest(req, 'unpublish');
