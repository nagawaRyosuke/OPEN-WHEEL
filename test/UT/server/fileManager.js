const path = require("path");
const fs = require("fs-extra");

// setup test framework
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
chai.use(require("sinon-chai"));
chai.use(require('chai-fs'));
const rewire = require("rewire");

//testee
const fileManager = rewire("../../../app/routes/fileManager");
const onGetFileList    = fileManager.__get__("onGetFileList");
const onGetSNDContents = fileManager.__get__("onGetSNDContents");
const onRemoveFile     = fileManager.__get__("onRemoveFile");
const onRenameFile     = fileManager.__get__("onRenameFile");
const onDownloadFile   = fileManager.__get__("onDownloadFile");
const onCreateNewFile  = fileManager.__get__("onCreateNewFile");
const onCreateNewDir   = fileManager.__get__("onCreateNewDir");

//stubs
const emit = sinon.stub();
const cb = sinon.stub();
// fileManager.__set__("logger", {error: console.log, warn: console.log, info: console.log, debug: console.log});//send all log to console
fileManager.__set__("logger", {error: ()=>{}, warn: ()=>{}, info: ()=>{}, debug: ()=>{}}); //default logger stub
fileManager.__set__("gitAdd", sinon.stub());

const testDirRoot = "WHEEL_TEST_TMP"

describe("fileManager UT", function(){
  beforeEach(async function(){
    cb.reset();
    emit.reset();
    await Promise.all([
      fs.ensureDir(path.join(testDirRoot, "foo")),
      fs.ensureDir(path.join(testDirRoot, "bar")),
      fs.ensureDir(path.join(testDirRoot, "baz")),
      fs.ensureDir(path.join(testDirRoot, "foo_0")),
      fs.outputFile(path.join(testDirRoot, "foo_1"), "foo_1"),
      fs.outputFile(path.join(testDirRoot, "foo_2"), "foo_2"),
      fs.outputFile(path.join(testDirRoot, "foo_3"), "foo_3"),
      fs.outputFile(path.join(testDirRoot, "huga_1_100"), "huga_1_100"),
      fs.outputFile(path.join(testDirRoot, "huga_1_200"), "huga_1_200"),
      fs.outputFile(path.join(testDirRoot, "huga_1_300"), "huga_1_300"),
      fs.outputFile(path.join(testDirRoot, "huga_2_99"), "huga_2_99"),
      fs.outputFile(path.join(testDirRoot, "huga_3_100"), "huga_3_100"),
      fs.outputFile(path.join(testDirRoot, "huga_4_100"), "huga_4_100"),
      fs.outputFile(path.join(testDirRoot, "huga_4_200"), "huga_4_200"),
      fs.outputFile(path.join(testDirRoot, "huga_4_300"), "huga_4_300")
    ]);
    await Promise.all([
      fs.ensureSymlink(path.join(testDirRoot, "foo"), path.join(testDirRoot, "linkfoo")),
      fs.ensureSymlink(path.join(testDirRoot, "bar"), path.join(testDirRoot, "linkbar")),
      fs.ensureSymlink(path.join(testDirRoot, "baz"), path.join(testDirRoot, "linkbaz")),
      fs.ensureSymlink(path.join(testDirRoot, "foo_1"), path.join(testDirRoot, "linkpiyo")),
      fs.ensureSymlink(path.join(testDirRoot, "foo_2"), path.join(testDirRoot, "linkpuyo")),
      fs.ensureSymlink(path.join(testDirRoot, "foo_3"), path.join(testDirRoot, "linkpoyo"))
    ]);
  });
  afterEach(async function(){
    await fs.remove(testDirRoot);
  });
  describe("#getFileList", function(){
    it("should send filelist", async function(){
      let uploaderDir;
      await onGetFileList(uploaderDir, emit, path.resolve(testDirRoot), cb);
      expect(cb).to.have.been.calledOnce;
      expect(cb).to.have.been.calledWith(true);
      expect(emit).to.have.been.calledOnce;
      expect(emit).to.have.been.calledWith("fileList");
      const emitted = emit.args[0][1];
      expect(emitted).to.eql([
        {"path": path.resolve(testDirRoot), "name": "bar", "type": "dir", "islink": false},
        {"path": path.resolve(testDirRoot), "name": "baz", "type": "dir", "islink": false},
        {"path": path.resolve(testDirRoot), "name": "foo", "type": "dir", "islink": false},
        {"path": path.resolve(testDirRoot), "name": "foo_0", "type": "dir", "islink": false},
        {"path": path.resolve(testDirRoot), "name": "linkbar", "type": "dir", "islink": true},
        {"path": path.resolve(testDirRoot), "name": "linkbaz", "type": "dir", "islink": true},
        {"path": path.resolve(testDirRoot), "name": "linkfoo", "type": "dir", "islink": true},
        {"path": path.resolve(testDirRoot), "name": "foo_*", "type": "snd", "islink": false},
        {"path": path.resolve(testDirRoot), "name": "huga_*_100", "type": "snd", "islink": false},
        {"path": path.resolve(testDirRoot), "name": "huga_*_200", "type": "snd", "islink": false},
        {"path": path.resolve(testDirRoot), "name": "huga_*_300", "type": "snd", "islink": false},
        {"path": path.resolve(testDirRoot), "name": "huga_1_*", "type": "snd", "islink": false},
        {"path": path.resolve(testDirRoot), "name": "huga_2_99", "type": "file", "islink": false},
        {"path": path.resolve(testDirRoot), "name": "huga_4_*", "type": "snd", "islink": false},
        {"path": path.resolve(testDirRoot), "name": "linkpiyo", "type": "file", "islink": true},
        {"path": path.resolve(testDirRoot), "name": "linkpoyo", "type": "file", "islink": true},
        {"path": path.resolve(testDirRoot), "name": "linkpuyo", "type": "file", "islink": true}
      ]);
    });
  });
  describe("#getSNDContents", function(){
    it("should send contens of SND", async function(){
      await onGetSNDContents(emit, testDirRoot, "huga_*_200", cb);
      expect(cb).to.have.been.calledOnce;
      expect(cb).to.have.been.calledWith(true);
      expect(emit).to.have.been.calledOnce;
      expect(emit).to.have.been.calledWith("fileList");
      expect(emit.args[0][1]).to.deep.equal([
        {"path": path.resolve(testDirRoot), "name": "huga_1_200", "type": "file", "islink": false},
        {"path": path.resolve(testDirRoot), "name": "huga_4_200", "type": "file", "islink": false},
      ]);
    });
  });
  describe("#removeFile", function(){
    it("should remove directory", async function(){
      await onRemoveFile(emit, "dummy", path.join(testDirRoot, "baz"), cb);
      expect(path.join(testDirRoot, "baz")).not.to.be.a.path();
      expect(cb).to.have.been.calledOnce;
      expect(cb).to.have.been.calledWith(true);
    });
    it("should remove reguler file", async function(){
      await onRemoveFile(emit, "dummy", path.join(testDirRoot, "foo_1"), cb);
      expect(path.join(testDirRoot, "foo_1")).not.to.be.a.path();
      expect(cb).to.have.been.calledOnce;
      expect(cb).to.have.been.calledWith(true);
    });
    it("should remove symlink to directory", async function(){
      await onRemoveFile(emit, "dummy", path.join(testDirRoot, "linkbar"), cb);
      expect(path.join(testDirRoot, "linkbar")).not.to.be.a.path();
      expect(cb).to.have.been.calledOnce;
      expect(cb).to.have.been.calledWith(true);
    });
    it("should remove symlink to file", async function(){
      await onRemoveFile(emit, "dummy", path.join(testDirRoot, "linkpiyo"), cb);
      expect(path.join(testDirRoot, "linkpiyo")).not.to.be.a.path();
      expect(cb).to.have.been.calledOnce;
      expect(cb).to.have.been.calledWith(true);
    });
  });
  describe("#renameFile", function(){
    it("should rename directory", async function(){
      await onRenameFile(emit, "dummy", {path: testDirRoot, oldName: "baz", newName: "hoge"}, cb);
      expect(cb).to.have.been.calledOnce;
      expect(cb).to.have.been.calledWith(true);
      expect(path.join(testDirRoot, "baz")).not.to.be.a.path();
      expect(path.join(testDirRoot, "hoge")).to.be.a.directory();
    });
    it("should rename reguler file", async function(){
      await onRenameFile(emit, "dummy", {path: testDirRoot, oldName: "foo_1", newName: "hoge"}, cb);
      expect(cb).to.have.been.calledOnce;
      expect(cb).to.have.been.calledWith(true);
      expect(path.join(testDirRoot, "foo_1")).not.to.be.a.path();
      expect(path.join(testDirRoot, "hoge")).to.be.a.file();
    });
    it("should rename symlink to directory", async function(){
      await onRenameFile(emit, "dummy", {path: testDirRoot, oldName: "linkbar", newName: "hoge"}, cb);
      expect(cb).to.have.been.calledOnce;
      expect(cb).to.have.been.calledWith(true);
      expect(path.join(testDirRoot, "linkbar")).not.to.be.a.path();
      expect(path.join(testDirRoot, "hoge")).to.be.a.directory();
    });
    it("should rename symlink to file", async function(){
      await onRenameFile(emit, "dummy", {path: testDirRoot, oldName: "linkpiyo", newName: "hoge"}, cb);
      expect(cb).to.have.been.calledOnce;
      expect(cb).to.have.been.calledWith(true);
      expect(path.join(testDirRoot, "linkpiyo")).not.to.be.a.path();
      expect(path.join(testDirRoot, "hoge")).to.be.a.file();
    });
  });
  describe("#downloadFile", function(){
    it("should send file", async function(){
      await onDownloadFile(emit, {path: testDirRoot, name: "foo_1"}, cb);
      expect(cb).to.have.been.calledOnce;
      expect(cb).to.have.been.calledWith(true);
      expect(emit).to.have.been.calledOnce;
      expect(emit).to.have.been.calledWith("downloadData");
      const sendData = emit.args[0][1];
      expect(sendData.toString()).to.equal("foo_1");
    });
    it("should not send directory", async function(){
      await onDownloadFile(emit, {path: testDirRoot, name: "foo"}, cb);
      expect(cb).to.have.been.calledOnce;
      expect(cb).to.have.been.calledWith(false);
      expect(emit).not.to.have.been.called;
    });
  });
  describe("#createNewFile", function(){
    it("should create new file by relative path", async function(){
      await onCreateNewFile(emit, "dummy", path.join(testDirRoot, "hoge"), cb);
      expect(path.join(testDirRoot, "hoge")).to.be.a.file().and.empty;
    });
    it("should create new file by absolute path", async function(){
      await onCreateNewFile(emit, "dummy", path.resolve(testDirRoot, "hoge"), cb);
      expect(path.join(testDirRoot, "hoge")).to.be.a.file().and.empty;
    });
  });
  describe("#createNewDir", async function(){
    it("should create new directory by relative path", async function(){
      await onCreateNewDir(emit, "dummy", path.join(testDirRoot, "hoge"), cb);
      expect(path.join(testDirRoot, "hoge")).to.be.a.directory().with.files([".gitkeep"]);
    });
    it("should create new directory by absolute path", async function(){
      await onCreateNewDir(emit, "dummy", path.resolve(testDirRoot, "hoge"), cb);
      expect(path.join(testDirRoot, "hoge")).to.be.a.directory().with.files([".gitkeep"]);
    });
  });
});
