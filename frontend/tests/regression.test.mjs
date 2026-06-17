import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';


const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = (...parts) => readFileSync(join(root, ...parts), 'utf8');

test('demo authentication cannot be enabled in production builds', () => {
  const authProvider = source('src', 'app', 'providers', 'AuthProvider.tsx');
  assert.match(authProvider, /import\.meta\.env\.DEV\s*&&\s*import\.meta\.env\.VITE_ENABLE_DEMO_AUTH\s*===\s*'true'/);
});

test('login and register pages do not expose fixed demo credentials', () => {
  const loginPage = source('src', 'pages', 'LoginPage.tsx');
  const registerPage = source('src', 'pages', 'RegisterPage.tsx');
  const visibleText = `${loginPage}\n${registerPage}`;

  assert.doesNotMatch(visibleText, /member123/);
  assert.doesNotMatch(visibleText, /admin\s*\/\s*admin/);
  assert.doesNotMatch(visibleText, /演示账号/);
  assert.doesNotMatch(visibleText, /LUMI-A1B2/);
});
