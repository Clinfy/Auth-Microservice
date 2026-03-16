import { HttpStatus, Injectable } from '@nestjs/common';
import { EndpointPermissionRulesRepository } from 'src/services/endpoint-permission-rules/endpoint-permission-rules.repository';
import { PermissionsService } from 'src/services/permissions/permissions.service';
import {
  CreateEndpointPermissionRulesDTO,
  PatchEndpointPermissionRulesDTO,
} from 'src/interfaces/DTO/endpoint-permission-rules.dto';
import { RequestWithUser } from 'src/interfaces/request-user';
import { EndpointPermissionRulesEntity } from 'src/entities/endpoint-permission-rules.entity';
import {
  EndpointPermissionRulesErrorCodes,
  EndpointPRException,
} from 'src/services/endpoint-permission-rules/endpoint-permission-rules.exception.handler';
import { AssignPermissionDTO } from 'src/interfaces/DTO/assign.dto';

@Injectable()
export class EndpointPermissionRulesService {
  constructor(
    private readonly endpointPermissionRulesRepository: EndpointPermissionRulesRepository,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(dto: CreateEndpointPermissionRulesDTO, request: RequestWithUser): Promise<EndpointPermissionRulesEntity> {
    try {
      return await this.endpointPermissionRulesRepository.save(
        this.endpointPermissionRulesRepository.create({ ...dto, created_by: request.user }),
      );
    } catch (error) {
      throw new EndpointPRException(
        'Endpoint Permission Rule creation failed',
        EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_NOT_CREATED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id:string, dto: PatchEndpointPermissionRulesDTO) {
    try {
      return await this.endpointPermissionRulesRepository.save(await this.endpointPermissionRulesRepository.merge(await this.findOne(id), dto));
    } catch (error) {
      throw new EndpointPRException(
        'Endpoint Permission Rule update failed',
        EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_NOT_UPDATED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async delete(id: string): Promise<{ message: string }> {
    try {
      const endpointPermissionRule = await this.findOne(id);
      await this.endpointPermissionRulesRepository.remove(endpointPermissionRule);
      return { message: `Endpoint Permission Rule ${endpointPermissionRule.endpoint_key_name} deleted` };
    } catch (error) {
      throw new EndpointPRException(
        'Endpoint Permission Rule delete failed',
        EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_NOT_DELETED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: string): Promise<EndpointPermissionRulesEntity> {
    const endpointPermissionRule = await this.endpointPermissionRulesRepository.findOneById(id);

    if (!endpointPermissionRule) throw new EndpointPRException(
      'Endpoint Permission Rule not found',
      EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_NOT_FOUND,
      HttpStatus.NOT_FOUND
    );
    return endpointPermissionRule;
  }

  async findAll(): Promise<EndpointPermissionRulesEntity[]> {
    try {
      return await this.endpointPermissionRulesRepository.findAll();
    } catch (error) {
      throw new EndpointPRException(
        'Endpoint Permission Rules not found',
        EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_NOT_FOUND,
        error.status ?? HttpStatus.NOT_FOUND
      );
    }
  }

  async assignPermissions(id:string, dto:AssignPermissionDTO): Promise<EndpointPermissionRulesEntity> {
    try {
      const endpointPermissionRule = await this.findOne(id);
      endpointPermissionRule.permissions = await Promise.all(dto.permissionsIds.map((id) => this.permissionsService.findOne(id)));
      return await this.endpointPermissionRulesRepository.save(endpointPermissionRule);

    } catch (error) {
      throw new EndpointPRException(
        'Endpoint Permission Rule permission assignment failed',
        EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_ASSIGN_FAILED,
        error.status ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async enableRule (id: string): Promise<{ message: string }> {
    const endpointPermissionRule = await this.findOne(id);

    if (endpointPermissionRule.enabled) {
      throw new EndpointPRException(
        'Endpoint Permission Rule already enabled',
        EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_ALREADY_ENABLED,
        HttpStatus.BAD_REQUEST,
      );
    }
    endpointPermissionRule.enabled = true;
    await this.endpointPermissionRulesRepository.save(endpointPermissionRule)
    return { message: `Endpoint Permission Rule ${endpointPermissionRule.endpoint_key_name} enabled` };
  }

  async disableRule (id: string): Promise<{ message: string }> {
    const endpointPermissionRule = await this.findOne(id);

    if (!endpointPermissionRule.enabled) {
      throw new EndpointPRException(
        'Endpoint Permission Rule already disabled',
        EndpointPermissionRulesErrorCodes.ENDPOINT_PERMISSION_RULE_ALREADY_DISABLED,
        HttpStatus.BAD_REQUEST,
      );
    }
    endpointPermissionRule.enabled = false;
    await this.endpointPermissionRulesRepository.save(endpointPermissionRule)
    return { message: `Endpoint Permission Rule ${endpointPermissionRule.endpoint_key_name} disabled` };
  }
}
