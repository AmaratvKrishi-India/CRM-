import { defineConfig } from '@playwright/test';
import base from '../playwright.config';
export default defineConfig({...base, testDir: '../e2e', globalSetup: undefined, projects:[{name:'chromium',use:{...base.projects![0].use,launchOptions:{executablePath:'/usr/bin/chromium',args:['--no-sandbox']}}}],use:{...base.use,video:'off',baseURL:'http://127.0.0.1:4174'},webServer:undefined});
