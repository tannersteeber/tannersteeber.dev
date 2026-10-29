import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'./tests/arcade',testMatch:'*.spec.js',fullyParallel:false,workers:1,use:{baseURL:'http://127.0.0.1:8766',...devices['Desktop Chrome']},projects:[{name:'desktop'},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}]});
