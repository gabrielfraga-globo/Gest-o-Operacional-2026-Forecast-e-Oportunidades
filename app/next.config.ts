import type { NextConfig } from "next";

const cabecalhosBase = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// HSTS só em produção: em desenvolvimento o servidor roda em http.
const cabecalhoHsts = { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" };

const nextConfig: NextConfig = {
  async headers() {
    const cabecalhos =
      process.env.NODE_ENV === "production" ? [...cabecalhosBase, cabecalhoHsts] : cabecalhosBase;
    return [{ source: "/:path*", headers: cabecalhos }];
  },
};

export default nextConfig;
