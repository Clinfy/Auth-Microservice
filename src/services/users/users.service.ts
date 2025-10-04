import {Injectable, NotFoundException, UnauthorizedException} from '@nestjs/common';
import {InjectDataSource, InjectRepository} from "@nestjs/typeorm";
import {UserEntity} from "src/entities/user.entity";
import {DataSource, Repository} from "typeorm";
import {JwtService} from "src/services/JWT/jwt.service";
import {RegisterUserDTO} from "src/interfaces/DTO/register.dto";
import {UserI} from "src/interfaces/user.interface";
import { compareSync } from 'bcrypt';
import {LoginDTO} from "src/interfaces/DTO/login.dto";
import {AuthInterface} from "src/interfaces/auth.interface";
import {AssignRoleDTO} from "src/interfaces/DTO/assign.dto";
import {RolesService} from "src/services/roles/roles.service";

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(UserEntity)
        private readonly userRepository: Repository<UserEntity>,

        @InjectDataSource()
        private readonly dataSource: DataSource,

        private readonly jwtService: JwtService,
        private readonly roleService: RolesService,
    ) {}

    async refreshToken(refreshToken: string): Promise<AuthInterface> {
        return this.jwtService.refreshToken(refreshToken);
    }

    async canDo(user: UserI, permissionCode: string): Promise<boolean> {
        const result = user.permissionCodes.includes(permissionCode);
        if (!result) {
            throw new UnauthorizedException('No cuenta con permisos suficientes para realizar esa acción');
        }
        return result;
    }

    async register(dto: RegisterUserDTO): Promise<UserEntity> {
        try {
            return await this.dataSource.transaction(async manager => {
                const user = this.userRepository.create(dto);
                return await manager.save(user);
            })
        }catch (error) {
            throw new Error(error);
        }
    }

    async logIn(body: LoginDTO): Promise<AuthInterface> {
        const user = await this.findByEmail(body.email);
        if(!user) throw new UnauthorizedException('Wrong email or password');

        if(!user.active) throw new UnauthorizedException('This user is not active')

        const compare = compareSync(body.password, user.password);
        if(!compare) throw new UnauthorizedException('Wrong email or password');

        return {
            accessToken: this.jwtService.generateToken({email: user.email}, 'auth'),
            refreshToken: this.jwtService.generateToken({email: user.email}, 'refresh')
        }
    }

    async findByEmail(email: string): Promise<UserEntity> {
            const user = await this.userRepository.findOne({where: {email}});
            if(!user) throw new NotFoundException(`El email ${email} no se encuentra registrado`);
            return user;
    }

    async assignRole(id: number, dto: AssignRoleDTO): Promise<UserEntity> {
        const user = await this.findOne(id);
        user.roles = await Promise.all(dto.rolesIds.map(id => this.roleService.findOne(id)));
        return await this.userRepository.save(user);
    }

    private async findOne(id: number): Promise<UserEntity> {
        const user = await this.userRepository.findOneBy({id});
        if(!user) throw new NotFoundException('User not found');
        return user;
    }
}
