const http = require('http');
const net = require('net');
const { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 8080;

const server = http.createServer((req,res)=>{ 
  res.writeHead(200, {'Content-Type':'text/plain'});
  res.end('ok '+new Date().toISOString()); 
});

const wss = new WebSocketServer({ server, path: '/' });

wss.on('connection', ws => {
  console.log('>>> CLIENT CONNECTED at '+new Date().toISOString());
  ws.once('message', buf => {
    try{
      const data = Buffer.from(buf);
      let offset = 18 + data[17];
      const port = data.readUInt16BE(offset+1);
      const atype = data[offset+3];
      offset+=4;
      let host='';
      if(atype===1){ host=`${data[offset]}.${data[offset+1]}.${data[offset+2]}.${data[offset+3]}`; offset+=4; }
      else if(atype===2){ const l=data[offset]; offset++; host=data.slice(offset, offset+l).toString(); offset+=l; }
      else if(atype===3){ host='[ipv6]'; offset+=16; }
      else { console.log('unknown atype',atype); return ws.close(); }
      offset+=2;
      const payload = data.slice(offset);
      console.log('>>> TRY CONNECT', host, port);
      const sock = net.connect(port, host, ()=>{
        console.log('>>> CONNECTED TO', host, port);
        ws.send(Buffer.from([data[0],0]));
        if(payload.length) sock.write(payload);
        ws.on('message', d=> sock.write(d));
        sock.on('data', d=> ws.send(d));
        sock.on('close', ()=> { console.log('sock closed'); ws.close(); });
      });
      sock.on('error', e=>{ console.log('>>> SOCK ERROR', e.message); ws.close(); });
    }catch(e){ console.log('>>> ERROR', e.message); ws.close(); }
  });
});

server.listen(PORT, '0.0.0.0', ()=> console.log('Listening on '+PORT+' at '+new Date().toISOString()));