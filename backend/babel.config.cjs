// .cjs extension required — package.json has "type": "module", so any .js file
// in this directory is treated as ESM. Babel and Jest config must use .cjs to
// be loaded as CommonJS by the tools that require them.
module.exports = {
    presets: [
        [
            '@babel/preset-env',
            {
                // Target the running Node version so Babel only transforms what
                // the current Node can't handle natively (mainly ESM → CJS for Jest).
                targets: { node: 'current' },
            },
        ],
    ],
};
