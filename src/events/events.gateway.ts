import {
WebSocketGateway,
WebSocketServer,
OnGatewayInit,
} from '@nestjs/websockets';
import { Server } from 'socket.io';


@WebSocketGateway({ cors: { origin: '*' } })
export class EventsGateway implements OnGatewayInit {
@WebSocketServer() server: Server;


afterInit() {
console.log('WebSocket Gateway initialized');
}


broadcastBookingUpdate(payload: any) {
this.server.emit('booking:update', payload);
}
}