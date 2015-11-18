var express = require('express');
var app = express();

var server = require('http').Server(app);

var io = require('socket.io')(server);

var nunjucks = require('nunjucks');
var redis = require('redis').createClient();
var moment = require('moment');

// var config = require('./config');

var queues = {
  'hospital': {
    'name'        : 'Memorial Hospital',
    'code'        : 'H',
    'description' : '',
    'color'       : '00a2c0'
  },
  'maternity': {
    'name'        : 'Maternity Center',
    'code'        : 'M',
    'description' : '',
    'color'       : 'f24572'
  }
};

var windows = {};
var controls = [];

var window_status = {}
var ticket_status = {}

nunjucks.configure('views', {
  'autoescape': true,
  'express'   : app,
});

// app.get('/login')

app.get('/control', function(req, res) {
  res.render('control.html', {
    'date': moment().format('MMMM D, YYYY'),
    'queues': JSON.stringify(queues)
  });
});

app.get('/window/:id', function(req, res) {
  res.render('window.html', {
    'id': req.params.id,
    'date': moment().format('MMMM D, YYYY'),
    'queues': JSON.stringify(queues)
  });
});

app.get('/ticketing', function(req, res) {
  res.render('ticketing.html', {
    'date': moment().format('MMMM D, YYYY'),
    'queues': JSON.stringify(queues)
  });
});

server.listen(7000);

function queueify(queue) {
  return queue + '_test';
}

function maxify(queue) {
  return queue + '_test_max';
}

io.on('connection', function(socket) {
  console.log('Client connected.');

  socket.on('disconnect', function() {
    console.log('Client disconnected.');
  });

  socket.on('login', function(data) {
    if (data.client == 'window') {
      windows[data.id] = socket;
      window_status[data.id] = {
        'number': null,
        'queue': data.queue
      }

      controls.forEach(function(socket) {
        socket.emit('login', {
          'server': 'app',
          'id': data.id,
          'queue': data.queue
        });
      });

      console.log('Client login from Window %s in Queue: %s)', data.id, queues[data.queue]['name']);
    }
    else if (data.client == 'control') {
      controls.push(socket)
      console.log('Client login from Control');
    }
  });

  socket.on('logout', function(data) {
    if (data.client == 'window') {
      delete windows[data.id];
      delete window_status[data.id];

      controls.forEach(function(socket) {
        socket.emit('logout', {
          'server': 'app',
          'id': data.id,
          'queue': data.queue
        });
      });
      console.log('Client logout from Window %s in Queue: %s)', data.id, queues[data.queue]['name']);
    }
    else if (data.client == 'control') {
      controls.splice(controls.indexOf(socket), 1);
      console.log('Client logout from Control');
    }
  });

  socket.on('push', function(data, callback) {
    redis.incr(maxify(data.queue));
    redis.rpush(queueify(data.queue), data.number, function(error, reply) {
      if (!error) {
        console.log('Pushing number into queue');
        controls.forEach(function(socket) {
          socket.emit('push', {
            'server': 'app',
            'queue' : data.queue,
            'number': data.number
          });
        });
        if (callback) callback();
        console.log('Client pushing %s to Queue: %s)', data.number, queues[data.queue]['name']);
      }
    });
  });

  socket.on('pop', function(data, callback) {
    redis.lpop(queueify(data.queue), function(error, reply) {
      if (reply) controls.forEach(function(socket) {
        socket.emit('pop', {
          'server': 'app',
          'queue': data.queue
        });
      });
      if (callback) callback();
    });
  });

  socket.on('peek', function(data, callback) {
    range = 0;
    if (data.max) {
      redis.get(maxify(data.queue), function(error, reply) {
        if (callback) callback({'queue': data.queue, 'number': reply});
      });
    } else {
      redis.lrange(queueify(data.queue), range, range, function(error, reply) {
        if (callback) callback({'queue': data.queue, 'number': reply});
      });
    }
  });

  socket.on('attach', function(data, callback) {
    if (data.queue != window_status[data.id]['queue']) return;

    window_status[data.id]['number'] = data.number;

    windows[data.id].emit('attach', {
      'server': 'app',
      'id': data.id,
      'number': data.number,
      'queue': data.queue
    });

    controls.forEach(function(socket) {
      socket.emit('attach', {
        'server': 'app',
        'id': data.id,
        'number': data.number,
        'queue': data.queue
      });
    });

    callback();
  });

  socket.on('detach', function(data) {
    if (data.queue != window_status[data.id]['queue']) return;

    window_status[data.id]['number'] = null;

    if (data.client == 'control')
      windows[data.number].emit('detach', {
        'server': 'app',
        'id': data.id,
        'number': data.number,
        'queue': data.queue
      });

    controls.forEach(function(socket) {
      socket.emit('detach', {
        'server': 'app',
        'id': data.id,
        'number': data.number,
        'queue': data.queue
      });
    });
  });

  socket.on('status', function(data, callback) {
    if (data.client == 'window') callback(window_status);
    else callback(null);
  });

});

app.use(express.static('public'));
