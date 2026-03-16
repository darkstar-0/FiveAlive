describe('Five Alive - UI/UX Features', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  describe('Button States & Accessibility', () => {
    it('should disable Check Out button when no active jumpers', () => {
      // Add athlete but don't start competition
      cy.addAthlete('Test Athlete', 'Test School');
      cy.get('#startM').type('1.50');
      cy.proceedToCheckin();
      cy.checkInAllAthletes();
      cy.startCompetition();

      // Check out the athlete - should disable button when no one is jumping
      cy.get('#bCO').click();
      
      // Now there are no active jumpers - button should be disabled
      cy.get('#bCO').should('be.disabled');
    });

    it('should show disabled state for Check Out button visually', () => {
      cy.addAthlete('Test Athlete', 'Test School');
      cy.get('#startM').type('1.50');
      cy.proceedToCheckin();
      cy.checkInAllAthletes();
      cy.startCompetition();

      cy.get('#bCO').click();
      
      // Verify disabled styling
      cy.get('#bCO').should('be.disabled');
      cy.get('#bCO').should('have.css', 'opacity');
    });

    it('should show End Competition modal confirmation', () => {
      cy.addAthlete('Test Athlete', 'Test School');
      cy.get('#startM').type('1.50');
      cy.proceedToCheckin();
      cy.checkInAllAthletes();
      cy.startCompetition();

      cy.get('#bMake').click();
      cy.get('#bMake').click();

      // Click end button
      cy.get('#hdrEndComp').click();

      // Modal should appear
      cy.get('#endCompModal').should('have.class', 'open');
      cy.get('#endCompTitle').should('be.visible');
      cy.get('#endCompBody').should('be.visible');
    });

    it('should show gender-specific end competition confirmation', () => {
      cy.addAthlete('Girl Athlete', 'School A');
      cy.get('#startM').type('1.50');
      cy.proceedToCheckin();
      cy.checkInAllAthletes();
      cy.startCompetition();

      cy.get('#bMake').click();
      cy.get('#bMake').click();

      cy.get('#hdrEndComp').click();

      // Should contain "Girls"
      cy.get('#endCompTitle').should('contain', 'Girls');
      cy.get('#endCompBody').should('contain', 'girls');
    });
  });

  describe('Lower Bar Feature (Hidden)', () => {
    it('should hide Lower Bar button', () => {
      cy.addAthlete('Test Athlete', 'Test School');
      cy.get('#startM').type('1.50');
      cy.proceedToCheckin();
      cy.checkInAllAthletes();
      cy.startCompetition();

      // Lower Bar button should be hidden
      cy.get('button').contains('Lower Bar').should('not.be.visible');
    });

    it('should still have Lower Bar confirmation modal configured', () => {
      // Even though hidden, the modal should exist in DOM
      cy.get('#lowerBarModal').should('exist');
    });
  });

  describe('Toast Notifications', () => {
    it('should show toast when starting competition', () => {
      cy.addAthlete('Test Athlete', 'Test School');
      cy.get('#startM').type('1.50');
      cy.proceedToCheckin();
      cy.checkInAllAthletes();

      cy.startCompetition();

      // Toast should appear with competition info
      cy.get('.toast').should('be.visible');
    });

    it('should show gender-specific competition started message', () => {
      cy.addAthlete('Girl Athlete', 'School A');
      cy.get('#startM').type('1.50');
      cy.proceedToCheckin();
      cy.checkInAllAthletes();

      cy.startCompetition();

      cy.get('.toast').should('contain', 'Girls');
    });
  });

  describe('Results Display', () => {
    it('should show gender-specific results title', () => {
      cy.addAthlete('Test Athlete', 'Test School');
      cy.get('#startM').type('1.50');
      cy.proceedToCheckin();
      cy.checkInAllAthletes();
      cy.startCompetition();

      cy.get('#bMake').click();
      cy.get('#bMake').click();

      cy.get('button').contains('Full Results →').click();

      // Title should contain "Girls"
      cy.get('#resPanelTitle').should('contain', 'Girls');
    });

    it('should display results metadata with meet info', () => {
      cy.get('#meetName').type('Spring Meet');
      cy.get('#meetDate').type('2024-03-15');

      cy.addAthlete('Test Athlete', 'Test School');
      cy.get('#startM').type('1.50');
      cy.proceedToCheckin();
      cy.checkInAllAthletes();
      cy.startCompetition();

      cy.get('#bMake').click();
      cy.get('#bMake').click();

      cy.get('button').contains('Full Results →').click();

      // Metadata should show meet name and date
      cy.get('#rMeta').should('contain', 'Spring Meet');
      cy.get('#rMeta').should('contain', '2024-03-15');
    });

    it('should show Live Scoresheet before competition ends', () => {
      cy.addAthlete('Test Athlete', 'Test School');
      cy.get('#startM').type('1.50');
      cy.proceedToCheckin();
      cy.checkInAllAthletes();
      cy.startCompetition();

      cy.get('button').contains('Full Results →').click();

      // Should say "Live Scoresheet" not "Final Results"
      cy.get('#resPanelTitle').should('contain', 'Live Scoresheet');
      cy.get('#resPanelTitle').should('not.contain', 'Final Results');
    });

    it('should show Final Results after competition ends', () => {
      cy.addAthlete('Test Athlete', 'Test School');
      cy.get('#startM').type('1.50');
      cy.proceedToCheckin();
      cy.checkInAllAthletes();
      cy.startCompetition();

      cy.get('#bMake').click();
      cy.get('#bMake').click();

      // Complete banner should appear
      cy.get('.comp-over-banner').should('be.visible');
      cy.get('#hdrEndComp').click();
      cy.get('button').contains('End').last().click();

      // Now should say "Final Results"
      cy.get('#resPanelTitle').should('contain', 'Final Results');
    });

    it('should show Competition Ended banner', () => {
      cy.addAthlete('Test Athlete', 'Test School');
      cy.get('#startM').type('1.50');
      cy.proceedToCheckin();
      cy.checkInAllAthletes();
      cy.startCompetition();

      cy.get('#bMake').click();
      cy.get('#bMake').click();

      cy.get('#hdrEndComp').click();
      cy.get('button').contains('End').last().click();

      // Should show ended banner with gender-specific text
      cy.get('#compEndedBanner').should('be.visible');
      cy.get('#compEndedText').should('contain', 'Girls');
    });

    it('should hide back button when competition is ended', () => {
      cy.addAthlete('Test Athlete', 'Test School');
      cy.get('#startM').type('1.50');
      cy.proceedToCheckin();
      cy.checkInAllAthletes();
      cy.startCompetition();

      cy.get('#bMake').click();
      cy.get('#bMake').click();

      // Before end: button should be visible
      cy.get('button').contains('Full Results →').click();
      cy.get('#backToCompBtn').should('be.visible');

      // After end: button should be hidden
      cy.get('#hdrEndComp').click();
      cy.get('button').contains('End').last().click();
      cy.get('#backToCompBtn').should('not.be.visible');
    });
  });

  describe('Status Bar', () => {
    it('should display status bar during competition', () => {
      cy.addAthlete('Test Athlete', 'Test School');
      cy.get('#startM').type('1.50');
      cy.proceedToCheckin();
      cy.checkInAllAthletes();
      cy.startCompetition();

      cy.get('.status-bar').should('be.visible');
      cy.get('#stA').should('be.visible'); // Active count
      cy.get('#stCO').should('be.visible'); // Checked out count
      cy.get('#stH').should('be.visible'); // Current height
      cy.get('#stR').should('be.visible'); // Remaining
    });

    it('should update active athlete count', () => {
      cy.addAthlete('Athlete 1', 'School A');
      cy.addAthlete('Athlete 2', 'School B');
      cy.get('#startM').type('1.50');
      cy.proceedToCheckin();
      cy.checkInAllAthletes();
      cy.startCompetition();

      // Should show 2 active
      cy.get('#stA').should('contain', '2');
    });
  });

  describe('Timer', () => {
    it('should display floating timer', () => {
      cy.get('#timerFab').should('be.visible');
      cy.get('#timerBubble').should('be.visible');
    });

    it('should start and stop timer', () => {
      cy.get('#timerBubble').click();
      cy.get('#timerPresets').should('have.class', 'open');

      cy.get('.tpreset').first().click();

      // Timer should be running
      cy.get('#timerDisplay').should('not.contain', 'TIMER');
    });
  });
});
