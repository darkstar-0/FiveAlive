# Five Alive - Cypress Test Suite

This directory contains comprehensive Cypress tests for the Five Alive High Jump Competition Management application.

## Test Structure

### Test Files

1. **01-basic-functionality.cy.js**
   - UI Elements & Navigation
   - Athlete Management (add, delete, update)
   - Height Configuration
   - Phase Management
   - Help Modal
   - Event Independence (girls vs boys)
   - Meet Information

2. **02-full-e2e.cy.js**
   - Complete Girls Competition Workflow (setup → checkin → competition → results)
   - Boys Competition with Event Isolation
   - Check-in with Starting Height Selection
   - CSV & PDF Export
   - End Competition Confirmation
   - Gender-Specific Messages
   - Starting Height Fallback (uses first attempted height)
   - Phase State Isolation Between Events

3. **03-ui-ux-features.cy.js**
   - Button States & Accessibility
   - Check Out Button Disabled States
   - End Competition Modal Confirmation
   - Lower Bar Feature (hidden but configured)
   - Toast Notifications
   - Results Display (Live Scoresheet vs Final Results)
   - Status Bar
   - Floating Timer

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
# Install Cypress
npm install --save-dev cypress

# Install all dependencies (already in package.json)
npm install
```

## Running Tests

### Open Cypress Test Runner (Interactive Mode)

```bash
npm run test:open
```

This opens the Cypress UI where you can:
- View all test files
- Run individual tests
- Debug with browser dev tools
- Watch tests as they run

### Run All Tests (Headless Mode)

```bash
npm run test
```

Or with explicit headless flag:

```bash
npm run test:headless
```

### Run Specific Test File

```bash
npx cypress run --spec "cypress/e2e/01-basic-functionality.cy.js"
```

### Run Tests for Specific Feature

```bash
# Basic functionality only
npx cypress run --spec "cypress/e2e/01-basic-functionality.cy.js"

# Full E2E workflow
npx cypress run --spec "cypress/e2e/02-full-e2e.cy.js"

# UI/UX features
npx cypress run --spec "cypress/e2e/03-ui-ux-features.cy.js"
```

## Starting a Local Server

The tests expect the app to be running at `http://localhost:8000`. You need to serve the HTML files locally:

### Option 1: Using Python (Simple HTTP Server)

```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

### Option 2: Using Node.js http-server

```bash
npm install -g http-server
http-server -p 8000
```

### Option 3: Using VS Code Live Server Extension

- Install the Live Server extension
- Right-click `index.html` → "Open with Live Server"
- Update `baseUrl` in `cypress.config.js` if using different port

## Custom Commands

The test suite includes custom Cypress commands defined in `cypress/support/commands.js`:

- `cy.addAthlete(name, school)` - Add an athlete to the roster
- `cy.switchEvent(event)` - Switch between 'girls' and 'boys' events
- `cy.proceedToCheckin()` - Transition from setup to check-in phase
- `cy.checkInAllAthletes()` - Check in all athletes at once
- `cy.startCompetition()` - Begin the competition
- `cy.recordJump(result)` - Record a jump (make/miss/pass)
- `cy.setHeights(startHeight, increment, count)` - Configure bar heights

## Test Coverage

### Features Tested

✅ **Multi-Event Management**
- Girls and Boys events with independent state
- Separate athlete rosters per event
- Phase isolation (setup → checkin → competition → results)

✅ **Athlete Management**
- Add/remove athletes
- Bulk operations (check-in all, etc.)
- Starting height declaration

✅ **Competition Flow**
- Height configuration (metric/imperial)
- Check-in process with height selection
- Live jumping with attempt recording
- Athlete check-out/check-in during competition

✅ **Results & Exports**
- Live scoreboard during competition
- Final results display
- CSV export
- PDF export
- Starting height fallback (first attempted height)

✅ **UI/UX**
- Gender-specific messages and confirmations
- Button states and accessibility
- Modal dialogs for confirmations
- Status bar and statistics
- Floating timer
- Toast notifications

✅ **Error Prevention**
- Disabled buttons when unavailable
- Confirmations for destructive actions
- Hidden but preserved features (Lower Bar)

## Debugging Tests

### View Test Logs

```bash
npm run test:open
```

Then use the Cypress UI to:
- Step through tests
- Inspect elements
- View network requests
- Check console logs

### Debug in Browser

```bash
npm run test:open
```

- Pause tests with `.pause()` in test code
- Use browser dev tools (F12)
- Inspect DOM and styles
- Check JavaScript console

### Increase Timeout (if needed)

```javascript
// In test code
cy.get('#element', { timeout: 10000 }).click();
```

## CI/CD Integration

To run tests in CI/CD pipeline:

```bash
# Run all tests headless
npm run test

# With specific exit code on failure
npx cypress run --exit
```

### GitHub Actions Example

```yaml
name: Cypress Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test
```

## Known Limitations

1. Tests require local server running on port 8000
2. PDF/CSV exports can't be directly tested (browser download restrictions)
3. Audio timer beep can't be tested in headless mode

## Future Test Improvements

- [ ] Add visual regression testing
- [ ] Test PDF/CSV content with file system access
- [ ] Add performance benchmarks
- [ ] Test on mobile viewport sizes
- [ ] Add accessibility audits
- [ ] Test with actual PDF import
- [ ] Add data persistence tests

## Support

For issues or questions about tests:
1. Check test output in Cypress UI
2. Review test code comments
3. Check browser console in Cypress debugger
4. Verify local server is running on correct port
