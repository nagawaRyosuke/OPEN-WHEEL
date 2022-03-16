"use strict";
const path = require("path");
const fs = require("fs-extra");
const minimatch = require("minimatch");
const klaw = require("klaw");
const { gitAdd, gitRm, gitLFSTrack, gitLFSUntrack, isLFS } = require("../core/gitOperator2");
const { convertPathSep } = require("../core/pathUtils");
const { getUnusedPath } = require("../core/fileUtils.js");
const { escapeRegExp } = require("../lib/utility");
const fileBrowser = require("../core/fileBrowser");
const { getLogger } = require("../logSettings");
const logger = getLogger();
const { gitLFSSize, projectJsonFilename, componentJsonFilename, rootDir } = require("../db/db");

const oldProjectJsonFilename = "swf.prj.json";
const noDotFiles = /^[^.].*$/;
const allFiles = /.*/;
const exceptSystemFiles = new RegExp(`^(?!^.*(${escapeRegExp(projectJsonFilename)}|${escapeRegExp(componentJsonFilename)}|.git.*)$).*$`);
const projectJsonFileOnly = new RegExp(`^.*(?:${escapeRegExp(projectJsonFilename)}|${escapeRegExp(oldProjectJsonFilename)})$`);

/**
 * getFileList event handler
 * @param {string} projectRootDir - project root dir path for logger
 * @param {Object} msg - option parameters
 * @param {string} msg.path - directory path to be read
 * @param {string} msg.mode - mode flag. it must be one of dir, dirWithProjectJson, underComponent, SND
 * @param {Function} cb - call back function
 */
const onGetFileList = async(projectRootDir, msg, cb)=>{
  const target = msg.path ? path.normalize(convertPathSep(msg.path)) : rootDir;
  const request = target;

  const sendFilename = msg.mode !== "dir";
  const SND = msg.mode === "underComponent"; //send serial numberd content as SND or not
  const allFilter = msg.mode === "dir" || msg.mode === "dirWithProjectJson" ? noDotFiles : allFiles;
  const filterTable = {
    dirWithProjectJson: projectJsonFileOnly,
    underComponent: exceptSystemFiles,
    SND: exceptSystemFiles
  };
  const fileFilter = filterTable[msg.mode] || null;
  try {
    const result = await fileBrowser(target, {
      request,
      sendFilename,
      SND,
      filter: {
        all: allFilter,
        file: fileFilter,
        dir: null
      },
      withParentDir: false
    });
    return cb(result);
  } catch (e) {
    logger.error(projectRootDir, "error occurred during reading directory", e);
    return cb(null);
  }
};

const onGetSNDContents = async(projectRootDir, requestDir, glob, isDir, cb)=>{
  const modifiedRequestDir = path.normalize(convertPathSep(requestDir));
  logger.debug(projectRootDir, "getSNDContents in", modifiedRequestDir);

  try {
    const result = await fileBrowser(modifiedRequestDir, {
      request: requestDir,
      SND: false,
      sendDirname: isDir,
      sendFilename: !isDir,
      filter: {
        all: minimatch.makeRe(glob),
        file: exceptSystemFiles,
        dir: null
      }
    });
    return cb(result);
  } catch (e) {
    getLogger(projectRootDir).error(requestDir, "read failed", e);
    return cb(null);
  }
};

async function onCreateNewFile(projectRootDir, argFilename, cb) {
  const filename = convertPathSep(argFilename);

  try {
    await fs.writeFile(filename, "");
    await gitAdd(projectRootDir, filename);
  } catch (e) {
    logger.error(projectRootDir, "create new file failed", e);
    cb(null);
    return;
  }
  cb(filename);
}

async function onCreateNewDir(projectRootDir, argDirname, cb) {
  const dirname = convertPathSep(argDirname);

  try {
    await fs.mkdir(dirname);
    await fs.writeFile(path.resolve(dirname, ".gitkeep"), "");
    await gitAdd(projectRootDir, path.resolve(dirname, ".gitkeep"));
  } catch (e) {
    logger.error(projectRootDir, "create new directory failed", e);
    cb(null);
    return;
  }
  cb(dirname);
}

async function onRemoveFile(projectRootDir, target, cb) {
  try {
    await gitRm(projectRootDir, target);
    await fs.remove(target, { force: true });
  } catch (err) {
    getLogger(projectRootDir).warn(`removeFile failed: ${err}`);
    cb(false);
    return;
  }
  cb(true);
}
async function onRenameFile(projectRootDir, parentDir, argOldName, argNewName, cb) {
  const oldName = path.resolve(parentDir, argOldName);
  const newName = path.resolve(parentDir, argNewName);

  if (oldName === newName) {
    getLogger(projectRootDir).warn("rename to same file or directory name requested");
    cb(false);
    return;
  }

  if (await fs.pathExists(newName)) {
    getLogger(projectRootDir).error(newName, "is already exists");
    cb(false);
    return;
  }


  try {
    await gitRm(projectRootDir, oldName);
    const stats = await fs.stat(oldName);

    if (stats.isFile() && await isLFS(projectRootDir, oldName)) {
      await gitLFSUntrack(projectRootDir, oldName);
      await gitLFSTrack(projectRootDir, newName);
    } else {
      for await (const file of klaw(oldName)) {
        if (file.stats.isFile() && await isLFS(projectRootDir, file.path)) {
          await gitLFSUntrack(projectRootDir, file.path);
          const newAbsFilename = file.path.replace(oldName, newName);
          await gitLFSTrack(projectRootDir, newAbsFilename);
        }
      }
    }
    await fs.move(oldName, newName);
    await gitAdd(projectRootDir, newName);
  } catch (e) {
    const err = typeof e === "string" ? new Error(e) : e;
    err.path = parentDir;
    err.oldName = oldName;
    err.newName = newName;
    getLogger(projectRootDir).error("rename failed", err);
    cb(false);
    return;
  }
  cb(true);
}

const onUploadFileSaved = async(socket, event)=>{
  if (!event.file.success) {
    logger.error("file upload failed", event.file.meta.name);
  }
  const projectRootDir = event.file.meta.projectRootDir;
  const uploadDir = event.file.meta.currentDir;
  const absFilename = await getUnusedPath(uploadDir, event.file.meta.orgName);
  await fs.move(event.file.pathName, absFilename);
  const fileSizeMB = parseInt(event.file.size / 1024 / 1024, 10);
  logger.info(`upload completed ${absFilename} [${fileSizeMB > 1 ? `${fileSizeMB} MB` : `${event.file.size} Byte`}]`);

  if (fileSizeMB > gitLFSSize) {
    await gitLFSTrack(projectRootDir, absFilename);
  }
  await gitAdd(projectRootDir, absFilename);
  const result = await fileBrowser(path.dirname(absFilename), {
    request: path.dirname(absFilename),
    sendFilename: true,
    SND: true,
    filter: {
      all: noDotFiles,
      file: exceptSystemFiles,
      dir: null
    },
    withParentDir: false
  });

  socket.emit("fileList", result);
};


module.exports = {
  onGetFileList,
  onGetSNDContents,
  onCreateNewFile,
  onCreateNewDir,
  onRemoveFile,
  onRenameFile,
  onUploadFileSaved
};
