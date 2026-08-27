import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
	plugins: [react()],
	publicDir: 'Data_Photo',
	server: {
		port: 5173,
	},
});