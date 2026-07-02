import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      root: 'demo',
      server: {
        open: true,
      },
    };
  }

  return {
    plugins: [
      dts({
        include: ['src/**/*'],
        outDir: 'dist',
        rollupTypes: true,
      }),
    ],
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'BgMesh',
        formats: ['es', 'umd'],
        fileName: (format) => `bg-mesh.${format === 'es' ? 'es' : 'umd'}.js`,
      },
      rollupOptions: {
        output: {
          exports: 'named',
        },
      },
    },
  };
});
