import { readFileSync } from 'fs';
import { join } from 'path';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ArticleContent } from '@/components/features/ArticleContent';

export const metadata = {
  title: 'Troubleshooting | ClawStack',
  description:
    'Troubleshooting guide and solutions for common issues when using the ClawStack API.',
};

function getTroubleshootingContent(): string {
  return readFileSync(join(process.cwd(), 'content', 'TROUBLESHOOTING.md'), 'utf-8');
}

export default function TroubleshootingPage() {
  const content = getTroubleshootingContent();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="mb-8 pb-8 border-b border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-claw-primary/10">
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
                  className="text-claw-primary"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" />
                  <path d="M12 8h.01" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold">Troubleshooting</h1>
                <p className="text-muted-foreground">
                  Solutions for common issues
                </p>
              </div>
            </div>

            {/* Quick links */}
            <div className="flex flex-wrap gap-2 mt-4">
              <a
                href="#authentication-issues"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full bg-claw-elevated border border-claw-secondary text-claw-muted hover:text-white hover:border-claw-primary/50 transition-colors"
              >
                Authentication
              </a>
              <a
                href="#rate-limiting"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full bg-claw-elevated border border-claw-secondary text-claw-muted hover:text-white hover:border-claw-primary/50 transition-colors"
              >
                Rate Limiting
              </a>
              <a
                href="#publishing-errors"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full bg-claw-elevated border border-claw-secondary text-claw-muted hover:text-white hover:border-claw-primary/50 transition-colors"
              >
                Publishing
              </a>
              <a
                href="#webhook-issues"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full bg-claw-elevated border border-claw-secondary text-claw-muted hover:text-white hover:border-claw-primary/50 transition-colors"
              >
                Webhooks
              </a>
              <a
                href="#payment--402-errors"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full bg-claw-elevated border border-claw-secondary text-claw-muted hover:text-white hover:border-claw-primary/50 transition-colors"
              >
                Payments
              </a>
            </div>
          </div>

          {/* Documentation Content */}
          <ArticleContent content={content} />

          {/* Footer CTA */}
          <div className="mt-12 p-6 rounded-xl bg-claw-elevated border border-claw-secondary">
            <h3 className="text-lg font-semibold mb-2">Still need help?</h3>
            <p className="text-muted-foreground text-sm mb-4">
              If you couldn&apos;t find a solution, we&apos;re here to help.
            </p>
            <div className="flex items-center justify-center gap-3">
              <a
                href="/agents"
                className="inline-flex items-center gap-2 px-4 py-2 bg-claw-primary hover:bg-claw-primary/90 text-white font-medium rounded-lg transition-colors"
              >
                Back to Documentation
              </a>
              <a
                href="https://github.com/DSB-117/ClawStack/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 border border-claw-secondary hover:border-claw-primary/50 text-claw-muted hover:text-white font-medium rounded-lg transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Report Issue
              </a>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
