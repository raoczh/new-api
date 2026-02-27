# 七牛云 CDN 快速配置指南

## 方案选择

### 方案 1：自动上传（推荐）
- ✅ 一次配置，后续自动上传
- ✅ 适合频繁更新的项目
- ❌ 需要安装插件

### 方案 2：手动上传
- ✅ 无需额外插件
- ✅ 更可控
- ❌ 每次构建后需手动上传

---

## 前置准备（两种方案都需要）

### 1. 注册七牛云并创建存储空间

1. 访问 https://portal.qiniu.com/signup 注册账号
2. 完成实名认证（需要身份证）
3. 进入「对象存储」→「空间管理」→「新建空间」
   - 空间名称：`new-api-static`
   - 存储区域：**华东-浙江**
   - 访问控制：**公开**

### 2. 获取 CDN 域名

进入刚创建的空间 → 「域名管理」：

**选项 A：使用自己的域名（推荐）**
1. 点击「绑定域名」
2. 输入子域名，如：`cdn.yourdomain.com`
3. 到你的域名 DNS 管理处添加 CNAME 记录：
   ```
   记录类型：CNAME
   主机记录：cdn
   记录值：（七牛提供的 CNAME 地址）
   ```
4. 等待 DNS 生效（5-30 分钟）

**选项 B：使用七牛测试域名**
- 七牛会自动分配一个测试域名
- 格式：`http://xxxxx.bkt.clouddn.com`
- 有效期 30 天，仅供测试

**记录下你的 CDN 域名，后面要用！**

### 3. 获取密钥（仅方案 1 需要）

1. 点击右上角头像 → 「密钥管理」
2. 复制 **AccessKey** 和 **SecretKey**

---

## 方案 1：自动上传配置

### 步骤 1：安装插件

```bash
cd d:/TestWorkSpace/new-api/web
yarn add -D vite-plugin-qiniu-oss
```

### 步骤 2：配置环境变量

编辑 `web/.env.production` 文件，填入你的七牛云信息：

```bash
QINIU_ACCESS_KEY=你的AccessKey
QINIU_SECRET_KEY=你的SecretKey
QINIU_BUCKET=new-api-static
QINIU_DOMAIN=https://你的CDN域名
```

**示例：**
```bash
QINIU_ACCESS_KEY=abcdefghijklmnopqrstuvwxyz123456
QINIU_SECRET_KEY=1234567890abcdefghijklmnopqrstuvwxyz1234
QINIU_BUCKET=new-api-static
QINIU_DOMAIN=https://cdn.yourdomain.com
```

**重要：** 不要将 `.env.production` 提交到 Git！已自动添加到 `.gitignore`。

### 步骤 3：构建并部署

```bash
# 1. 构建前端（自动上传到七牛云）
cd d:/TestWorkSpace/new-api/web
yarn build

# 2. 构建 Docker 镜像
cd ..
docker buildx build --platform linux/amd64 -t raoczh/new-api:custom-cdn-01 --load .

# 3. 推送镜像
docker push raoczh/new-api:custom-cdn-01
```

### 步骤 4：在宝塔面板更新

修改容器编排中的镜像版本为 `raoczh/new-api:custom-cdn-01`，重启容器。

---

## 方案 2：手动上传配置

### 步骤 1：下载 qshell 工具

1. 访问：https://developer.qiniu.com/kodo/1302/qshell
2. 下载 `qshell-windows-x64.exe`
3. 重命名为 `qshell.exe`，放到系统 PATH 或项目目录

### 步骤 2：配置 qshell

```bash
qshell account <你的AccessKey> <你的SecretKey> default
```

### 步骤 3：修改 vite.config.js

编辑 `web/vite.config.js`，找到第 135 行左右的 `base` 配置，改为：

```js
base: 'https://你的CDN域名/assets/',
```

**示例：**
```js
base: 'https://cdn.yourdomain.com/assets/',
```

### 步骤 4：构建、上传、部署

```bash
# 1. 构建前端
cd d:/TestWorkSpace/new-api/web
yarn build

# 2. 上传到七牛云
cd dist
qshell qupload2 --src-dir=./assets --bucket=new-api-static --key-prefix=assets/ --overwrite

# 3. 返回项目根目录，构建 Docker 镜像
cd ../..
docker buildx build --platform linux/amd64 -t raoczh/new-api:custom-cdn-01 --load .

# 4. 推送镜像
docker push raoczh/new-api:custom-cdn-01
```

### 步骤 5：在宝塔面板更新

修改容器编排中的镜像版本为 `raoczh/new-api:custom-cdn-01`，重启容器。

---

## 验证 CDN 是否生效

1. 打开网站，按 **F12** 打开开发者工具
2. 切换到 **Network** 标签
3. 刷新页面
4. 查看 JS/CSS 文件的请求地址：

**✅ 正确（CDN 生效）：**
```
https://cdn.yourdomain.com/assets/index-xxx.js
https://cdn.yourdomain.com/assets/icons-xxx.js
```

**❌ 错误（未使用 CDN）：**
```
https://你的网站域名/assets/index-xxx.js
```

5. 查看加载时间：
   - **使用 CDN 前**：800KB 文件加载 1 分钟
   - **使用 CDN 后**：800KB 文件加载 2-5 秒

---

## 禁用 CDN（回退）

如果想回退到不使用 CDN：

**方案 1（自动上传）：**
- 删除或注释掉 `web/.env.production` 中的所有配置
- 重新构建

**方案 2（手动上传）：**
- 修改 `vite.config.js` 中的 `base` 为 `'/'`
- 重新构建

---

## 成本说明

### 免费额度（每月）
- 存储空间：10GB
- CDN 流量：10GB
- HTTP 请求：100 万次

### 超出后价格
- 存储：0.148 元/GB/月
- CDN 流量：0.29 元/GB
- HTTP 请求：0.01 元/万次

### 估算
假设你的网站：
- 静态资源总大小：50MB
- 每天访问量：1000 次
- 每月流量：50MB × 1000 × 30 = 1.5TB = 1500GB

**成本：**
- 存储：0.05GB × 0.148 = 0.007 元/月（可忽略）
- CDN 流量：(1500GB - 10GB 免费) × 0.29 = 432 元/月

**优化建议：**
- 启用浏览器缓存（已配置），回访用户不消耗流量
- 实际流量会远小于理论值（约 20-30%）
- 对于个人项目，免费额度通常足够

---

## 常见问题

### Q1：构建时提示 "vite-plugin-qiniu-oss not found"
**A：** 确保已安装插件：
```bash
cd web
yarn add -D vite-plugin-qiniu-oss
```

### Q2：上传失败，提示 "Access Key 错误"
**A：** 检查 `.env.production` 中的 AccessKey 和 SecretKey 是否正确。

### Q3：CDN 域名访问提示 404
**A：**
1. 确认文件已上传到七牛云（登录七牛云控制台查看）
2. 确认 CDN 域名配置正确
3. 检查 `base` 配置是否以 `/assets/` 结尾

### Q4：部署后仍然很慢
**A：**
1. 打开 F12 Network 查看文件是否从 CDN 加载
2. 如果不是，检查 `base` 配置
3. 如果是，可能是 CDN 节点未预热，多刷新几次

### Q5：如何更新 CDN 上的文件？
**A：**
- **方案 1**：重新 `yarn build` 即可自动覆盖
- **方案 2**：重新执行 `qshell qupload2` 命令，加上 `--overwrite` 参数

---

## 技术支持

- 七牛云文档：https://developer.qiniu.com/kodo
- qshell 工具文档：https://developer.qiniu.com/kodo/1302/qshell
- 七牛云工单：https://support.qiniu.com/

---

## 总结

使用 CDN 后的效果对比：

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| 加载时间 | 1 分钟+ | 2-5 秒 |
| 传输路径 | 东京 → 国内 | 国内 CDN → 国内 |
| 带宽消耗 | 东京服务器 | 七牛云 CDN |
| 用户体验 | 极差 | 优秀 |

**推荐使用方案 1（自动上传）**，配置一次后，后续每次构建都会自动上传，无需手动操作。
