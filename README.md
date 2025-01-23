# 动画更新通知服务

这是一个自动检查动画更新并发送邮件通知的服务。

## 功能特点

- 定期检查指定动画的更新
- 支持多个动画名称的监控
- 通过邮件发送更新通知
- 自动记录上次检查时间
- 支持HTTP代理配置

## 环境变量配置

复制 `.env.example` 文件为 `.env`，并填写以下配置：

```env
# SMTP配置
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password

# 邮件配置
MAIL_FROM=your-email@example.com
MAIL_TO=recipient@example.com

# 动画名称列表（用逗号分隔）
ANIME_NAMES=天久鷹央的推理病歷表,青春特調蜂蜜檸檬蘇打

# HTTP代理配置
HTTP_PROXY=http://127.0.0.1:7890

# API配置
API_BASE_URL=https://openani.an-i.workers.dev
API_PATH_PREFIX=2025-1
```

## 本地开发

1. 安装依赖：
```bash
npm install
```

2. 编译TypeScript：
```bash
npm run build
```

3. 运行服务：
```bash
npm start
```

## 部署

1. 部署到Vercel：
   - 将代码推送到GitHub
   - 在Vercel中导入项目
   - 配置环境变量

2. 配置GitHub Actions：
   - 在GitHub仓库设置中添加 `VERCEL_FUNCTION_URL` secret
   - Actions会自动按计划运行

## License

MIT 
