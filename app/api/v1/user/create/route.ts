import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { privyClient, verifyToken } from '@/lib/auth/privy-client';
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
    const { display_name, wallet_address, avatar_url } = body;

    // Validate inputs
    if (!display_name || typeof display_name !== 'string') {
        return NextResponse.json(
            createErrorResponse(ErrorCodes.INVALID_REQUEST_BODY, 'Invalid display name'),
            { status: 400 }
        );
    }

    // Insert user into Supabase using admin client (bypassing RLS)
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({
        privy_did: userId,
        display_name: display_name.trim(),
        wallet_address: wallet_address || null,
        avatar_url: avatar_url,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user in Supabase:', error);
      // Check for duplicate key error (e.g. user already exists)
      if (error.code === '23505') {
          return NextResponse.json(
              createErrorResponse(ErrorCodes.ALREADY_EXISTS, 'User already exists'),
              { status: 409 }
          );
      }
      return NextResponse.json(
        createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Failed to create user profile'),
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, user: data }, { status: 201 });

  } catch (error) {
    console.error('Unexpected error in user create route:', error);
    return NextResponse.json(
      createErrorResponse(ErrorCodes.INTERNAL_ERROR, 'Internal server error'),
      { status: 500 }
    );
  }
}
