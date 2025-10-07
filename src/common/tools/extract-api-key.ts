import {Request} from "express";
import {UnauthorizedException} from "@nestjs/common";

export function extractApiKey(request: Request): string {
    const headerValue = request.headers['x-api-key'];

    if (Array.isArray(headerValue)) {
        throw new UnauthorizedException('API key header must be a single value');
    }

    if (typeof headerValue !== 'string' || headerValue.trim().length === 0) {
        throw new UnauthorizedException('API key header missing');
    }

    return headerValue.trim();
}