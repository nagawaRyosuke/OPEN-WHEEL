const child_process = require('child_process');
const path = require('path');
const fs = require('fs');
const {promisify} = require('util');

const glob = require('glob');

const {getSsh} = require('./sshManager');
const {interval, remoteHost, jobScheduler} = require('../db/db');
const logger = require('../logger');
const {addXSync, getDateString} = require('./utility');

let executers=[];

async function mkdir_p(targetPath){
  let dirs=[];
  let target = targetPath;
  while(target !== path.poisx.sep){
    try{
      var stats = await promisify(fs.stat)(target)
    }catch(e){
      if(e.code === 'ENOENT'){
        dirs.unshift(target);
        target = path.posix.dirname(target);
      }
    }
    if(stats.isDirectory()){
      break;
    }
  }
  let p = Promise.resolve();
  dirs.forEach((dir)=>{
    p = p.then(()=>{
      return promisify(fs.mkdir)(dir);
    });
  });
  return p;
}

async function recursiveSymlink(srcRoot, src, dstRoot, dst){
  let srces = await promisify(glob)(src, {cwd: srcRoot});
  let oldPath = path.posix.resolve(srcRoot, src);
  let newPath = path.posix.resolve(dstRoot, dst);
  let targetDir = path.posix.dirname(newPath);
  mkdir_p(targetDir);
  if(srces.length === 1){
    return promisify(fs.link)(oldPath, newPath);
  }
  let promises = srces.map(async (srcFile)=>{
    let dir = path.posix.dirname(srcFile)
    await mkdir_p(path.posix.join(newPath, dir));
    return promisify(fs.link)(oldPath, path.posix.join(newPath, srcFile));
  })
  return Promise.all(promises);
}

/**
 * convert to posix-style path string and remove head and tail path separator
 */
function normalizePath(pathString){
  let rt="";
  // path.posix.sep('/') is disallowed as filename letter on windows OS
  // but posix allow path.win32.sep('\').
  // so the order of following if clause can not be swaped.
  if(pathString.includes(path.posix.sep)){
    let pathObj=path.posix.parse(pathString);
    rt = path.posix.join(pathObj.dir, pathObj.base);
  }else if(pathString.includes(path.win32.sep)){
    let pathObj=path.win32.parse(pathString);
    rt = path.posix.join(pathObj.dir.split(path.win32.sep), pathObj.base);
  }
  return rt;
}

/**
 * pass outputFiles to dstination node
 * @param {Task} task - task instance
 */
async function deliverOutputFiles(task){
  let promises=[];
  task.outputFiles.forEach((e)=>{
    let src = normalizePath(e.name);
    //TODO 間違い。一つづづpushしないとoutputFilesが複数存在した時に上書きしてしまう
    promises = e.dst.map(async (dst)=>{
      let dstPath=path.resolve(dst.path, dst.dstName);
      try{
        promisify(fs.unlink)(dstPath);
      }catch(e){
        if(e.code !== 'ENOENT' || e.code !== 'EISDIR'){
          return Promise.reject(e);
        }
      }
      return recursiveSymlink(task.workingDir, src, dst.path, normalizePath(dst.dstName))
    });
  });
  return Promise.all(promises);
}

/**
 * execute task on localhost(which is running node.js)
 * @param {Task} task - task instance
 * @return pid - process id of child process
 */
function localExec(task){
  let script = path.resolve(task.workingDir, task.script);
  addXSync(script);
  //TODO env, uid, gidを設定する
  let options = {
    "cwd": task.workingDir
  }
  let cp = child_process.exec(script, options, (err, stdout, stderr)=>{
    if(err) throw err;
    logger.stdout(stdout);
    logger.stderr(stderr);
  })
    .on('exit', (code) =>{
      deliverOutputFiles(task)
        .then(()=>{
          if(code === 0){
            task.state = 'finished';
          }else{
            task.state = 'failed';
          }
        });
    });
  return cp.pid;
}

async function prepareRemoteExecDir(ssh, task){
  let remoteScriptPath = path.posix.join(task.remoteWorkingDir, task.script);
  logger.debug(`send ${task.workingDir} to ${task.remoteWorkingDir}`);
  return ssh.send(task.workingDir, task.remoteWorkingDir)
  .then(()=>{
    return ssh.chmod(remoteScriptPath, '744');
  });
}
async function postProcess(ssh, task, rt){
  logger.debug('get necessary files from remote server');
  let promises=task.outputFiles.map((e)=>{
    let src = path.posix.join(task.remoteWorkingDir, e.name);
    let dst = e.name;
    if(! path.posix.isAbsolute(e.name)){
      dst = path.posix.join(task.workingDir, path.posix.dirname(e.name));
    }
    ssh.recv(src, dst);
  });
  if(promises.length>0){
    await Promise.all(promises);
  }
  //TODO dispatcher内でcleanup flagを確認してdoCleanupを設定
  if(task.doCleanup){
    logger.debug('clean up on remote server');
    await ssh.exec(`rm -fr ${task.remoteWorkingDir}`);
  }
  return deliverOutputFiles(task)
    .then(()=>{
    logger.debug(task.name, 'done. rt =', rt);
      if(rt === 0){
        task.state = 'finished';
      }else{
        task.state = 'failed';
      }
    });
}

async function remoteExecAdaptor(ssh, task){
  await prepareRemoteExecDir(ssh, task)
  logger.debug("prepare done");
  let scriptAbsPath=path.posix.join(task.remoteWorkingDir, task.script);
  let workdir=path.posix.dirname(scriptAbsPath);
  let cmd = `cd ${workdir} && ${scriptAbsPath}`;
  let passToSSHout=(data)=>{
    logger.SSHout(data.toString());
  }
  let passToSSHerr=(data)=>{
    logger.SSHerr(data.toString());
  }
  ssh.on('stdout', passToSSHout);
  ssh.on('stderr', passToSSHerr);
  logger.debug('exec (remote)', cmd);
  let rt = await ssh.exec(cmd);
  ssh.off('stdout', passToSSHout);
  ssh.off('stderr', passToSSHerr);
  
  return postProcess(ssh, task, rt);
}

function localSubmit(qsub, task){
  console.log('localSubmit function is not implimented yet');
}
async function remoteSubmitAdaptor(ssh, task){
  await prepareRemoteExecDir(ssh, task);
  let scriptAbsPath=path.posix.join(task.remoteWorkingDir, task.script);
  let workdir=path.posix.dirname(scriptAbsPath);
  let submitCmd = `cd ${workdir} &&`

  let hostinfo = remoteHost.get(task.remotehostID);
  let JS = jobScheduler[hostinfo.jobScheduler];
  submitCmd += ` ${JS.submit}`

  let queue = null;
  if(task.queue in hostinfo.queues){
    queue = task.queue;
  }else if (hostinfo.queues.length > 0){
    queue = hostinfo.queues[0];
  }
  if(queue){
    submitCmd += ` ${JS.queueOpt}${queue}`;
  }
  submitCmd += ` ${scriptAbsPath}`;

  let jobID=null;
  let getJobID = (data)=>{
    logger.debug('getJobID() called');
    let outputText=data.toString();
    logger.debug(outputText);
    let re = new RegExp(JS.reJobID);
    jobID = re.exec(outputText)[1];
    logger.info('jobID:', jobID);
  }
  ssh.on('stdout', getJobID);
  logger.debug('submit job:', submitCmd);
  let rt = await ssh.exec(submitCmd);
  ssh.off('stdout', getJobID);

  if(rt !== 0){
    logger.error('remote submit command failed!', rt);
    logger.error(error);
    return 
  }
  let finished=false;
  let isFinished = (data)=>{
    logger.debug('isFinished() called');
    let outputText=data.toString();
    logger.debug(outputText);
    let reFinishedState = new RegExp(JS.reFinishedState);
    finished=reFinishedState.test(outputText);
    if(finished) return;
    let reFailedState  = new RegExp(JS.reFailedState);
    finished=reFailedState.test(outputText);
  }
  ssh.on('stdout', isFinished);

  let timeout = setInterval(async ()=>{
    let cmd=`${JS.stat} ${jobID}`;
    logger.debug(cmd);
    let rt = await ssh.exec(cmd);
    if(rt !== 0){
      logger.error('remote stat command failed!', rt);
      logger.error(error);
      return 
    }
    logger.debug(jobID,'is finished', finished);
    if(finished){
      clearInterval(timeout);
      ssh.off('stdout', isFinished);
      postProcess(ssh, task, rt);
    }
  },5000);
}

class Executer{
  constructor(exec, maxNumJob, remotehostID){
    this.remotehostID=remotehostID;

    this.exec=exec;
    this.maxNumJob=maxNumJob;

    this.queue=[];
    this.currentNumJob=0;
    this.executing=false;
    setInterval(()=>{
      if(this.executing) return;
      this.executing=true;
      if(this.queue.length >0 && this.currentNumJob < this.maxNumJob){
        let task = this.queue.pop()
        task.handler = this.exec(task);
        this.currentNumJob++;
      }
      this.executing=false;
    }, interval);
  }
  submit(task){
    this.queue.push(task);
    task.state='waiting';
  }
  cancel(task){
    this.queue=this.queue.filter((e)=>{
      return e.id!==task.id;
    });
  }
}

async function createExecuter(task){
  let maxNumJob=1;
  let exec = localExec;
  //TODO add local submit case
  if(task.remotehostID!== 'localhost'){
    let hostinfo = remoteHost.get(task.remotehostID);
    maxNumJob = hostinfo.numJob;
    let config = {
      host: hostinfo.host,
      port: hostinfo.port,
      username: hostinfo.username,
    }
    let localWorkingDir = path.relative(task.rwfDir, task.workingDir);
    //TODO getDateStringではなくプロジェクトの実行開始時刻を使った方が良いかも？
    //その場合はtaskのdispatcher側でプロパティに入れておく必要あり
    task.remoteWorkingDir = path.posix.join(hostinfo.path, getDateString(), localWorkingDir);

    let arssh = getSsh(config, {connectionRetryDelay: 1000});
    if(task.useJobScheduler && Object.keys(jobScheduler).includes(hostinfo.jobScheduler)){
      exec = remoteSubmitAdaptor.bind(null, arssh)
    }else{
      exec = remoteExecAdaptor.bind(null, arssh)
    }
  }
  maxNumJob = parseInt(maxNumJob, 10);
  if (Number.isNaN(maxNumJob) || maxNumJob < 1){
    maxNumJob = 1;
  }

  return new Executer(exec, maxNumJob, task.remotehostID);
}

/**
 * enqueue task
 * @param {Task} task - instance of Task class (dfined in workflowComponent.js)
 */
async function exec(task){
  task.remotehostID=remoteHost.getID('name', task.host) || 'localhost'; //TODO to be replaced by id search
  let executer = executers.find((e)=>{
    return e.remotehostID=== task.remotehostID && e.useJobScheduler=== task.useJobScheduler
  });
  if( executer === undefined){
    executer = await createExecuter(task);
  }
  executer.submit(task);
}

module.exports.exec= exec;
