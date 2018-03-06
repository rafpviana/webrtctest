'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var socketIO = require('socket.io');
var fileServer = new(nodeStatic.Server)();

// var http = require('http');


var https = require('https');
var fs = require('fs');

var options = {
  key: fs.readFileSync('hostkey.pem'),
  cert: fs.readFileSync('hostcert.pem')
};

var app = https.createServer(options, function (req, res) {
  fileServer.serve(req, res);
}).listen(8000);


// var app = http.createServer(function(req, res) {//
//   fileServer.serve(req, res);
// }).listen(8080);

var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {//

  socket.on('message', function(message) {//
    showOnClientLog('Any client said: ' + message);
    socket.broadcast.emit('message', message); // for a real app, would be room-only (not broadcast)
  });

  function showOnClientLog() {//
    var array = ['===== Server: '];
    array.push.apply(array, arguments);
    socket.emit('showOnClientLog', array);
  }

  socket.on('create or join', function(room) {//
    showOnClientLog('Received request to create or join room ' + room);
    var numClients = io.sockets.sockets.length;
    showOnClientLog('Room ' + room + ' now has ' + numClients + ' client(s)');
    if (numClients === 1) {
      socket.join(room);
      showOnClientLog('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);
    } 
    else if (numClients === 2) {
      showOnClientLog('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('joinRequest', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      // io.sockets.in(room).emit('ready');
    } 
    else { // max two clients
      socket.emit('full', room);
    }
  });

  // socket.on('ipaddr', function() {//
  //   var ifaces = os.networkInterfaces();
  //   for (var dev in ifaces) {
  //     ifaces[dev].forEach(function(details) {
  //       if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
  //         socket.emit('ipaddr', details.address);
  //       }
  //     });
  //   }
  // });

});
