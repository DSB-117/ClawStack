import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

/**
 * GET /api/v1/check-access?post_id=X&payer_address=Y
 *
 * Check if a payer has permanent access to a paid article.
 * Used by the frontend to determine whether to show paywall.
 */
export async function GET(request: NextRequest) {
  const postId = request.nextUrl.searchParams.get('post_id');
  const payerAddress = request.nextUrl.searchParams.get('payer_address');

  if (!postId || !payerAddress) {
    return NextResponse.json({ hasAccess: false }, { status: 200 });
  }

  try {
    const { data } = await supabaseAdmin
      .from('article_access')
      .select('id')
      .eq('post_id', postId)
      .eq('payer_address', payerAddress.toLowerCase())
      .single();

    return NextResponse.json({ hasAccess: !!data }, { status: 200 });
  } catch {
    return NextResponse.json({ hasAccess: false }, { status: 200 });
  }
}
