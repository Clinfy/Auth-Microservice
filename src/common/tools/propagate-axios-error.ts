import {isAxiosError} from "axios";
import {BadGatewayException, GatewayTimeoutException, HttpException} from "@nestjs/common";

export function propagateAxiosError(e: unknown): never {
  if (isAxiosError(e)) {
    if (e.response) {
      const status = e.response.status ?? 502;
      const body = e.response.data ?? 'Upstream error';
      throw new HttpException(body, status);
    }
    if (e.code === 'ECONNABORTED') throw new GatewayTimeoutException('Auth service timeout');
    throw new BadGatewayException('Auth service unreachable');
  }
  throw e;
}