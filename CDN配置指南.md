# 七牛云 CDN 配置指南

## 第一步：注册并配置七牛云

1. 注册七牛云账号：https://portal.qiniu.com/signup
2. 完成实名认证
3. 创建存储空间：
   - 空间名称：`new-api-static`
   - 存储区域：华东-浙江（或离用户最近的区域）
   - 访问控制：公开
4. 绑定 CDN 域名（在空间的「域名管理」中）
5. 获取密钥：个人中心 → 密钥管理 → AccessKey 和 SecretKey

## 第二步：配置环境变量

编辑 `web/.env.production` 文件，填入你的七牛云配置：

```bash
QINIU_ACCESS_KEY=你的AccessKey
QINIU_SECRET_KEY=你的SecretKey
QINIU_BUCKET=new-api-static
QINIU_DOMAIN=https://你的CDN域名.com
```

**重要：** 不要将 `.env.production` 提交到 Git！

## 第三步：安装依赖并构建

```bash
cd web
yarn add -D vite-plugin-qiniu-oss
yarn build
```

构建完成后，静态资源会自动上传到七牛云 CDN。

## 第四步：构建 Docker 镜像

```bash
cd ..
docker buildx build --platform linux/amd64 -t raoczh/new-api:custom-cdn-01 --load .
docker push raoczh/new-api:custom-cdn-01
```

## 第五步：部署

在宝塔面板的容器编排中，更新镜像版本为 `custom-cdn-01`。

## 验证

部署后，打开浏览器开发者工具 Network 面板，检查 JS/CSS 文件是否从 CDN 域名加载。

## 禁用 CDN（回退到直接加载）

如果不想使用 CDN，只需注释掉 `.env.production` 中的所有配置，重新构建即可。

## 成本估算

- 免费额度：10GB 存储 + 10GB CDN 流量/月
- 超出后：存储 0.148元/GB/月，CDN 流量 0.29元/GB
- 对于个人项目，免费额度通常足够
