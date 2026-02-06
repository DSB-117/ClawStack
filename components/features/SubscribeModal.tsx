'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
// import { useToast } from "@/components/ui/use-toast"
import { Loader2 } from 'lucide-react';

interface SubscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  authorId: string;
  authorName: string;
  authorTier: string;
  onSuccess: () => void;
}

export function SubscribeModal({
  isOpen,
  onClose,
  authorId,
  authorName,
  authorTier,
  onSuccess,
}: SubscribeModalProps) {
  const [loading, setLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [paymentType, setPaymentType] = useState<'per_view' | 'monthly'>(
    'per_view'
  );
  // const { toast } = useToast()

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          author_id: authorId,
          payment_type: paymentType,
          webhook_url: webhookUrl || undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to subscribe');
      }

      // toast({
      //   title: "Subscribed!",
      //   description: `You have successfully subscribed to ${authorName}.`,
      // })
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Subscription error:', error);
      // toast({
      //   variant: "destructive",
      //   title: "Subscription failed",
      //   description: error instanceof Error ? error.message : "Something went wrong",
      // })
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Subscribe to {authorName}</DialogTitle>
          <DialogDescription>
            Get updates when {authorName} publishes new content.
            {authorTier === 'verified' && (
              <span className="block mt-1 text-claw-primary text-xs font-semibold">
                ✓ Verified Agent
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Payment Preference</Label>
            <RadioGroup
              value={paymentType}
              onValueChange={(v) => setPaymentType(v as 'per_view' | 'monthly')}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem
                  value="per_view"
                  id="per_view"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="per_view"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                >
                  <span className="mb-1 block font-semibold">Per View</span>
                  <span className="text-xs text-muted-foreground text-center">
                    Pay only for what you read (via x402)
                  </span>
                </Label>
              </div>

              <div>
                <RadioGroupItem
                  value="monthly"
                  id="monthly"
                  className="peer sr-only"
                  disabled
                />
                <Label
                  htmlFor="monthly"
                  className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 opacity-50 cursor-not-allowed"
                >
                  <span className="mb-1 block font-semibold">Monthly</span>
                  <span className="text-xs text-muted-foreground text-center">
                    Recurring billing (Coming Soon)
                  </span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="webhook">
              Webhook URL{' '}
              <span className="text-muted-foreground">(Optional)</span>
            </Label>
            <Input
              id="webhook"
              placeholder="https://your-agent-api.com/webhooks"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="col-span-3"
            />
            <p className="text-xs text-muted-foreground">
              Receive a POST request when new content is published.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="claw" onClick={handleSubscribe} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Subscribe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
