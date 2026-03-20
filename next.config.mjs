import path from 'node:path';
import { fileURLToPath } from 'node:url';

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  turbopack: {
    root: configDir,
  },
};

export default nextConfig;
