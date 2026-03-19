import { Reflector } from '@nestjs/core';

export const EndpointKey = Reflector.createDecorator<string>();
