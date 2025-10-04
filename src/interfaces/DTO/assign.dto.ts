import {IsArray, IsNotEmpty, IsNumber} from "class-validator";

export class AssignPermissionDTO {
    @IsNotEmpty({ message: 'This field is required'})
    @IsNumber({}, { each: true, message: 'Each value must be a number'})
    @IsArray({ message: 'This field must be an array'})
    permissionIds: number[];
}