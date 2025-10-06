import {Injectable} from '@nestjs/common';

@Injectable()
export class AppService {
    getStatus(): string {
        return `
        status: ok | 
        name: ${process.env.npm_package_name} |
        version: ${process.env.npm_package_version} |
        node: ${process.version} | 
        uptime: ${Math.floor(process.uptime())} secs | 
        memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB |
        now: ${new Date().toISOString()}
        `;
    }
}
