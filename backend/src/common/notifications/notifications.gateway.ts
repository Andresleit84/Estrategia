import {
  WebSocketGateway, WebSocketServer, OnGatewayConnection,
  OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';
import { JwtPayload } from '../../modules/auth/types/auth.types';

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      // Authenticate via JWT from cookie or auth header
      const token =
        client.handshake.auth?.token ??
        client.handshake.headers?.authorization?.split(' ')[1] ??
        client.handshake.headers?.cookie?.match(/access_token=([^;]+)/)?.[1];

      if (!token) { client.disconnect(); return; }

      const payload = this.jwt.verify<JwtPayload>(token);
      client.data.userId = payload.sub;
      client.data.orgId  = payload.orgId;

      // Join personal room and org room
      await client.join(`user:${payload.sub}`);
      await client.join(`org:${payload.orgId}`);

      this.logger.debug(`Client connected: user=${payload.sub}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: user=${client.data?.userId}`);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() _data: unknown) {
    client.emit('pong', { ts: new Date().toISOString() });
  }

  // Called by services to push notifications to specific users
  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Called by cron services to push to entire org
  emitToOrg(orgId: string, event: string, data: unknown) {
    this.server.to(`org:${orgId}`).emit(event, data);
  }
}
