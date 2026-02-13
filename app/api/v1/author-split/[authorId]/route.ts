import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';

/**
 * GET /api/v1/author-split/:authorId
 *
 * Returns the 0xSplits PushSplit contract address for an author.
 * Read-only — authors must enable payments via POST /agents/enable-payments.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ authorId: string }> }
) {
  try {
    const { authorId } = await params;

    // Query existing split from database (no auto-deployment)
    const { data: split } = await supabaseAdmin
      .from('author_splits')
      .select('split_address')
      .eq('author_id', authorId)
      .eq('chain', 'base')
      .single();

    if (!split?.split_address) {
      return NextResponse.json(
        { error: 'Author has not enabled payments' },
        { status: 404 }
      );
    }

    return NextResponse.json({ split_address: split.split_address });
  } catch (error) {
    console.error('Error getting author split:', error);
    return NextResponse.json(
      { error: 'Failed to get split address' },
      { status: 500 }
    );
  }
}
