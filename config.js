var config = {};

// Number of windows
config.MAX_WINDOWS = 8;

// Queue configuration
config.QUEUES = {};
config.QUEUES['hospital'] = {
  'name'        : 'Memorial Hospital',
  'code'        : 'H',
  'description' : '',
  'color'       : '00a2c0'
};

config.QUEUES['maternity'] = {
  'name'        : 'Maternity Center',
  'code'        : 'M',
  'description' : '',
  'color'       : 'f24572'
};

module.export = {'config': config};
