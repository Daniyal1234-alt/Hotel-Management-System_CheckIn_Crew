// jest.config.js
module.exports = {
  collectCoverageFrom: [
    "**/*.js",                    // Collect all JS files...
    "!**/node_modules/**",         // except node_modules
    "!**/coverage/**",             // except coverage folders
    "!jest.config.js",             // except jest config
    "!betterServer.js",            // except betterServer.js
    "!start.js"                    // except start.js
  ],
  testEnvironment: "node",
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  verbose: true
};
