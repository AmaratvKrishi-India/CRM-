describe('local CRM smoke', () => {
  it('loads the local login shell', () => {
    cy.visit('/');
    cy.get('#login-email').should('be.visible');
    cy.get('#login-password').should('be.visible');
    cy.contains('button', 'Sign In').should('be.visible');
  });
});
