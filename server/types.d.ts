// Type declarations for modules without types
declare module 'node-cron' {
    interface ScheduledTask {
        start(): void;
        stop(): void;
        destroy(): void;
    }

    interface ScheduleOptions {
        scheduled?: boolean;
        timezone?: string;
    }

    function schedule(
        expression: string,
        func: () => void | Promise<void>,
        options?: ScheduleOptions
    ): ScheduledTask;

    function validate(expression: string): boolean;

    export { schedule, validate, ScheduledTask, ScheduleOptions };
    export default { schedule, validate };
}

declare module 'html-pdf-node' {
    interface FileOptions {
        content?: string;
        url?: string;
    }

    interface PdfOptions {
        format?: string;
        path?: string;
        width?: string;
        height?: string;
        margin?: {
            top?: string;
            right?: string;
            bottom?: string;
            left?: string;
        };
        printBackground?: boolean;
        landscape?: boolean;
    }

    function generatePdf(
        file: FileOptions,
        options?: PdfOptions
    ): Promise<Buffer>;

    function generatePdfs(
        files: FileOptions[],
        options?: PdfOptions
    ): Promise<Buffer[]>;

    export { generatePdf, generatePdfs };
}

declare module 'html-docx-js' {
    function asBlob(html: string, options?: any): Blob;
    export { asBlob };
    export default { asBlob };
}
