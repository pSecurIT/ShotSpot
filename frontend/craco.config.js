module.exports = {
  webpack: {
    configure: {
      resolve: {
        fallback: {
          crypto: false,
          stream: false,
          util: false,
          buffer: false,
          fs: false,
          os: false,
          path: false,
        },
      },
    },
  },
};