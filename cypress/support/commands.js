// Support file for custom commands and utilities

// Custom command to add an athlete
Cypress.Commands.add('addAthlete', (name, school) => {
  cy.get('.add-btn').first().click();
  cy.get('#athleteBody tr').last().within(() => {
    cy.get('input[data-f="name"]').type(name);
    cy.get('input[data-f="school"]').type(school);
  });
});

// Custom command to switch events
Cypress.Commands.add('switchEvent', (event) => {
  if (event === 'girls') {
    cy.get('#tabGirls').click();
  } else if (event === 'boys') {
    cy.get('#tabBoys').click();
  }
});

// Custom command to proceed to check-in
Cypress.Commands.add('proceedToCheckin', () => {
  cy.get('button').contains('Proceed to Check-In').click();
  cy.get('#checkin-panel').should('be.visible');
});

// Custom command to check in all athletes
Cypress.Commands.add('checkInAllAthletes', () => {
  cy.get('button').contains('Check In All').click();
});

// Custom command to start competition
Cypress.Commands.add('startCompetition', () => {
  cy.get('#startCompBtn').click();
  cy.get('#competition-panel').should('be.visible');
});

// Custom command to record a jump result
Cypress.Commands.add('recordJump', (result) => {
  if (result === 'make') {
    cy.get('#bMake').click();
  } else if (result === 'miss') {
    cy.get('#bMiss').click();
  } else if (result === 'pass') {
    cy.get('#bPass').click();
  }
});

// Custom command to set heights
Cypress.Commands.add('setHeights', (startHeight, increment, count) => {
  cy.get('#startM').clear().type(startHeight);
  cy.get('.inc-chips button').first().click(); // Select first increment option
  cy.get('#numHeights').clear().type(count);
});
