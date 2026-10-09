import { defineConfig } from 'vite';
export default defineConfig({ build: { rollupOptions: { input: { home: 'index.html', lesson: 'aula.html', geography: 'geografia.html', scene: 'laboratorio.html', school: 'escola.html', worksheet: 'ficha.html', earthquakes: 'terremotos.html', quakeWorksheet: 'ficha-terremotos.html' } } } });
