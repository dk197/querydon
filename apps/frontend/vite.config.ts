import react from "@vitejs/plugin-react";
import { defaultClientConditions, defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	resolve: {
		// Resolve workspace packages (e.g. @querydon/shared) to their TypeScript sources
		conditions: ["source", ...defaultClientConditions],
	},
	server: {
		proxy: {
			"/api": "http://localhost:3000",
		},
	},
});
