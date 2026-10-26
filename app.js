const http = require('http');
const net = require('net');
const { WebSocketServer } = require('ws');

const UUID = (process.env.UUID || 'f47ac10b-58cc-4372-a567-0e02b2c3d479').toLowerCase();
const PORT = process.env.PORT || 8080;

function checkUUID(uuid){
  return uuid.replace(/-/g,'').toLowerCase() === UUID.replace(/-/g,'').toLowerCase();
}

const server = http.createServer((req,res)=>{
  res.writeHead(200);
  res.end('ok');
});

const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  ws.once('message', msg => {
    const data = Buffer.from(msg);
    if(data.length < 24) return ws.close();
    const uuid = data.slice(1,17).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');
    if(!checkUUID(uuid)) return ws.close();
    
    let offset = 18 + data[17];
    const port = data.readUInt16BE(offset+1);
    const atype = data[offset+3];
    offset += 4;
    let addr = '';
    if(atype === 1){
      addr = `${data[offset]}.${data[offset+1]}.${data[offset+2]}.${data[offset+3]}`;
      offset += 4;
    }else if(atype === 2){
      const len = data[offset];
      offset += 1;
      addr = data.slice(offset, offset+len).toString();
      offset += len;
    }else if(atype === 3){
      let ipv6 = [];
      for(let i=0;i<16;i+=2) ipv6.push(data.readUInt16BE(offset+i).toString(16));
      addr = ipv6.join(':');
      offset += 16;
    }else{
      return ws.close();
    }
    offset += 2;
    const firstPayload = data.slice(offset);

    const socket = net.connect(port, addr, ()=>{
      ws.send(Buffer.from([data[0],0]));
      if(firstPayload.length) socket.write(firstPayload);
      ws.on('message', d=> socket.write(d));
      socket.on('data', d=> ws.send(d));
      socket.on('end', ()=> ws.close());
      socket.on('error', ()=> ws.close());
    });
    socket.on('error', ()=> ws.close());
  });
  ws.on('error', ()=>{});
});

server.listen(PORT, ()=> console.log('Running on '+PORT));