/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.icmhs.co.ke" }
    ]
  }
};

export default nextConfig;
