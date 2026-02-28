import {
  IsNotEmpty,
  IsNumber,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';

class EnvironmentVariables {
  //---------- MAIN HOSTS -----------------
  @IsString()
  @IsNotEmpty()
  DATABASE_HOST: string;

  @IsString()
  @IsNotEmpty()
  RABBITMQ_URL: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL: string;

  //---------- MAIN CONFIGS -----------------
  @IsNumber()
  @IsNotEmpty()
  PORT: number;

  @IsString()
  @IsNotEmpty()
  APP_NAME: string;

  @IsString()
  @IsNotEmpty()
  FRONTEND_URL: string;

  //---------- EMAIL CONFIGS -----------------
  @IsString()
  @IsNotEmpty()
  EMAIL_API_KEY: string;

  @IsString()
  @IsNotEmpty()
  EMAIL_API_URL: string;

  //---------- JWT CONFIGS -----------------
  @IsString()
  @MinLength(32)
  @IsNotEmpty()
  JWT_AUTH_SECRET: string;

  @IsString()
  @MinLength(32)
  @IsNotEmpty()
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_AUTH_EXPIRES_IN: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN: string;

  //---------- RESET PASSWORD CONFIGS -----------------
  @IsString()
  @IsNotEmpty()
  RESET_PASSWORD_EXPIRES_IN: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}