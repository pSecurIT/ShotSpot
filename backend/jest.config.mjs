/** @type {import('jest').Config} */
const config = {
  verbose: true,
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  setupFiles: ['./jest.setup.js'],
  testMatch: ['**/__tests__/**/*.js']
};

export default config;
