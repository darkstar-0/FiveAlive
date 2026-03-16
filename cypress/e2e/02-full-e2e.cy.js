describe('Five Alive - Complete E2E Competition Workflow', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.get('#meetName').type('Spring Championship');
    cy.get('#meetDate').type('2024-03-15');
  });

  it('should complete a full girls competition workflow', () => {
    // SETUP PHASE
    // Add athletes
    cy.addAthlete('Jane Smith', 'Thunder Ridge');
    cy.addAthlete('Sarah Johnson', 'Ponderosa');
    cy.addAthlete('Emma Davis', 'Mountain View');
    cy.get('#badgeGirls').should('contain', '3');

    // Configure heights
    cy.get('#startM').type('1.50');
    cy.get('#numHeights').clear().type('8');
    cy.get('#heightPreview').should('be.visible');

    // Verify setup panel is visible
    cy.get('#setup-panel').should('be.visible');

    // Proceed to check-in
    cy.proceedToCheckin();

    // CHECK-IN PHASE
    // Verify check-in panel is now visible
    cy.get('#checkin-panel').should('be.visible');
    cy.get('.checkin-stats').should('be.visible');

    // Check in all athletes
    cy.checkInAllAthletes();
    cy.get('#ciCheckedIn').should('contain', '3');

    // Start competition
    cy.startCompetition();

    // COMPETITION PHASE
    // Verify competition panel
    cy.get('#competition-panel').should('be.visible');
    cy.get('.jumper-card').should('be.visible');
    cy.get('#barDisplay').should('not.contain', '—');

    // Record some jumps
    cy.get('#bMake').click(); // Athlete 1 makes first height
    cy.get('.jumper-card').should('be.visible');

    cy.get('#bMake').click(); // Athlete 2 makes first height
    cy.get('#bMake').click(); // Athlete 3 makes first height

    // Record some misses
    cy.get('#bMiss').click(); // Athlete 1, attempt 2
    cy.get('#bMiss').click(); // Athlete 1, attempt 3
    cy.get('#bPass').click();  // Athlete 1, pass - done at this height

    // Verify scoring table
    cy.get('.score-table').should('be.visible');
    cy.get('.score-table tbody tr').should('have.length.at.least', 1);

    // Check out an athlete
    cy.get('#bCO').click();
    cy.get('.jumper-card').should('contain', 'OUT');

    // View live scoresheet
    cy.get('button').contains('Full Results →').click();
    cy.get('#results-panel').should('be.visible');
    cy.get('.res-table').should('be.visible');

    // Return to competition
    cy.get('#backToCompBtn').click();
    cy.get('#competition-panel').should('be.visible');
  });

  it('should complete boys competition and verify event isolation', () => {
    // Setup girls event
    cy.addAthlete('Jane Smith', 'Thunder Ridge');
    cy.addAthlete('Sarah Johnson', 'Ponderosa');
    cy.get('#startM').type('1.50');
    cy.proceedToCheckin();
    cy.checkInAllAthletes();
    cy.startCompetition();

    // Quick competition: make some heights
    cy.get('#bMake').click();
    cy.get('#bMake').click();

    // Verify girls event shows event-specific text
    cy.get('#hdrEndComp').should('be.visible');

    // Switch to boys event
    cy.switchEvent('boys');

    // SETUP PHASE - Boys should have empty roster
    cy.get('#athleteBody tr').should('have.length', 0);
    cy.get('#setup-panel').should('be.visible');

    // Add boys athletes
    cy.addAthlete('John Doe', 'Mountain High');
    cy.addAthlete('Mike Johnson', 'Valley School');
    cy.get('#badgeBoys').should('contain', '2');

    // Configure heights for boys
    cy.get('#startM').type('1.55');
    cy.proceedToCheckin();

    // CHECK-IN PHASE - Boys
    cy.get('#checkin-panel').should('be.visible');
    cy.checkInAllAthletes();

    // START COMPETITION - Boys
    cy.startCompetition();

    // COMPETITION PHASE - Boys
    cy.get('#competition-panel').should('be.visible');
    cy.get('#bMake').click();

    // Switch back to girls - should show results
    cy.switchEvent('girls');
    cy.get('#results-panel').should('be.visible');

    // Verify girls results are visible
    cy.get('.res-table').should('be.visible');
  });

  it('should handle check-in with starting height selection', () => {
    // Add athletes
    cy.addAthlete('Test Athlete 1', 'School A');
    cy.addAthlete('Test Athlete 2', 'School B');

    // Setup heights
    cy.get('#startM').type('1.50');
    cy.proceedToCheckin();

    // Open first athlete's check-in modal
    cy.get('.ci-card').first().click();

    // Modal should appear
    cy.get('#ciModal').should('have.class', 'open');
    cy.get('.ci-modal').should('be.visible');

    // Confirm check-in
    cy.get('button').contains('✓ Check In').click();

    // Modal should close
    cy.get('#ciModal').should('not.have.class', 'open');
  });

  it('should export results as CSV', () => {
    // Setup and start competition
    cy.addAthlete('Jane Smith', 'Thunder Ridge');
    cy.addAthlete('Sarah Johnson', 'Ponderosa');
    cy.get('#startM').type('1.50');
    cy.proceedToCheckin();
    cy.checkInAllAthletes();
    cy.startCompetition();

    // Record some jumps
    cy.get('#bMake').click();
    cy.get('#bMake').click();
    cy.get('#bMake').click();

    // Navigate to results
    cy.get('button').contains('Full Results →').click();

    // Verify export buttons
    cy.get('button').contains('⬇ Export PDF').should('be.visible');
    cy.get('button').contains('⬇ Export CSV').should('be.visible');
  });

  it('should confirm end competition action', () => {
    // Setup quick competition
    cy.addAthlete('Test Athlete', 'Test School');
    cy.get('#startM').type('1.50');
    cy.proceedToCheckin();
    cy.checkInAllAthletes();
    cy.startCompetition();

    // Complete single athlete
    cy.get('#bMake').click();
    cy.get('#bMake').click();
    cy.get('#bMake').click();

    // Competition should be over - verify banner appears
    cy.get('.comp-over-banner').should('be.visible');
    cy.get('.comp-over-banner').should('contain', 'Competition Complete');

    // Click end button
    cy.get('button').contains('End').click();

    // Confirmation modal should appear
    cy.get('#endCompModal').should('have.class', 'open');
    cy.get('.modal-title').should('contain', 'End');

    // Cancel and verify modal closes
    cy.get('button').contains('Cancel').click();
    cy.get('#endCompModal').should('not.have.class', 'open');

    // Click end button again
    cy.get('button').contains('End').click();

    // Confirm end competition
    cy.get('button').contains('End').last().click();

    // Should show results
    cy.get('#results-panel').should('be.visible');
    cy.get('#compEndedBanner').should('be.visible');
  });

  it('should display correct gender-specific messages', () => {
    // Add athlete and proceed
    cy.addAthlete('Test Athlete', 'Test School');
    cy.get('#startM').type('1.50');
    cy.proceedToCheckin();
    cy.checkInAllAthletes();
    cy.startCompetition();

    // Complete competition
    cy.get('#bMake').click();
    cy.get('#bMake').click();

    // Check that button shows girls-specific text
    cy.get('.comp-over-banner button').should('contain', 'Girls');

    // Switch to boys
    cy.switchEvent('boys');
    cy.addAthlete('Boy Athlete', 'Boy School');
    cy.get('#startM').type('1.55');
    cy.proceedToCheckin();
    cy.checkInAllAthletes();
    cy.startCompetition();

    // Complete boys competition
    cy.get('#bMake').click();

    // Check that button shows boys-specific text
    cy.get('.comp-over-banner button').should('contain', 'Boys');
  });

  it('should use first attempted height when starting height not declared', () => {
    // Add athletes
    cy.addAthlete('Jane Smith', 'Thunder Ridge');
    cy.get('#startM').clear(); // Remove declared starting height

    cy.proceedToCheckin();
    
    // Don't select starting height - athlete will enter at first height attempted
    cy.get('button').contains('Check In All').click();

    cy.startCompetition();

    // Record jump at first height
    cy.get('#bMake').click();

    // View results
    cy.get('button').contains('Full Results →').click();

    // Verify Start Ht column shows first attempted height
    cy.get('.res-table tbody tr').first().within(() => {
      // The "Start Ht" should be populated with first attempted height
      cy.get('td').eq(3).should('not.contain', '—');
    });
  });

  it('should maintain separate phase states between events', () => {
    // Girls: setup → checkin → competition → results
    cy.addAthlete('Girl Athlete', 'Girls School');
    cy.get('#startM').type('1.50');
    
    // Girls setup phase
    cy.get('#setup-panel').should('be.visible');
    
    cy.proceedToCheckin();
    // Girls checkin phase
    cy.get('#checkin-panel').should('be.visible');
    
    cy.checkInAllAthletes();
    cy.startCompetition();
    // Girls competition phase
    cy.get('#competition-panel').should('be.visible');
    
    cy.get('#bMake').click();
    cy.get('#bMake').click();

    // Girls results phase (when complete)
    cy.switchEvent('boys');
    
    // Boys should be at setup phase
    cy.get('#setup-panel').should('be.visible');
    cy.get('#checkin-panel').should('not.be.visible');
    
    cy.addAthlete('Boy Athlete', 'Boys School');
    cy.get('#startM').type('1.55');
    cy.proceedToCheckin();
    
    // Boys checkin phase
    cy.get('#checkin-panel').should('be.visible');
    cy.get('#setup-panel').should('not.be.visible');
    
    cy.checkInAllAthletes();
    cy.startCompetition();
    
    // Boys competition phase
    cy.get('#competition-panel').should('be.visible');
    
    // Switch back to girls - should stay at results
    cy.switchEvent('girls');
    cy.get('#results-panel').should('be.visible');
  });
});
