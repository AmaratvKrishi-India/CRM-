import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    '@storybook/addon-a11y',
    '@storybook/addon-viewport',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  staticDirs: ['../public'],
  viteFinal: async (config) => {
    return {
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve?.alias,
          '@': '/src',
          '@components': '/src/components',
          '@services': '/src/services',
          '@context': '/src/context',
          '@db': '/src/db',
          '@utils': '/src/utils',
          '@types': '/src/types',
        },
      },
    };
  },
  // Lost Pixel integration
  lostPixel: {
    // Custom configuration for Lost Pixel
    project: 'amaratvkrishi-sales-crm',
    customShots: [
      {
        name: 'Button - Primary',
        path: '/iframe.html?id=components-button--primary',
        waitFor: '[data-testid="button-primary"]',
        viewports: ['mobile', 'desktop'],
      },
      {
        name: 'Button - Secondary',
        path: '/iframe.html?id=components-button--secondary',
        waitFor: '[data-testid="button-secondary"]',
        viewports: ['mobile', 'desktop'],
      },
      {
        name: 'Button - Disabled',
        path: '/iframe.html?id=components-button--disabled',
        waitFor: '[data-testid="button-disabled"]',
        viewports: ['mobile', 'desktop'],
      },
      {
        name: 'Input - Default',
        path: '/iframe.html?id=components-input--default',
        waitFor: '[data-testid="input-default"]',
        viewports: ['mobile', 'desktop'],
      },
      {
        name: 'Input - Error',
        path: '/iframe.html?id=components-input--error',
        waitFor: '[data-testid="input-error"]',
        viewports: ['mobile', 'desktop'],
      },
      {
        name: 'Card - Lead',
        path: '/iframe.html?id=components-leadcard--default',
        waitFor: '[data-testid="lead-card"]',
        viewports: ['mobile', 'desktop'],
      },
      {
        name: 'Card - Call Record',
        path: '/iframe.html?id=components-callrecordcard--default',
        waitFor: '[data-testid="call-record-card"]',
        viewports: ['mobile', 'desktop'],
      },
      {
        name: 'Modal - Confirm',
        path: '/iframe.html?id=components-modal--confirm',
        waitFor: '[data-testid="modal-confirm"]',
        viewports: ['mobile', 'desktop'],
      },
      {
        name: 'Table - Leads',
        path: '/iframe.html?id=components-leadstable--default',
        waitFor: '[data-testid="leads-table"]',
        viewports: ['desktop', 'desktop-lg'],
      },
      {
        name: 'Dashboard - Admin',
        path: '/iframe.html?id=pages-admin-dashboard--default',
        waitFor: '[data-testid="admin-dashboard"]',
        viewports: ['desktop', 'desktop-lg'],
      },
      {
        name: 'Dashboard - Agent',
        path: '/iframe.html?id=pages-agent-dashboard--default',
        waitFor: '[data-testid="agent-dashboard"]',
        viewports: ['mobile', 'tablet'],
      },
    ],
  },
};

export default config;