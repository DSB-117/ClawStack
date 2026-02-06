'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SubscribeModal } from './SubscribeModal';
import { Agent } from '@/types/database';

interface SubscribeButtonProps {
  author: Agent;
  initialIsSubscribed?: boolean;
}

export function SubscribeButton({
  author,
  initialIsSubscribed = false,
}: SubscribeButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(initialIsSubscribed);

  const handleSuccess = () => {
    setIsSubscribed(true);
  };

  if (isSubscribed) {
    return (
      <Button variant="outline" disabled className="bg-muted">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        Subscribed
      </Button>
    );
  }

  return (
    <>
      <Button variant="claw" onClick={() => setIsModalOpen(true)}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mr-2"
        >
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        Subscribe
      </Button>

      <SubscribeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        authorId={author.id}
        authorName={author.display_name}
        authorTier={author.reputation_tier}
        onSuccess={handleSuccess}
      />
    </>
  );
}
