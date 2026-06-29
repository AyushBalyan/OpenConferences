import { Controller, Get } from '@nestjs/common';

@Controller('debug')
export class DebugController {
  @Get('error')
  triggerError(): never {
    throw new Error('Deliberate debug error for problem envelope verification');
  }
}
