// Cucumber configuration. Run via `tsx` so TypeScript step/support files load without a build step.
export default {
  import: ['test/support/**/*.ts', 'test/stepDefinitions/**/*.ts'],
  paths: ['test/features/**/*.feature']
};
