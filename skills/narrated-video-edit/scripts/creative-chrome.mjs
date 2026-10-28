// Khởi Chrome cho các công cụ của lõi sáng tạo, không phụ thuộc common.mjs riêng của từng skill.
import { createRequire } from 'node:module';
import path from 'node:path';

export async function launchChrome() {
  let playwright;
  try { playwright = await import('playwright-core'); } catch {
    const fallback = process.env.PLAYWRIGHT_CORE;
    if (!fallback) throw new Error('Thiếu playwright-core. Chạy "npm install" trong thư mục scripts của skill, hoặc đặt PLAYWRIGHT_CORE trỏ tới thư mục chứa nó.');
    playwright = createRequire(path.join(fallback, 'package.json'))('playwright-core');
  }
  const { chromium } = playwright.chromium ? playwright : playwright.default;
  const executablePath = process.env.CHROME_PATH;
  return chromium.launch(executablePath ? { executablePath, headless: true } : { channel: 'chrome', headless: true });
}
