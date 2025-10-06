import { Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/entities/user.entity';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from 'src/services/JWT/jwt.service';
import { RegisterUserDTO } from 'src/interfaces/DTO/register.dto';
import { UserI } from 'src/interfaces/user.interface';
import { compare } from 'bcrypt';
import { LoginDTO } from 'src/interfaces/DTO/login.dto';
import { AuthInterface } from 'src/interfaces/auth.interface';
import { AssignRoleDTO } from 'src/interfaces/DTO/assign.dto';
import { RolesService } from 'src/services/roles/roles.service';

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
            throw new UnauthorizedException('You do not have permission to perform this action');
        }
        return result;
    }

    async register(dto: RegisterUserDTO): Promise<{ message: string }> {
        return this.dataSource.transaction(async manager => {
            const transactionalRepository = manager.getRepository(UserEntity);
            const user = await transactionalRepository.save(transactionalRepository.create(dto));
            return {message: `User ${user.email} created`};
        });
    }

    async logIn(body: LoginDTO): Promise<AuthInterface> {
        const user = await this.findByEmail(body.email);
        if (!user) {
            throw new UnauthorizedException('Wrong email or password');
        }

        if (!user.active) {
            throw new UnauthorizedException('This user is not active');
        }

        const isPasswordValid = await compare(body.password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Wrong email or password');
        }

        try {
            const [accessToken, refreshToken] = await Promise.all([
                this.jwtService.generateToken({ email: user.email }, 'auth'),
                this.jwtService.generateToken({ email: user.email }, 'refresh'),
            ]);

            return {
                accessToken,
                refreshToken,
            };
        } catch (error) {
            throw new InternalServerErrorException('Unable to issue authentication tokens');
        }
    }

    async findByEmail(email: string): Promise<UserEntity | null> {
        return this.userRepository.findOne({ where: { email } });
    }

    async assignRole(id: number, dto: AssignRoleDTO): Promise<UserEntity> {
        const user = await this.findOne(id);
        user.roles = await Promise.all(dto.rolesIds.map(roleId => this.roleService.findOne(roleId)));
        return this.userRepository.save(user);
    }

    private async findOne(id: number): Promise<UserEntity> {
        const user = await this.userRepository.findOneBy({ id });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }
}
