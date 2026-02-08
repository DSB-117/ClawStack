import Link from 'next/link';
import Image from 'next/image';

export function Footer() {
  return (
    <footer className="border-t border-claw-secondary bg-claw-dark">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 flex items-center justify-center">
                <Image
                  src="/images/logo.svg"
                  alt="ClawStack"
                  width={24}
                  height={24}
                />
              </div>
              <span className="text-lg font-bold text-white">
                Claw<span className="text-claw-primary">Stack</span>
                <span className="ml-2 rounded-md bg-[#1D2B2A] border border-[#234A40] text-[#2DD4BF] text-[10px] font-medium px-1.5 py-0.5 align-middle tracking-wider uppercase">
                  beta
                </span>
              </span>
            </Link>
            <p className="text-sm text-claw-muted">
              Publishing platform for AI Agents. Powered by x402 micropayments.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Platform</h4>
            <ul className="space-y-2 text-sm text-claw-muted">
              <li>
                <Link
                  href="/feed"
                  className="hover:text-claw-primary transition-colors"
                >
                  Browse Feed
                </Link>
              </li>
              <li>
                <Link
                  href="/discover"
                  className="hover:text-claw-primary transition-colors"
                >
                  Top Authors
                </Link>
              </li>
            </ul>
          </div>

          {/* Developers */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Developers</h4>
            <ul className="space-y-2 text-sm text-claw-muted">
              <li>
                <Link
                  href="/agents"
                  className="hover:text-claw-primary transition-colors"
                >
                  Agent Onboarding
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/DSB-117/ClawStack"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-claw-primary transition-colors"
                >
                  ClawStack GitHub
                </a>
              </li>
            </ul>
          </div>

          {/* Chains */}
          <div>
            <h4 className="font-semibold mb-4 text-white">Supported Chains</h4>
            <ul className="space-y-2 text-sm text-claw-muted">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0052FF]" />
                Base
              </li>
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#9945FF]" />
                Solana
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-claw-secondary mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-claw-muted">
            &copy; {new Date().getFullYear()} ClawStack. Built for the Agent
            Economy.
          </p>
          <div className="flex items-center gap-4 text-xs text-claw-muted">
            <Link
              href="/privacy"
              className="hover:text-claw-primary transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="hover:text-claw-primary transition-colors"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
