'use strict';
const fs = require('fs-extra');
const path = require('path');
const {promisify} = require('util');
const klaw = require('klaw');

const  express = require('express');
const  router = express.Router();

const {add} = require("./gitOperator");
const {getLogger} = require('../logSettings');
const logger = getLogger('rapid');

/**
 * search git directory
 */
function searchGitRepo(filename){
  const dir = path.dirname(filename);
  const trial = path.resolve(dir, '.git')
  try{
  var stats = fs.statSync(trial);
  }catch(e){
    if(e.code !== "ENOENT"){
      throw e;
    }
    return searchGitRepo(dir);
  }
  if(stats.isDirectory()){
      return dir;
  }else{
      return searchGitRepo(dir);
  }
}

module.exports = function(io){
  const sio = io.of('/rapid');
  sio.on('connect', (socket)=>{
    socket.on('getFileTree',(cwd)=>{
      const tree=[];
      tree.push({'id':cwd, 'parent':'#', 'text':cwd});
      klaw(cwd)
        .on('data', (item)=>{
          if(item.path === cwd) return;
          const r = {'id':item.path, 'parent':path.dirname(item.path), 'text':path.basename(item.path)};
          if(! item.stats.isDirectory()) r.icon='jstree-file';
          tree.push(r);
        })
        .on('end', ()=>{
          sio.to(socket.id).emit('tree', tree);
        });
    });
  });
  // メイン（エディタに編集対象のソースを入れて返す）
  router.get('/', async (req, res)=>{
    const cwd=req.query.path;
    const filename=req.query.filename;
    const parameterEdit=req.query.pm.toLowerCase()==="true";
    const target = path.resolve(cwd, filename);
    logger.debug('open file', target);

    const txt = await fs.readFile(target, 'utf-8');
    res.cookie('path', cwd);
    res.cookie('filename', filename);
    res.cookie('pm', parameterEdit);
    res.render('rapid.ejs',{
      target: txt,
      filename: filename,
      parameterEdit: parameterEdit
    });
  });

  // 保存（アップロードされた編集結果をファイルとして保存）
  router.post('/', function(req, res) {
    let cwd=req.body.path;
    let filename = path.resolve(cwd, req.body.filename);
    let data='';
    if(req.body.mode == 'json') {
      let parameter = {
        "target_file": req.body.filename,
        "target_param": req.body.param
      }
      parameter.target_param.forEach((param)=>{
        if(param.type === 'file'){
          param.list = param.list.map((e)=>{
            return path.basename(e);
          });
        }
        if(param.type === 'integer' || param.type === 'float'){
          if(param.list.length >0){
            param.type = "string";
          }
        }
      });

      filename = filename+'.json';
      data = JSON.stringify(parameter, undefined, 4);
    }else{
      data = req.body.text;
    }
    promisify(fs.writeFile)(filename, data)
      .then(()=>{
        const repoPath = searchGitRepo(filename);
        add(repoPath, filename);
      })
      .then(()=>{
        res.send('Ok: ' + filename + ' saved');
        logger.debug(filename, ' saved.');
      })
      .catch((err)=>{
        logger.error(filename, 'save failed!', err);
      });
  });
  return router;
}
