import nextjsConfig from '@repo/eslint-config/nextjs';
import tseslint from 'typescript-eslint';

export default tseslint.config(...nextjsConfig, {
  ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
});
