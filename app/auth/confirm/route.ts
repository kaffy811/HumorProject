import type { NextRequest } from 'next/server';
import { finishAuth } from '@/lib/auth-callback';
export async function GET(request: NextRequest) { return finishAuth(request, 'email'); }
