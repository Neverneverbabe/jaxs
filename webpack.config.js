import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  entry: './app/index.jsx',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    module: true,
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  devServer: {
    static: {
      directory: path.join(__dirname, 'app'),
    },
  },
  experiments: {
    outputModule: true,
  },
  externalsType: 'module',
  externals: {
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js': 'module https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js': 'module https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js': 'module https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'
  },
};
