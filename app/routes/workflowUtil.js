"use strict";
const path = require("path");
const fs = require("fs-extra");
const { promisify } = require("util");
const glob = require("glob");
const { getDateString, readJsonGreedy } = require("./utility");
const { projectJsonFilename, componentJsonFilename } = require("../db/db");
const { getCwd } = require("./projectResource");
const { gitAdd } = require("./gitOperator");

function hasChild(node) {
  return node.type === "workflow" || node.type === "parameterStudy" || node.type === "for" || node.type === "while" || node.type === "foreach";
}

function isInitialNode(node) {
  if (node.previous.length > 0) {
    return false;
  }

  if (node.inputFiles.length > 0) {
    for (const inputFile of node.inputFiles) {
      const isConnected = inputFile.src.some((e)=>{
        if (e.srcNode === node.parent) {
          return false;
        }
        return e.srcNode !== null;
      });
      if (isConnected) {
        return false;
      }
    }
  }
  return true;
}

async function getComponentDir(projectRootDir, targetID) {
  const projectJson = await readJsonGreedy(path.resolve(projectRootDir, projectJsonFilename));
  const componentPath = projectJson.componentPath[targetID];
  return componentPath ? path.resolve(projectRootDir, componentPath) : componentPath;
}

async function getComponentRelativePath(projectRootDir, targetID, srcID) {
  const projectJson = await readJsonGreedy(path.resolve(projectRootDir, projectJsonFilename));
  const srcPath = srcID ? projectJson.componentPath[srcID] : projectRootDir;
  const targetPath = projectJson.componentPath[targetID];

  if (typeof targetPath === "undefined") {
    return targetPath;
  }
  return path.relative(srcPath, targetPath);
}

async function getComponent(projectRootDir, component) {
  let componentJson = component; //component is treated as component Json object by default
  if (typeof component === "string") {
    const isFilePath = await fs.pathExists(component);

    if (isFilePath) {
      //component is path of component Json file
      componentJson = await readJsonGreedy(component);
    } else {
      //component should be ID string
      const componentDir = await getComponentDir(projectRootDir, component);

      if (await fs.pathExists(componentDir)) {
        componentJson = await readJsonGreedy(path.resolve(componentDir, componentJsonFilename));
      } else {
        componentJson = null;
      }
    }
  }

  return componentJson;
}

async function getChildren(projectRootDir, parentID) {
  const dir = await getComponentDir(projectRootDir, parentID);
  if (!dir) {
    return [];
  }

  const children = await promisify(glob)(path.join(dir, "*", componentJsonFilename));
  if (children.length === 0) {
    return [];
  }

  const rt = await Promise.all(children.map((e)=>{
    return readJsonGreedy(e);
  }));

  return rt.filter((e)=>{
    return !e.subComponent;
  });
}

async function sendWorkflow(emit, projectRootDir) {
  const wf = await getComponent(projectRootDir, path.resolve(getCwd(projectRootDir), componentJsonFilename));
  const rt = Object.assign({}, wf);
  rt.descendants = await getChildren(projectRootDir, wf.ID);

  for (const child of rt.descendants) {
    if (child.handler) {
      delete child.handler;
    }

    if (hasChild(child)) {
      const grandson = await getChildren(projectRootDir, child.ID);
      child.descendants = grandson.map((e)=>{
        if (e.type === "task") {
          return { type: e.type, pos: e.pos, host: e.host, useJobScheduler: e.useJobScheduler };
        }
        return { type: e.type, pos: e.pos };
      });
    }
  }
  emit("workflow", rt);
}

//read and send projectJson
async function updateAndSendProjectJson(emit, projectRootDir, state) {
  const filename = path.resolve(projectRootDir, projectJsonFilename);
  const projectJson = await readJsonGreedy(filename);

  if (typeof state === "string" && projectJson.state !== state) {
    projectJson.state = state;
    projectJson.mtime = getDateString(true);
  }
  await fs.writeJson(filename, projectJson, { spaces: 4 });
  emit("projectJson", projectJson);
}

function componentJsonReplacer(key, value) {
  if (["handler", "doCleanup", "sbsID"].includes(key)) {
    //eslint-disable-next-line no-undefined
    return undefined;
  }
  return value;
}

//component can be one of "path of component Json file", "component json object", or "component's ID"
async function updateComponentJson(projectRootDir, component, modifier) {
  const componentJson = await getComponent(projectRootDir, component);

  if (typeof modifier === "function") {
    await modifier(componentJson);
  }

  //resolve component json filename from parenet dirname, component.name, and componentJsonFilename constant
  //to avoid using old path in componentPath when component's name is changed
  const parentDir = componentJson.parent ? await getComponentDir(projectRootDir, componentJson.parent) : projectRootDir;
  const filename = path.resolve(parentDir, componentJson.name, componentJsonFilename);
  await fs.writeJson(filename, componentJson, { spaces: 4, replacer: componentJsonReplacer });
  return gitAdd(projectRootDir, filename);
}

module.exports = {
  hasChild,
  isInitialNode,
  getComponentDir,
  getComponent,
  sendWorkflow,
  getChildren,
  updateAndSendProjectJson,
  updateComponentJson,
  getComponentRelativePath,
  componentJsonReplacer
};