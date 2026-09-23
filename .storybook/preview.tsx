import type { Preview } from '@storybook/react';
import React from 'react';
import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import '@/index.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light',
      values: [
        { name: 'light', value: '#ffffff' },
        { name: 'dark', value: '#1a1a1a' },
        { name: 'primary', value: '#16a34a' },
      ],
    },
    viewport: {
      viewports: {
        mobile: { name: 'Mobile', styles: { width: '390px', height: '844px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop', styles: { width: '1280px', height: '720px' } },
        'desktop-lg': { name: 'Desktop Large', styles: { width: '1920px', height: '1080px' } },
      },
    },
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'keyboard-focus-indicator', enabled: true },
        ],
      },
    },
    lostPixel: {
      skip: ['components-button--loading', 'components-skeleton--*'],
    },
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <AuthProvider>
          <div style={{ padding: '1rem' }}>
            <Story />
          </div>
        </AuthProvider>
      </ThemeProvider>
    ),
  ],
  globalTypes: {
    theme: {
      description: 'Global theme for components',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
  },
};

export default preview;
