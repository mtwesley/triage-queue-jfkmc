var app = require('express')();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var nunjucks = require('nunjucks');

nunjucks.configure('views', {
  autoescape: true,
  express   : app
});

app.get('/', function(req, res) {
  res.render('index.html')
});

server.listen(7000);

io.on('connection', function(socket) {
  console.log('Client connected.');

  socket.on('disconnect', function() {
    console.log('Client disconnected.');
  });
});
