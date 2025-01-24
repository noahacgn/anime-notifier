import axios from 'axios';
import nodemailer from 'nodemailer';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { loadConfig } from './config';
import { AnimeFile, ApiResponse } from './types';

// 时区相关的工具函数
function convertToBeijingTime(date: Date): Date {
    // 不需要加8小时，因为 API 返回的已经是北京时间
    return date;
}

function parseBeijingTime(timeStr: string): Date {
    // API 返回的时间已经是北京时间，直接解析
    return new Date(timeStr);
}

async function getCheckTime(): Promise<Date> {
    // 获取当前北京时间
    const now = new Date();
    // 检查最近30分钟的更新
    return new Date(now.getTime() - 30 * 60 * 1000);
}

async function fetchAnimeList(config: ReturnType<typeof loadConfig>): Promise<ApiResponse> {
    console.log('正在获取动画列表...');
    console.log('API地址:', `${config.api.baseUrl}/${config.api.pathPrefix}/`);
    console.log('代理配置:', process.env.NODE_ENV === 'development' ? config.httpProxy : '不使用代理');

    try {
        const axiosConfig = {
            proxy: process.env.NODE_ENV === 'development' ? {
                host: '127.0.0.1',
                port: 7890,
                protocol: 'http'
            } : undefined
        };

        const response = await axios.post(
            `${config.api.baseUrl}/${config.api.pathPrefix}/`,
            { password: "null" },
            axiosConfig
        );
        console.log('成功获取动画列表，数据条数:', response.data.files?.length || 0);
        return response.data;
    } catch (error) {
        console.error('获取动画列表失败:', error);
        if (error instanceof Error) {
            console.error('错误详情:', {
                message: error.message,
                stack: error.stack
            });
        }
        throw error;
    }
}

async function sendNotification(
    animeFiles: AnimeFile[],
    config: ReturnType<typeof loadConfig>
): Promise<void> {
    if (animeFiles.length === 0) return;

    console.log('准备发送邮件通知...');
    console.log('SMTP配置:', {
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        user: config.smtp.user,
        from: config.mail.from,
        to: config.mail.to
    });

    try {
        const transporter = nodemailer.createTransport({
            host: config.smtp.host,
            port: config.smtp.port,
            secure: config.smtp.port === 465,
            auth: {
                user: config.smtp.user,
                pass: config.smtp.pass
            }
        });

        console.log('正在验证SMTP连接...');
        await transporter.verify();
        console.log('SMTP连接验证成功');

        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
                    动画更新通知
                </h2>
                <p style="color: #7f8c8d; margin-bottom: 20px;">
                    发现 ${animeFiles.length} 个新更新
                </p>
                ${animeFiles.map(file => {
            const downloadUrl = `${config.api.baseUrl}/${config.api.pathPrefix}/${file.name}`;
            const fileTime = parseBeijingTime(file.modifiedTime);
            return `
                        <div style="background: #f8f9fa; border-radius: 5px; padding: 15px; margin-bottom: 15px;">
                            <h3 style="color: #2c3e50; margin: 0 0 10px 0;">
                                ${file.name.replace(/\[.*?\]/g, '').trim()}
                            </h3>
                            <p style="color: #34495e; margin: 5px 0;">
                                <strong>文件大小:</strong> ${(parseInt(file.size) / (1024 * 1024)).toFixed(2)} MB
                            </p>
                            <p style="color: #34495e; margin: 5px 0;">
                                <strong>发布时间:</strong> ${fileTime.toLocaleString('zh-CN', {
                timeZone: 'Asia/Shanghai',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            })}
                            </p>
                            <a href="${downloadUrl}" 
                               style="display: inline-block; background: #3498db; color: white; padding: 8px 15px; 
                                      text-decoration: none; border-radius: 3px; margin-top: 10px;">
                                下载
                            </a>
                        </div>
                    `;
        }).join('')}
                <div style="color: #7f8c8d; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                    此邮件由自动系统发送，请勿直接回复
                </div>
            </div>
        `;

        console.log('正在发送邮件...');
        const info = await transporter.sendMail({
            from: config.mail.from,
            to: config.mail.to,
            subject: `发现 ${animeFiles.length} 个动画更新`,
            html: htmlContent
        });
        console.log('邮件发送成功:', info.messageId);
    } catch (error) {
        console.error('邮件发送失败:', error);
        if (error instanceof Error) {
            console.error('错误详情:', {
                message: error.message,
                stack: error.stack
            });
        }
        throw error;
    }
}

async function checkAnimeUpdates() {
    try {
        console.log('开始检查动画更新...', convertToBeijingTime(new Date()).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
        const config = loadConfig();
        console.log('配置加载完成:', {
            animeNames: config.animeNames,
            smtpHost: config.smtp.host,
            smtpPort: config.smtp.port
        });

        const checkTime = await getCheckTime();
        console.log('检查时间范围:', checkTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }), '之后的更新');

        const animeList = await fetchAnimeList(config);
        const newAnimeFiles = animeList.files.filter(file => {
            const fileTime = parseBeijingTime(file.modifiedTime);
            const isAfterCheckTime = fileTime > checkTime;
            const matchesWatchList = config.animeNames.some(animeName =>
                file.name.toLowerCase().includes(animeName.toLowerCase())
            );
            return isAfterCheckTime && matchesWatchList;
        });

        console.log('筛选结果:', {
            totalFiles: animeList.files.length,
            newFiles: newAnimeFiles.length,
            checkTime: checkTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
        });

        if (newAnimeFiles.length > 0) {
            console.log(`发现 ${newAnimeFiles.length} 个新动画更新，正在发送通知...`);
            console.log('新动画列表:', newAnimeFiles.map(f => ({
                name: f.name,
                time: parseBeijingTime(f.modifiedTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
            })));
            await sendNotification(newAnimeFiles, config);
            console.log('通知发送完成');
        } else {
            console.log('没有发现新的更新');
        }
    } catch (error) {
        console.error('检查更新时发生错误:', error);
        if (error instanceof Error) {
            console.error('错误详情:', {
                message: error.message,
                stack: error.stack
            });
        }
    }
}

// Vercel Serverless Function
export default async function handler(req: VercelRequest, res: VercelResponse) {
    console.log('收到请求:', {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
    });

    // 只处理 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: '只支持 POST 请求'
        });
    }

    try {
        console.log('=== 开始执行检查任务 ===');
        await checkAnimeUpdates();
        console.log('=== 检查任务执行完成 ===');

        const response = {
            success: true,
            message: '检查完成',
            checkTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
        };
        console.log('返回响应:', response);
        res.status(200).json(response);
    } catch (error) {
        console.error('执行过程中发生错误:', error);
        if (error instanceof Error) {
            console.error('错误详情:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
        }
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : '未知错误',
            checkTime: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
        });
    }
} 
