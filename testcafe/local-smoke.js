import { Selector } from 'testcafe';

fixture('Local CRM smoke').page('http://127.0.0.1:4174');

test('loads the local login shell', async (t) => {
  await t
    .expect(Selector('#login-email').visible).ok()
    .expect(Selector('#login-password').visible).ok()
    .expect(Selector('button').withText('Sign In').visible).ok();
});
