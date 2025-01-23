export interface AnimeFile {
    mimeType: string;
    size: string;
    id: string;
    name: string;
    modifiedTime: string;
}

export interface ApiResponse {
    files: AnimeFile[];
}

export interface Config {
    smtp: {
        host: string;
        port: number;
        user: string;
        pass: string;
    };
    mail: {
        from: string;
        to: string;
    };
    animeNames: string[];
    httpProxy: string;
    api: {
        baseUrl: string;
        pathPrefix: string;
    };
} 
