"use strict";
const os = require("os");
const path = require("path");
const JsonArrayManager = require("./jsonArrayManager");
const configDir = path.resolve(__dirname, "../config");
const config = require(path.resolve(configDir, "server.json"));
const jobScheduler = require(path.resolve(configDir, "jobScheduler.json"));
const remotehostFilename = path.resolve(configDir, config.remotehostJsonFile);
const projectListFilename = path.resolve(configDir, config.projectListJsonFile);

let jupyterToken;
let actualJupyterPortNumber;

/**
 * @param token
 */
function setJupyterToken(token) {
  jupyterToken = token;
}

/**
 *
 */
function getJupyterToken() {
  return jupyterToken;
}

/**
 * @param port
 */
function setJupyterPort(port) {
  actualJupyterPortNumber = port;
}

/**
 *
 */
function getJupyterPort() {
  return actualJupyterPortNumber;
}
//export constants
module.exports.suffix = ".wheel";
module.exports.projectJsonFilename = "prj.wheel.json";
module.exports.componentJsonFilename = "cmp.wheel.json";
module.exports.statusFilename = "status.wheel.txt";
module.exports.keyFilename = path.resolve(configDir, "server.key");
module.exports.certFilename = path.resolve(configDir, "server.crt");

//export accessor to jupyter parameter
module.exports.setJupyterToken = setJupyterToken;
module.exports.getJupyterToken = getJupyterToken;
module.exports.setJupyterPort = setJupyterPort;
module.exports.getJupyterPort = getJupyterPort;

//re-export server settings
module.exports.interval = config.interval;
module.exports.port = config.port;
module.exports.rootDir = config.rootDir || os.homedir() || "/";
module.exports.notebookRoot = module.exports.rootDir;
module.exports.defaultCleanupRemoteRoot = config.defaultCleanupRemoteRoot;
module.exports.jupyter = config.jupyter;
module.exports.jupyterPort = config.jupyterPort;
module.exports.logFilename = config.logFilename;
module.exports.numLogFiles = config.numLogFiles;
module.exports.maxLogSize = config.maxLogSize;
module.exports.compressLogFile = config.compressLogFile;
module.exports.numJobOnLocal = config.numJobOnLocal;
module.exports.defaultTaskRetryCount = config.defaultTaskRetryCount;
module.exports.shutdownDelay = config.shutdownDelay;


module.exports.jobScheduler = jobScheduler;
module.exports.remoteHost = new JsonArrayManager(remotehostFilename);
module.exports.projectList = new JsonArrayManager(projectListFilename);
