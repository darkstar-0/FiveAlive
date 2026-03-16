describe('Five Alive - Basic Functionality Tests', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  describe('UI Elements & Navigation', () => {
    it('should load the page and display header', () => {
      cy.get('.logo').should('contain', 'FiveAlive');
      cy.get('.hdr-btns').should('be.visible');
    });

    it('should display event tabs after athletes are added', () => {
      cy.get('#eventTabs').should('have.css', 'display', 'none');
      cy.addAthlete('Jane Smith', 'Thunder Ridge');
      cy.get('#eventTabs').should('not.have.css', 'display', 'none');
    });

    it('should switch between Girls and Boys events', () => {
      cy.addAthlete('Jane Smith', 'Thunder Ridge');
      cy.switchEvent('boys');
      cy.get('#tabBoys').should('have.class', 'active');
      cy.switchEvent('girls');
      cy.get('#tabGirls').should('have.class', 'active');
    });

    it('should display setup panel on initial load', () => {
      cy.get('#setup-panel').should('be.visible');
      cy.get('#checkin-panel').should('not.be.visible');
      cy.get('#competition-panel').should('not.be.visible');
    });
  });

  describe('Athlete Management', () => {
    it('should add a single athlete', () => {
      cy.addAthlete('John Doe', 'Ponderosa');
      cy.get('#athleteBody tr').should('have.length', 1);
      cy.get('#athleteBody').should('contain', 'John Doe');
      cy.get('#athleteBody').should('contain', 'Ponderosa');
    });

    it('should add multiple athletes', () => {
      cy.addAthlete('Athlete One', 'School A');
      cy.addAthlete('Athlete Two', 'School B');
      cy.addAthlete('Athlete Three', 'School C');
      cy.get('#athleteBody tr').should('have.length', 3);
    });

    it('should delete an athlete', () => {
      cy.addAthlete('Delete Me', 'Test School');
      cy.get('#athleteBody tr').first().find('button').click();
      cy.get('#athleteBody tr').should('have.length', 0);
    });

    it('should update event badge count', () => {
      cy.addAthlete('Athlete One', 'School A');
      cy.addAthlete('Athlete Two', 'School B');
      cy.get('#badgeGirls').should('contain', '2');
    });
  });

  describe('Height Configuration', () => {
    it('should set starting height', () => {
      cy.get('#startM').type('1.53');
      cy.get('#startM').should('have.value', '1.53');
    });

    it('should display height preview', () => {
      cy.get('#startM').type('1.53');
      cy.get('#heightPreview').should('contain', '1.53');
    });

    it('should switch between metric and imperial units', () => {
      cy.get('#unitMetric').click();
      cy.get('#unitMetric').should('have.class', 'active');
      cy.get('#unitImperial').click();
      cy.get('#unitImperial').should('have.class', 'active');
    });

    it('should set number of heights to pre-load', () => {
      cy.get('#numHeights').clear().type('10');
      cy.get('#numHeights').should('have.value', '10');
    });
  });

  describe('Phase Management', () => {
    it('should initialize event with setup phase', () => {
      cy.addAthlete('Test Athlete', 'Test School');
      cy.get('#setup-panel').should('be.visible');
    });

    it('should transition from setup to check-in', () => {
      cy.addAthlete('Test Athlete', 'Test School');
      cy.proceedToCheckin();
      cy.get('#checkin-panel').should('be.visible');
      cy.get('#setup-panel').should('not.be.visible');
    });

    it('should not allow proceeding to check-in without athletes', () => {
      cy.get('button').contains('Proceed to Check-In').click();
      cy.get('#setup-panel').should('be.visible');
    });
  });

  describe('Help Modal', () => {
    it('should open and close help modal', () => {
      cy.get('button').contains('? Help').click();
      cy.get('#helpModal').should('have.class', 'open');
      cy.get('#helpModal .modal-title').should('contain', 'How to Use Five Alive');
    });

    it('should have multiple help tabs', () => {
      cy.get('button').contains('? Help').click();
      cy.get('.help-tabs').children().should('have.length.at.least', 5);
    });

    it('should switch between help tabs', () => {
      cy.get('button').contains('? Help').click();
      cy.get('.htab').contains('Import & Setup').click();
      cy.get('#tab-import').should('have.class', 'active');
    });
  });

  describe('Event Independence', () => {
    it('should maintain separate athlete rosters for girls and boys', () => {
      // Add athlete to girls
      cy.addAthlete('Jane Smith', 'Thunder Ridge');
      cy.get('#athleteBody tr').should('have.length', 1);
      
      // Switch to boys
      cy.switchEvent('boys');
      cy.get('#athleteBody tr').should('have.length', 0);
      
      // Add athlete to boys
      cy.addAthlete('John Doe', 'Ponderosa');
      cy.get('#athleteBody tr').should('have.length', 1);
      
      // Switch back to girls
      cy.switchEvent('girls');
      cy.get('#athleteBody tr').should('have.length', 1);
      cy.get('#athleteBody').should('contain', 'Jane Smith');
    });
  });

  describe('Meet Information', () => {
    it('should set meet name', () => {
      cy.get('#meetName').type('Spring Championship');
      cy.get('#meetName').should('have.value', 'Spring Championship');
    });

    it('should set meet date', () => {
      cy.get('#meetDate').type('2024-03-15');
      cy.get('#meetDate').should('have.value', '2024-03-15');
    });
  });
});
