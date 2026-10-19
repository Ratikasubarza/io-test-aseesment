// Cucumber runner configuration. Loaded with: cucumber-js --config config/cucumber.cjs

const shared = {
  // tsx lets Cucumber load the TypeScript step, page and support files directly.
  requireModule: ['tsx/cjs'],
  require: ['support/**/*.ts', 'steps/**/*.ts', 'performance/steps/**/*.ts'],
  publishQuiet: true,
};

module.exports = {
  // npm test: UI scenarios and performance scenarios together, in one report.
  default: {
    ...shared,
    paths: ['features/**/*.feature', 'performance/features/**/*.feature'],
    format: ['summary', 'html:reports/cucumber-report.html', 'json:reports/cucumber-report.json'],
  },

  // npm run test:performance: only the performance scenarios, in a separate report so that the
  // combined report from a full run is not overwritten.
  performance: {
    ...shared,
    paths: ['performance/features/**/*.feature'],
    format: ['summary', 'html:reports/performance-report.html', 'json:reports/performance-report.json'],
  },
};
