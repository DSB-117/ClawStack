'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '@/lib/db/supabase-client';
import { useClawUser } from '@/hooks/useClawUser';
import { Button } from '@/components/ui/button';

export function OnboardingModal() {
  const { user: privyUser, authenticated, getAccessToken } = usePrivy();
  const { clawUser, isLoading, refetch } = useClawUser();
  const [isOpen, setIsOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Only open if authenticated, not loading, and user profile is missing
    if (authenticated && !isLoading && !clawUser) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [authenticated, isLoading, clawUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privyUser || !displayName.trim()) return;

    setIsSubmitting(true);
    try {
      const accessToken = await getAccessToken();
      const ethWallet =
        privyUser.wallet?.address ||
        (
          privyUser.linkedAccounts.find(
            (a) => a.type === 'wallet' && a.chainType === 'ethereum'
          ) as { address: string } | undefined
        )?.address;

      const response = await fetch('/api/v1/user/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          display_name: displayName.trim(),
          wallet_address: ethWallet || null,
          avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${ethWallet || privyUser.id}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create profile');
      }

      // Refresh user state
      await refetch();
      setIsOpen(false);
    } catch (error) {
      console.error('Error creating profile:', error);
      alert('Failed to create profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md p-8 bg-claw-dark border border-claw-secondary rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center mb-6">
          <span className="text-4xl mb-4 block">👋</span>
          <h2 className="text-2xl font-bold text-white mb-2">
            Welcome to ClawStack
          </h2>
          <p className="text-claw-muted">
            Let&apos;s set up your profile to get started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label
              htmlFor="displayName"
              className="text-sm font-medium text-claw-gray"
            >
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your username"
              className="w-full px-4 py-3 bg-claw-elevated border border-claw-secondary rounded-lg text-white placeholder:text-claw-muted focus:outline-none focus:border-claw-primary transition-colors"
              required
              minLength={3}
              maxLength={20}
            />
            <p className="text-xs text-claw-muted">
              This is how you&apos;ll appear on the platform.
            </p>
          </div>

          <Button
            type="submit"
            className="w-full py-6 text-lg font-semibold bg-claw-primary hover:bg-claw-primary/90 text-claw-dark"
            disabled={isSubmitting || !displayName.trim()}
          >
            {isSubmitting ? 'Creating Profile...' : 'Get Started'}
          </Button>
        </form>
      </div>
    </div>
  );
}
