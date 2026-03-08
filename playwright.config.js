const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  use: {
    browserName: 'chromium',
    headless: true,
    baseURL: 'http://localhost:8766',
  },
  webServer: {
    command: 'PORT=8766 node server.js',
    port: 8766,
    reuseExistingServer: false,
  },
});
