# 快速开始：5 分钟配置七牛云 CDN

## 准备工作（3 分钟）

### 1. 七牛云注册和配置

```
☐ 访问 https://portal.qiniu.com/signup 注册
☐ 完成实名认证
☐ 创建存储空间：
  - 名称：new-api-static
  - 区域：华东-浙江
  - 访问：公开
☐ 获取 CDN 域名（域名管理页面）
☐ 获取密钥（个人中心 → 密钥管理）
  - AccessKey: ___________________________
  - SecretKey: ___________________________
  - CDN 域名: ___________________________
```

### 2. 项目配置（2 分钟）

**选择方案：**
- [ ] 方案 1：自动上传（推荐）
- [ ] 方案 2：手动上传

---

## 方案 1：自动上传（推荐）

### 步骤 1：安装插件

```bash
cd d:/TestWorkSpace/new-api/web
yarn add -D vite-plugin-qiniu-oss
```

### 步骤 2：配置环境变量

编辑 `web/.env.production`，填入：

```bash
QINIU_ACCESS_KEY=你的AccessKey
QINIU_SECRET_KEY=你的SecretKey
QINIU_BUCKET=new-api-static
QINIU_DOMAIN=https://你的CDN域名
```

### 步骤 3：构建部署

```bash
# 构建（自动上传）
cd d:/TestWorkSpace/new-api/web
yarn build

# 构建镜像
cd ..
docker buildx build --platform linux/amd64 -t raoczh/new-api:custom-cdn-01 --load .
docker push raoczh/new-api:custom-cdn-01
```

### 步骤 4：宝塔面板更新

```
☐ 修改镜像版本为：raoczh/new-api:custom-cdn-01
☐ 重启容器
```

---

## 方案 2：手动上传

### 步骤 1：下载 qshell

```
☐ 访问 https://developer.qiniu.com/kodo/1302/qshell
☐ 下载 Windows 版本
☐ 重命名为 qshell.exe
```

### 步骤 2：配置 qshell

```bash
qshell account <AccessKey> <SecretKey> default
```

### 步骤 3：修改配置

编辑 `web/vite.config.js` 第 135 行：

```js
base: 'https://你的CDN域名/assets/',
```

### 步骤 4：构建上传部署

```bash
# 构建
cd d:/TestWorkSpace/new-api/web
yarn build

# 上传
cd dist
qshell qupload2 --src-dir=./assets --bucket=new-api-static --key-prefix=assets/ --overwrite

# 构建镜像
cd ../..
docker buildx build --platform linux/amd64 -t raoczh/new-api:custom-cdn-01 --load .
docker push raoczh/new-api:custom-cdn-01
```

### 步骤 5：宝塔面板更新

```
☐ 修改镜像版本为：raoczh/new-api:custom-cdn-01
☐ 重启容器
```

---

## 验证清单

```
☐ 打开网站，按 F12
☐ 切换到 Network 标签
☐ 刷新页面
☐ 检查 JS 文件 URL 是否包含 CDN 域名
☐ 检查加载时间是否从 1 分钟降到 2-5 秒
```

---

## 预期效果

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| index.js (800KB) | 60+ 秒 | 2-3 秒 |
| icons.js (950KB) | 60+ 秒 | 3-5 秒 |
| 总加载时间 | 1-2 分钟 | 5-10 秒 |

---

## 遇到问题？

查看完整文档：`七牛云CDN配置完整指南.md`

常见问题：
1. 上传失败 → 检查 AccessKey/SecretKey
2. 404 错误 → 检查 CDN 域名配置
3. 仍然很慢 → 检查 Network 面板确认是否使用 CDN
