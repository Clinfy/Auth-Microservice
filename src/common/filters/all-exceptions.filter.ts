import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AxiosError } from 'axios';
import { QueryFailedError } from 'typeorm';

@Catch() // atrapa CUALQUIER excepción
export class AllExceptionsFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx     = host.switchToHttp();
        const res     = ctx.getResponse<Response>();
        const req     = ctx.getRequest<Request>();

        let status    = HttpStatus.INTERNAL_SERVER_ERROR;
        let code      = 'INTERNAL_ERROR';
        let message: string | string[] = 'Ha ocurrido un error inesperado';
        let details: any = undefined;

        // 1) Errores propios de Nest/HTTP
        if (exception instanceof HttpException) {
            status  = exception.getStatus();
            const body = exception.getResponse();
            if (typeof body === 'string') {
                message = body;
            } else if (typeof body === 'object' && body) {
                const b: any = body;
                message = b.message ?? message;
                code    = b.code    ?? code;
                details = b.errors  ?? b.details ?? details;
            }
        }

        // 2) Errores de Axios (llamadas a otros microservicios/APIs)
        else if (isAxiosError(exception)) {
            const err = exception as AxiosError;
            status  = err.response?.status ?? HttpStatus.BAD_GATEWAY;
            code    = 'UPSTREAM_ERROR';
            message = (err.response?.data as any)?.message ?? err.message ?? 'Error al invocar servicio externo';
            details = err.response?.data ?? err.toJSON?.() ?? undefined;
        }

        // 3) Errores de TypeORM
        else if (exception instanceof QueryFailedError) {
            // @ts-ignore
            const driverError = exception.driverError; // contiene .code en Postgres
            // Ajustá según tus convenciones:
            if (driverError?.code === '23505') { // unique_violation
                status  = HttpStatus.CONFLICT;
                code    = 'UNIQUE_VIOLATION';
                message = 'El recurso ya existe (violación de unicidad).';
            } else {
                status  = HttpStatus.BAD_REQUEST;
                code    = 'DB_ERROR';
                message = exception.message;
            }
            details = {
                query: (exception as any).query,
                parameters: (exception as any).parameters,
                driverError,
            };
        }

        // 4) Otros errores genéricos (JS / librerías varias)
        else if (exception instanceof Error) {
            message = exception.message ?? message;
            details = { name: exception.name, stack: exception.stack };
        }

        const errorResponse = {
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
            method: req.method,
            statusCode: status,
            code,
            message,
            details,
        };

        res.status(status).json(errorResponse);
    }
}

function isAxiosError(e: any): e is AxiosError {
    return !!e?.isAxiosError || e?.config?.headers !== undefined && (e?.response !== undefined || e?.request !== undefined);
}