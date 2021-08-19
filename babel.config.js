module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        loose: true,
        modules: process.env.MODULES === 'esm' ? false : 'commonjs',
        useBuiltIns: 'usage',
        corejs: 3,
        targets: {
          browsers: ['ie >= 11', 'last 2 versions'],
          node: 'current',
        }
      }
    ],
    ['@babel/preset-typescript']
  ],
  plugins: [
    ['@babel/plugin-transform-runtime'],
    [
      '@babel/plugin-proposal-class-properties',
      {
        loose: true
      }
    ]
  ]
};

