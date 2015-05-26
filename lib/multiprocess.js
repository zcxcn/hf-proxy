
var Cluster = require("cluster");
var workers = {};
var restart = []; // 重启次数
var limit = 10; // 最大重启次数，超过这个次数将不再重启
var during = 60000; // 重启间隔毫秒

var workerMessage = function() {};

// 判断是否重启频繁
function isTooFrequently() {
  var time = Date.now();
  var length = restart.push(time);
  if (length > limit) {
    restart = restart.slice(limit * -1);
  }

  // 1分钟内重启了10次进程定义为频繁重启
  return restart.length >= limit && restart[restart.length - 1] - restart[0] < during;
}

function bindClusterEvent( work ){
  work.on('message',function( msg ){
    workerMessage(msg, workers);
  });
}

function createWorker() {

  var worker = Cluster.fork();

  bindClusterEvent( worker );
  workers[worker.process.pid] = worker;
  console.log('worker ', worker.process.pid, ' is created');

}

exports.listen = function( func , opts ){
  var numCPUs = opts && opts.numCPUs || 1;
  workerMessage = opts.workerMessage;

  if( Cluster.isMaster ){
    for (var i = 0; i < numCPUs; i++) {
      createWorker();
    }

    Cluster.on('exit', function(worker) {
      console.log('Worker ' + worker.process.pid + ' died and restart. ');
      delete workers[worker.process.pid];
      // 启动太频繁停止重启，触发giveup
      if (isTooFrequently()) {
        process.emit('giveup', workers);
        return;
      }
      createWorker();
    });

    opts.ready && opts.ready(workers);

  }else{
    func.call(null)
  }
};