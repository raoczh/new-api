# 列表分页大小修改说明

## 修改概述

将所有列表的默认每页条数从 10/20 改为 100，以提升用户体验和操作效率。

## 修改范围

### 前端修改 (18个文件)

#### 1. 常量文件
- `web/src/constants/common.constant.js`
  - `ITEMS_PER_PAGE: 10 → 100`
- `web/src/constants/channel.constants.js`
  - `MODEL_TABLE_PAGE_SIZE: 10 → 100`
- `web/src/constants/dashboard.constants.js`
  - `PAGE_SIZE: 20 → 100`
  - `MODEL_TABLE_PAGE_SIZE: 10 → 100`

#### 2. Hooks 文件
- `web/src/hooks/model-pricing/useModelPricingData.jsx`
- `web/src/hooks/subscriptions/useSubscriptionsData.jsx`

#### 3. 组件文件
- `web/src/components/settings/ChannelSelectorModal.jsx`
- `web/src/components/table/channels/modals/MultiKeyManageModal.jsx`
- `web/src/components/table/users/modals/UserSubscriptionsModal.jsx`
- `web/src/components/topup/modals/TopupHistoryModal.jsx`

#### 4. 页面文件
- `web/src/pages/Setting/Chat/SettingsChats.jsx`
- `web/src/pages/Setting/Dashboard/SettingsAPIInfo.jsx`
- `web/src/pages/Setting/Dashboard/SettingsAnnouncements.jsx`
- `web/src/pages/Setting/Dashboard/SettingsFAQ.jsx`
- `web/src/pages/Setting/Dashboard/SettingsUptimeKuma.jsx`
- `web/src/pages/Setting/Ratio/ModelRationNotSetEditor.jsx`
- `web/src/pages/Setting/Ratio/ModelSettingsVisualEditor.jsx`
- `web/src/pages/Setting/Ratio/UpstreamRatioSync.jsx`

### 后端修改 (1个文件)

- `common/constants.go`
  - `ItemsPerPage: 10 → 100`

## 影响的功能列表

以下列表的默认分页大小已修改为 100：

1. **管理功能**
   - 渠道管理列表
   - 令牌管理列表
   - 用户管理列表
   - 模型管理列表

2. **定价和部署**
   - 模型定价列表
   - 模型部署列表

3. **日志功能**
   - 使用日志列表
   - 任务日志列表
   - MJ日志列表

4. **其他功能**
   - 兑换码列表
   - 订阅管理列表
   - 聊天配置列表

5. **仪表板**
   - API信息列表
   - 公告列表
   - FAQ列表
   - Uptime监控列表

6. **比率设置**
   - 模型比率编辑器
   - 上游比率同步

## 技术细节

### 前端配置
- **默认值**: 100
- **可选项**: [10, 20, 50, 100]
- **用户可自定义**: 是
- **持久化**: localStorage

### 后端配置
- **默认值**: 100
- **最大限制**: 100 (在 `common/page_info.go` 中定义)
- **前后端一致性**: 已保证

### 兼容性
- `pageSizeOptions` 保持不变
- 用户之前的分页设置会被保留
- localStorage 中的 `page-size` 设置优先级更高

## 用户体验改进

1. **减少翻页次数**: 默认显示更多数据，减少用户翻页操作
2. **保持灵活性**: 用户仍可通过下拉菜单选择其他分页大小
3. **记忆功能**: 系统会记住用户的分页选择

## 性能考虑

### 优势
- 减少API请求次数
- 提升操作效率
- 更好的数据浏览体验

### 注意事项
1. 首次加载时间可能略有增加
2. 建议监控大数据量场景的性能
3. 关注后端API响应时间

## 测试建议

1. **功能测试**
   - 验证所有列表的默认分页为100
   - 测试分页切换功能
   - 验证localStorage记忆功能

2. **性能测试**
   - 测试大数据量场景（1000+条记录）
   - 监控首次加载时间
   - 检查内存占用情况

3. **兼容性测试**
   - 测试不同浏览器
   - 验证移动端显示
   - 检查旧数据迁移

## 回滚方案

如需回滚，修改以下文件：

```javascript
// 前端
web/src/constants/common.constant.js: ITEMS_PER_PAGE = 10
web/src/constants/channel.constants.js: MODEL_TABLE_PAGE_SIZE = 10
web/src/constants/dashboard.constants.js: PAGE_SIZE = 20, MODEL_TABLE_PAGE_SIZE = 10

// 后端
common/constants.go: ItemsPerPage = 10
```

## 相关文档

- [前端架构总览](./架构文档/04-前端架构总览.md)
- [API文档](./API.md)

## 更新日期

2026-02-21
