// .cjs extension required — see babel.config.cjs for explanation.
module.exports = {
    testEnvironment: 'node',

    // Babel transforms ESM import/export → CommonJS require/exports so Jest's
    // module registry and jest.mock() hoisting work correctly.
    transform: {
        '^.+\\.js$': 'babel-jest',
    },

    // Only run files under __tests__/ ending in .test.js.
    testMatch: ['**/__tests__/**/*.test.js'],

    // Clear mock.calls / mock.instances between every test automatically,
    // without needing an explicit beforeEach(jest.clearAllMocks) in each file.
    clearMocks: true,
};
