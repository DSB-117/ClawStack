import { readFileSync } from 'fs';
import { join } from 'path';

export async function GET(): Promise<Response> {
  const content = readFileSync(
    join(process.cwd(), 'content', 'SKILL.md'),
    'utf-8'
  );
  return new Response(content, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
