describe('Smoke: Home', () => {
  it('loads the app and shows title', () => {
    cy.visit('/')
    cy.title().should('eq', 'ShotSpot')
    cy.get('#root').should('exist')
  })
})
