'use client';

import {
  useState,
  useEffect,
  useCallback,
  createContext,
  useContext,
} from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useWalletBalances } from '@/hooks/useWalletBalances';

// --- Context ---
interface ProfileModalContextType {
  isOpen: boolean;
  openProfile: () => void;
  closeProfile: () => void;
}

const ProfileModalContext = createContext<ProfileModalContextType | null>(null);

export function useProfileModal() {
  const context = useContext(ProfileModalContext);
  if (!context) {
    throw new Error(
      'useProfileModal must be used within a ProfileModalProvider'
    );
  }
  return context;
}

export function ProfileModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const openProfile = useCallback(() => setIsOpen(true), []);
  const closeProfile = useCallback(() => setIsOpen(false), []);

  return (
    <ProfileModalContext.Provider value={{ isOpen, openProfile, closeProfile }}>
      {children}
      <ProfileModal isOpen={isOpen} onClose={closeProfile} />
    </ProfileModalContext.Provider>
  );
}

// --- Component ---
interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'account' | 'wallet' | 'subscriptions' | 'history';

function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, logout } = usePrivy();
  const [activeTab, setActiveTab] = useState<Tab>('account');

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl mx-4 bg-claw-dark border border-claw-secondary rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-claw-secondary flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-claw-secondary overflow-hidden">
              {/* Avatar Placeholder */}
              <Image
                src={
                  user?.wallet?.address
                    ? `https://api.dicebear.com/7.x/bottts/svg?seed=${user.wallet.address}`
                    : 'https://api.dicebear.com/7.x/bottts/svg?seed=human'
                }
                alt="Avatar"
                width={48}
                height={48}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {user?.email?.address ||
                  user?.wallet?.address?.slice(0, 6) + '...' ||
                  'Human'}
              </h2>
              <p className="text-sm text-claw-muted">User Profile</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-claw-muted hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-claw-secondary px-6 overflow-x-auto">
          <TabButton
            active={activeTab === 'account'}
            onClick={() => setActiveTab('account')}
          >
            Account Info
          </TabButton>
          <TabButton
            active={activeTab === 'wallet'}
            onClick={() => setActiveTab('wallet')}
          >
            Wallet & Balances
          </TabButton>
          <TabButton
            active={activeTab === 'subscriptions'}
            onClick={() => setActiveTab('subscriptions')}
          >
            Subscriptions
          </TabButton>
          <TabButton
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
          >
            History
          </TabButton>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'account' && <AccountTab />}
          {activeTab === 'wallet' && <WalletTab />}
          {activeTab === 'subscriptions' && <SubscriptionsTab />}
          {activeTab === 'history' && <HistoryTab />}
        </div>

        {/* Footer / Logout */}
        <div className="p-4 border-t border-claw-secondary bg-claw-elevated/50 rounded-b-xl flex justify-between items-center">
          <div className="text-xs text-claw-muted">
            Wallet: {user?.wallet?.address || 'Not connected'}
          </div>
          <Button
            variant="ghost"
            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
            onClick={() => {
              logout();
              onClose();
            }}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-3 text-sm font-medium border-b-2 transition-colors
        ${active ? 'border-claw-primary text-white' : 'border-transparent text-claw-muted hover:text-white'}
      `}
    >
      {children}
    </button>
  );
}

// --- Sub-Components (Placeholders for now) ---

function AccountTab() {
  const { user } = usePrivy();
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm text-claw-muted">Display Name</label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter display name"
            className="flex-1 bg-claw-elevated border border-claw-secondary rounded-md px-3 py-2 text-white"
            defaultValue={user?.email?.address?.split('@')[0] || ''}
          />
          <Button>Save</Button>
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm text-claw-muted">Connected Accounts</label>
        <div className="flex flex-col gap-2">
          {user?.google && (
            <div className="text-sm text-white">Google: Connected</div>
          )}
          {user?.twitter && (
            <div className="text-sm text-white">
              X (Twitter): {user.twitter.username}
            </div>
          )}
          {user?.github && (
            <div className="text-sm text-white">
              GitHub: {user.github.username}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WalletTab() {
  const { balances, isLoading, refetch } = useWalletBalances();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Balances</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={refetch}
          disabled={isLoading}
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Base */}
        <div className="p-4 bg-claw-elevated/50 rounded-lg border border-claw-secondary">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="font-medium text-white">Base</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-claw-muted">ETH</span>
              <span className="text-white font-mono">{balances.eth}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-claw-muted">USDC</span>
              <span className="text-white font-mono">{balances.usdcBase}</span>
            </div>
          </div>
        </div>

        {/* Solana */}
        <div className="p-4 bg-claw-elevated/50 rounded-lg border border-claw-secondary">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
            <span className="font-medium text-white">Solana</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-claw-muted">SOL</span>
              <span className="text-white font-mono">{balances.sol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-claw-muted">USDC</span>
              <span className="text-white font-mono">{balances.usdcSol}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs text-claw-muted mt-4">
        * Balances are fetched directly from RPC nodes.
      </div>
    </div>
  );
}

function SubscriptionsTab() {
  return (
    <div className="text-center py-10 text-claw-muted">
      <p>No active subscriptions.</p>
      <p className="text-xs mt-2">Subscribe to agents to see them here.</p>
    </div>
  );
}

function HistoryTab() {
  return (
    <div className="text-center py-10 text-claw-muted">
      <p>No payment history available.</p>
    </div>
  );
}
