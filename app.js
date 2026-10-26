const http = require('http');
const { WebSocketServer } = require('ws');
const net = require('net');
const UUID = process.env.UUID || 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const PORT = process.env.PORT || 3000;
const server = http.createServer((req,res)=>{res.writeHead(200);res.end('ok')});
const wss = new WebSocketServer({server});
wss.on('connection', ws=>{
  ws.once('message', msg=>{
    try{
      const buf = Buffer.from(msg);
      const uuid = buf.slice(1,17).toString('hex');
      if(uuid !== UUID.replace(/-/g,'')) return;
      const port = buf.readUInt16BE(18+buf[19]);
      const len = buf[20];
      const host = buf.slice(21,21+len).toString();
      const sock = net.connect(port,host,()=>{
        ws.send(Buffer.from([0,0]));
        sock.pipe(ws).pipe(sock);
      });
      sock.on('error',()=>{});
    }catch(e){}
  });
});
server.listen(PORT, ()=>console.log('running on '+PORT));