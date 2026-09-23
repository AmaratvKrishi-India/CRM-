module.exports = {
  src_folders: ['e2e/nightwatch'],
  test_settings: {
    default: {
      launch_url: 'http://127.0.0.1:4174',
      desiredCapabilities: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: ['--headless=new', '--no-sandbox', '--disable-gpu'],
        },
      },
      webdriver: {
        start_process: true,
        server_path: '',
        port: 9515,
      },
    },
  },
};
