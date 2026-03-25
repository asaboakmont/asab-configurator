/** @type {import('next').NextConfig} */
const nextConfig = {
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
