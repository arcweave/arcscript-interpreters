import { defineConfig } from 'rolldown';

export default defineConfig({
  input: 'src/index.ts',
  platform: 'browser',
  output: [
    {
      file: 'dist/arcscript.cjs',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/arcscript.esm.js',
      format: 'esm',
      sourcemap: true,
    }
  ],
  tsconfig: true,
});