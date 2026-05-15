import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /** Évite que Next prenne `~/package-lock.json` comme racine sur l’hébergement OVH. */
  outputFileTracingRoot: appRoot,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.le-repasseur.fr",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "le-repasseur.fr",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
