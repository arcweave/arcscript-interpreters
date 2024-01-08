/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-extraneous-dependencies */
import path from 'path';
import ESLintWebpackPlugin from 'eslint-webpack-plugin';
import { fileURLToPath } from 'url';
import webpack from 'webpack';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
  {
    mode: 'production',
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: `arcscript.cjs`,
      chunkFormat: 'commonjs',
      library: {
        type: 'commonjs',
      },
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          use: ['babel-loader'],
        },
      ],
    },
    resolve: {
      extensions: ['.js'],
    },
    target: 'web',
    plugins: [
      new ESLintWebpackPlugin(),
      new webpack.ProvidePlugin({ process: 'process/browser.js' }),
    ],
    devtool: 'source-map',
  },
  {
    mode: 'production',
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: `arcscript.mjs`,
      chunkFormat: 'module',
      library: {
        type: 'module',
      },
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: ['babel-loader'],
        },
      ],
    },
    performance: {
      maxAssetSize: 512000,
      maxEntrypointSize: 512000,
    },
    resolve: {
      extensions: ['.js'],
      fallback: {
        fs: false,
      },
    },
    target: 'web',
    plugins: [
      new ESLintWebpackPlugin(),
      new webpack.ProvidePlugin({ process: 'process/browser.js' }),
    ],
    devtool: 'source-map',
    experiments: {
      outputModule: true,
    },
  },
];
