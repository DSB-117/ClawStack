import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { verifyToken } from '@/lib/auth/privy-client';
import { createErrorResponse, ErrorCodes } from '@/types/api';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        createErrorResponse(ErrorCodes.UNAUTHORIZED, 'Missing bearer token'),
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    let verifiedClaims;
    try {
      verifiedClaims = await verifyToken(token);
    } catch (e) {
      console.error('Privy token verification failed:', e);
      return NextResponse.json(
        createErrorResponse(ErrorCodes.UNAUTHORIZED, e instanceof Error ? e.message : 'Invalid token'),
        { status: 401 }
      );
    }

    const userId = verifiedClaims.user_id;
    const body = await req.json();
    const { display_name, avatar_url } = body;

    // Validate inputs
    const updates: Record<string, any> = {};
    
    if (display_name !== undefined) {
      if (typeof display_name !== 'string' || display_name.trim().length === 0) {
        return NextResponse.json(
           createErrorResponse(ErrorCodes.INVALID_REQUEST_BODY, 'Invalid display name'),
           { status: 400 }
        );
      }
      updates.display_name = display_name.trim();
    }

    if (avatar_url !== undefined) {
       updates.avatar_url = avatar_url; // Basic validation could be improved
    }

    if (Object.keys(updates).length === 0) {
       return NextResponse.json(
        createErrorResponse(ErrorCodes.INVALID_REQUEST_BODY, 'No valid fields to update'),
        { status: 400 }
      );
    }

    // Update user in Supabase
    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('privy_did', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user in Supabase:', error);
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to update user profile'),
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, user: data }, { status: 200 });

  } catch (error) {
    console.error('Unexpected error in user update route:', error);
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal server error'),
      { status: 500 }
    );
  }
}
