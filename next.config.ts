import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typedRoutes: true,
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [
      {
        // Required for SharedArrayBuffer, which the in-browser Whisper
        // fallback needs for WASM/WebGPU inference.
        source: '/:path*',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
        ],
      },
    ]
  },
}

export default nextConfig
