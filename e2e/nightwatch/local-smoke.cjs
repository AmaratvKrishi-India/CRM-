module.exports = {
  'loads the local login shell': function (browser) {
    browser
      .url('http://127.0.0.1:4174')
      .waitForElementVisible('#login-email', 10000)
      .assert.visible('#login-password')
      .assert.visible('button')
      .end();
  },
};
