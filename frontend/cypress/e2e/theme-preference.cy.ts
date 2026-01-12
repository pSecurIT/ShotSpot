describe('Smoke: Theme preference', () => {
  it('can switch theme and persists across reload', () => {
    cy.visit('/profile', {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', 'cypress-token')
        win.localStorage.setItem(
          'user',
          JSON.stringify({
            id: 1,
            username: 'cypress',
            email: 'cypress@example.com',
            role: 'user',
          })
        )
        win.localStorage.removeItem('themePreference')
      },
    })

    cy.contains('My Profile').should('be.visible')

    cy.get('#themePreference').should('have.value', 'system')

    cy.get('#themePreference').select('dark')
    cy.get('html').should('have.attr', 'data-theme', 'dark')

    cy.window()
      .its('localStorage')
      .invoke('getItem', 'themePreference')
      .should('eq', 'dark')

    cy.reload()

    cy.get('html').should('have.attr', 'data-theme', 'dark')
    cy.get('#themePreference').should('have.value', 'dark')
  })
})
