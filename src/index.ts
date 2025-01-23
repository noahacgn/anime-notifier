import axios from 'axios';
import nodemailer from 'nodemailer';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { loadConfig } from './config';
import { AnimeFile, ApiResponse } from './types';
import * as fs from 'fs';
import * as path from 'path';

const LAST_CHECK_FILE = path.join(process.cwd(), 'last_check.txt');
const CHECK_INTERVAL = 5 * 60 * 1000; // 5分钟检查一次

async function getLastCheckTime(): Promise<Date> {
    try {
        if (fs.existsSync(LAST_CHECK_FILE)) {
            const timestamp = fs.readFileSync(LAST_CHECK_FILE, 'utf-8').trim();
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                console.error('无效的时间戳格式:', timestamp);
                return new Date(Date.now() - 24 * 60 * 60 * 1000);
            }
            return date;
        }
    } catch (error) {
        console.error('读取上次检查时间时出错:', error);
    }
    return new Date(Date.now() - 24 * 60 * 60 * 1000); // 默认24小时前
}

async function updateLastCheckTime(): Promise<void> {
    try {
        fs.writeFileSync(LAST_CHECK_FILE, new Date().toISOString());
    } catch (error) {
        console.error('Error updating last check time:', error);
    }
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

        const htmlContent = animeFiles.map(file => {
            const downloadUrl = `${config.api.baseUrl}/${config.api.pathPrefix}/${file.name}`;
            return `
                <div>
                    <p>动画名称: ${file.name}</p>
                    <p>下载链接: <a href="${downloadUrl}">${downloadUrl}</a></p>
                    <p>发布时间: ${new Date(file.modifiedTime).toLocaleString()}</p>
                </div>
                <hr/>
            `;
        }).join('');

        console.log('正在发送邮件...');
        const info = await transporter.sendMail({
            from: config.mail.from,
            to: config.mail.to,
            subject: '新动画更新通知',
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
        throw error; // 重新抛出错误，让上层函数知道发送失败
    }
}

async function checkAnimeUpdates() {
    try {
        console.log('开始检查动画更新...', new Date().toLocaleString());
        const config = loadConfig();
        console.log('配置加载完成:', {
            animeNames: config.animeNames,
            smtpHost: config.smtp.host,
            smtpPort: config.smtp.port
        });

        const lastCheckTime = await getLastCheckTime();
        console.log('上次检查时间:', lastCheckTime.toLocaleString());

        const animeList = await fetchAnimeList(config);
        const newAnimeFiles = animeList.files.filter(file => {
            const isAfterLastCheck = new Date(file.modifiedTime) > lastCheckTime;
            const matchesWatchList = config.animeNames.some(animeName =>
                file.name.toLowerCase().includes(animeName.toLowerCase())
            );
            return isAfterLastCheck && matchesWatchList;
        });

        console.log('筛选结果:', {
            totalFiles: animeList.files.length,
            newFiles: newAnimeFiles.length
        });

        if (newAnimeFiles.length > 0) {
            console.log(`发现 ${newAnimeFiles.length} 个新动画更新，正在发送通知...`);
            console.log('新动画列表:', newAnimeFiles.map(f => f.name));
            await sendNotification(newAnimeFiles, config);
            console.log('通知发送完成');
        } else {
            console.log('没有发现新的更新');
        }

        await updateLastCheckTime();
        console.log('已更新检查时间');
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

// 本地开发模式
if (process.env.NODE_ENV !== 'production') {
    console.log('启动本地开发模式，每5分钟检查一次更新...');
    checkAnimeUpdates(); // 立即执行一次
    setInterval(checkAnimeUpdates, CHECK_INTERVAL);
}

// Vercel Serverless Function
export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        await checkAnimeUpdates();
        res.status(200).json({
            success: true,
            message: '检查完成'
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : '未知错误'
        });
    }
} 
