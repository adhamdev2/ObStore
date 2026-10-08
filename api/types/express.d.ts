export {};

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                username: string;
                avatar?: string;
            };
            fivemSession?: {
                sessionId: string;
                licenseId: string;
                hwidHash: string;
                userId: string;
            };
            file?: {
                fieldname: string;
                originalname: string;
                encoding: string;
                mimetype: string;
                buffer: Buffer;
                size: number;
            };
        }
    }
}
