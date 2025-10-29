import { IsString, IsNumber, Min } from 'class-validator';

export class CreateTicketDto {
    @IsString()
    title: string;

    @IsNumber()
    @Min(0)
    price: number;

    @IsNumber()
    @Min(1)
    quantity: number;
}
