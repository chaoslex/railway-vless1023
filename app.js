import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { createConnection } from 'net';

const UUID = process.env.UUID || 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const PORT = process.env.PORT || 8080;

function isValidUUID(uuid) {
  return uuid.toLowerCase() === UUID.toLowerCase();
}

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('VLESS Server Running');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.once('message', (msg) => {
    try {
      const buf = Buffer.from(msg);
      if (buf.length < 24) return ws.close();
      const version = buf[0];
      const uuid = buf.slice(1, 17).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
      if (!isValidUUID(uuid)) return ws.close();
      
      const optLength = buf[17];
      const cmd = buf[18 + optLength];
      if (cmd !== 1 && cmd !== 2) return ws.close(); // 1=TCP, 2=UDP
      
      let port = buf.readUInt16BE(18 + optLength + 1);
      let addrType = buf[18 + optLength + 3];
      let addrLength = 0;
      let addr = '';
      
      if (addrType === 1) { // IPv4
        addr = buf.slice(18 + optLength + 4, 18 + optLength + 8).join('.');
        addrLength = 4;
      } else if (addrType === 2) { // Domain
        addrLength = buf[18 + optLength + 4];
        addr = buf.slice(18 + optLength + 5, 18 + optLength + 5 + addrLength).toString();
      } else if (addrType === 3) { // IPv6
        const ipv6 = [];
        for (let i = 0; i < 16; i += 2) {
          ipv6.push(buf.readUInt16BE(18 + optLength + 4 + i).toString(16));
        }
        addr = ipv6.join(':');
        addrLength = 16;
      }

      const payload = buf.slice(18 + optLength + 4 + (addrType === 2 ? 1 : 0) + addrLength + 2);
      
      const tcp = createConnection({ host: addr, port }, () => {
        ws.send(Buffer.from([version, 0]));
        if (payload.length > 0) tcp.write(payload);
        ws.on('message', (data) => tcp.write(data));
        tcp.on('data', (data) => ws.send(data));
        tcp.on('close', () => ws.close());
        tcp.on('error', () => ws.close());
      });
      tcp.on('error', () => ws.close());
    } catch (e) {
      ws.close();
    }
  });
  ws.on('error', () => {});
});

server.listen(PORT, () => console.log(`Listening on ${PORT} UUID ${UUID}`));