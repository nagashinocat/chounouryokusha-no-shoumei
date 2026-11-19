import { defineConfig } from 'vitest/config';
// ルールのテストは Firestore エミュレーターが要るので npm run test:rules で別に走らせる
const rules = process.env.RULES === '1';
export default defineConfig({ test: { include: rules ? ['tests/rules/**/*.test.js'] : ['tests/**/*.test.js'], exclude: rules ? [] : ['tests/rules/**', 'node_modules/**'], environment: 'node' } });
