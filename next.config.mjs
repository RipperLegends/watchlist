/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    dirs: ["app", "components", "lib", "types"]
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org"
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com"
      }
    ]
  }
};

export default nextConfig;
