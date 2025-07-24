import { IsArray, IsNumber, IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LabParameterDto {
  @ApiProperty({
    description: 'Unique identifier for the lab parameter',
    example: 123,
  })
  @IsNumber()
  id: number;

  @ApiProperty({
    description: 'Name of the lab parameter',
    example: 'Hemoglobin (Hb)',
  })
  @IsString()
  parameter: string;
}

export class UpdateLabParametersDto {
  @ApiProperty({
    description: 'Array of lab parameters to add to the vector store',
    type: [LabParameterDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabParameterDto)
  parameters: LabParameterDto[];
}

export class DoctorDto {
  @ApiProperty({
    description: 'Unique identifier for the doctor',
    example: 456,
  })
  @IsNumber()
  id: number;

  @ApiProperty({
    description: 'First name of the doctor',
    example: 'John',
  })
  @IsString()
  doctorName: string;

  @ApiProperty({
    description: 'Last name of the doctor',
    example: 'Smith',
  })
  @IsString()
  doctorLastName: string;
}

export class UpdateDoctorsDto {
  @ApiProperty({
    description: 'Array of doctors to add to the vector store',
    type: [DoctorDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DoctorDto)
  doctors: DoctorDto[];
}

export class InstituteDto {
  @ApiProperty({
    description: 'Unique identifier for the institute',
    example: 789,
  })
  @IsNumber()
  id: number;

  @ApiProperty({
    description: 'Value/name of the institute',
    example: 'General Hospital',
  })
  @IsString()
  value: string;

  @ApiProperty({
    description: 'Display name for the institute (optional)',
    example: 'General Hospital - Main Branch',
    required: false,
  })
  @IsOptional()
  @IsString()
  displayName?: string;
}

export class UpdateInstitutesDto {
  @ApiProperty({
    description: 'Array of institutes to add to the vector store',
    type: [InstituteDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstituteDto)
  institutes: InstituteDto[];
}
