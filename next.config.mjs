/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/exports/pptx-template": ["./public/templates/asab-designer-quote.pptx"],
    },
  },
  async headers() {
    return [
      {
        source: '/models/:path*.glb',
        headers: [
          { key: 'Content-Type', value: 'model/gltf-binary' },
        ],
      },
    ];
  },
};
export default nextConfig;
