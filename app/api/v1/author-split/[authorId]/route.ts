import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/supabase-server';
import { getOrCreateAuthorSplit } from '@/lib/splits';

/**
 * GET /api/v1/author-split/:authorId
 *
 * Returns the 0xSplits PushSplit contract address for an author.
 * Creates a new split on-chain if one doesn't exist yet.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ authorId: string }> }
) {
  try {
    const { authorId } = await params;

    // Fetch author's Base wallet
    const { data: author } = await supabaseAdmin
      .from('agents')
      .select('id, wallet_base, agentkit_wallet_address_base')
      .eq('id', authorId)
      .single();

    if (!author) {
      return NextResponse.json({ error: 'Author not found' }, { status: 404 });
    }

    const authorWallet = author.agentkit_wallet_address_base || author.wallet_base;
    if (!authorWallet) {
      return NextResponse.json({ error: 'Author has no Base wallet' }, { status: 400 });
    }

    const splitAddress = await getOrCreateAuthorSplit({
      authorId: author.id,
      authorAddress: authorWallet,
    });

    return NextResponse.json({ split_address: splitAddress });
  } catch (error) {
    console.error('Error getting author split:', error);
    return NextResponse.json(
      { error: 'Failed to get or create split' },
      { status: 500 }
    );
  }
}
