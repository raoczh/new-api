/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import fs from 'fs';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, transformWithEsbuild } from 'vite';
import pkg from '@douyinfe/vite-plugin-semi';
import { compression } from 'vite-plugin-compression2';
import path from 'path';
import { codeInspectorPlugin } from 'code-inspector-plugin';
import vitePluginQiniuOss from 'vite-plugin-qiniu-oss';
const { vitePluginSemi } = pkg;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载 .env.production 中的环境变量（传入 '' 前缀以加载非 VITE_ 开头的变量）
  const env = loadEnv(mode, process.cwd(), '');

  const enableQiniuUpload = !!env.QINIU_ACCESS_KEY;

  // vite-plugin-qiniu-oss 内部通过 require('.qiniu.config') 加载配置，
  // 但本项目 package.json 设置了 "type": "module"，.js 文件会被当作 ESM 处理，
  // 导致 CJS 语法的 .qiniu.config.js 无法被 require 加载。
  // 解决方案：动态写入 .qiniu.config.json（require 会自动尝试 .json 扩展名，无 CJS/ESM 冲突）
  if (enableQiniuUpload) {
    fs.writeFileSync(
      path.resolve(process.cwd(), '.qiniu.config.json'),
      JSON.stringify({
        accessKey: env.QINIU_ACCESS_KEY,
        secretKey: env.QINIU_SECRET_KEY,
        bucket: env.QINIU_BUCKET || 'new-api-static',
        bucketDomain: env.QINIU_DOMAIN,
        uploadPath: '/assets/',
        batch: 10,
        deltaUpdate: true,
        zone: env.QINIU_ZONE || 'Zone_as0',
      }),
    );
  }

  // 包装七牛云插件，防止上传失败导致构建崩溃
  function createSafeQiniuPlugin() {
    if (!enableQiniuUpload) return null;
    try {
      const plugin = vitePluginQiniuOss(true);
      if (!plugin) return null;
      const originalCloseBundle = plugin.closeBundle;
      return {
        ...plugin,
        async closeBundle() {
          try {
            await originalCloseBundle.call(this);
          } catch (e) {
            console.error(
              '\n[qiniu-oss] CDN 上传过程出错，但构建产物已正常生成。',
            );
            if (typeof e === 'object' && e !== null) {
              console.error(
                '[qiniu-oss] 错误详情:',
                JSON.stringify(e, null, 2),
              );
            } else {
              console.error('[qiniu-oss] 错误详情:', e);
            }
            console.error(
              '[qiniu-oss] 请检查 .env.production 中的七牛云配置（QINIU_ACCESS_KEY, QINIU_SECRET_KEY, QINIU_BUCKET, QINIU_DOMAIN）是否正确。\n',
            );
          }
        },
      };
    } catch (e) {
      console.error('[qiniu-oss] 插件初始化失败:', e.message);
      return null;
    }
  }

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@douyinfe/semi-ui/dist/css/semi.css': path.resolve(
          __dirname,
          './node_modules/@douyinfe/semi-ui/dist/css/semi.css',
        ),
      },
    },
    plugins: [
      codeInspectorPlugin({
        bundler: 'vite',
      }),
      {
        name: 'treat-js-files-as-jsx',
        async transform(code, id) {
          if (!/src\/.*\.js$/.test(id)) {
            return null;
          }

          // Use the exposed transform from vite, instead of directly
          // transforming with esbuild
          return transformWithEsbuild(code, id, {
            loader: 'jsx',
            jsx: 'automatic',
          });
        },
      },
      react(),
      vitePluginSemi({
        cssLayer: true,
      }),
      compression({
        algorithm: 'gzip',
        threshold: 1024,
        deleteOriginalAssets: false,
      }),
      compression({
        algorithm: 'brotliCompress',
        threshold: 1024,
        deleteOriginalAssets: false,
      }),
      // 七牛云 CDN 上传插件（仅在生产构建时启用）
      createSafeQiniuPlugin(),
    ].filter(Boolean),
    optimizeDeps: {
      force: true,
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
          '.json': 'json',
        },
      },
    },
    base: env.QINIU_DOMAIN ? `${env.QINIU_DOMAIN}/assets/` : '/',
    build: {
      rollupOptions: {
        // 使用公共 CDN 加载大型依赖（可选，需要配合 index.html 修改）
        // external: ['react', 'react-dom'],
        output: {
          manualChunks: {
            'react-core': ['react', 'react-dom', 'react-router-dom'],
            'semi-ui': ['@douyinfe/semi-icons', '@douyinfe/semi-ui'],
            tools: ['axios', 'history', 'marked'],
            'react-components': [
              'react-dropzone',
              'react-fireworks',
              'react-telegram-login',
              'react-toastify',
              'react-turnstile',
            ],
            i18n: [
              'i18next',
              'react-i18next',
              'i18next-browser-languagedetector',
            ],
            mermaid: ['mermaid'],
            vchart: [
              '@visactor/react-vchart',
              '@visactor/vchart',
              '@visactor/vchart-semi-theme',
            ],
            // 进一步拆分 icons，减小单个文件大小
            'icons-lucide': ['lucide-react'],
            'icons-lobehub': ['@lobehub/icons'],
            'icons-react': ['react-icons'],
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/mj': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/pg': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
