import { Controller, Post, Get, Body, UseGuards, Req, HttpCode } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { McpService } from './mcp.service';
import { McpRequest } from './types/mcp.types';
import { UserSession } from '../modules/auth/types/auth.types';

// Endpoint MCP compatible con el protocolo JSON-RPC de MCP.
// Los agentes IA se conectan a POST /api/v1/mcp con su JWT.
@Controller('mcp')
@UseGuards(JwtAuthGuard)
export class McpController {
  constructor(private readonly mcp: McpService) {}

  @Get('tools')
  listTools() {
    return { tools: this.mcp.getTools() };
  }

  @Post()
  @HttpCode(200)
  async handleRequest(@Body() body: McpRequest, @Req() req: Request) {
    const user = req.user as UserSession;

    if (body.method === 'tools/list') {
      return { tools: this.mcp.getTools() };
    }

    if (body.method === 'tools/call') {
      const name = body.params?.name;
      const input = body.params?.arguments ?? {};
      if (!name) return { isError: true, content: [{ type: 'text', text: 'Missing tool name' }] };

      return this.mcp.callTool({ name, input }, user.user_id, user.organization_id);
    }

    return { isError: true, content: [{ type: 'text', text: `Método desconocido: ${body.method}` }] };
  }
}
