"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var fs = require("fs");
var path = require("path");
var logger = require("./logger");
var serverConfig = require("./serverConfig");
/**
 * json file type
 */
var JsonFileType;
(function (JsonFileType) {
    JsonFileType[JsonFileType["Project"] = 0] = "Project";
    JsonFileType[JsonFileType["WorkFlow"] = 1] = "WorkFlow";
    JsonFileType[JsonFileType["Task"] = 2] = "Task";
    JsonFileType[JsonFileType["RemoteTask"] = 3] = "RemoteTask";
    JsonFileType[JsonFileType["Job"] = 4] = "Job";
    JsonFileType[JsonFileType["Loop"] = 5] = "Loop";
    JsonFileType[JsonFileType["If"] = 6] = "If";
    JsonFileType[JsonFileType["Else"] = 7] = "Else";
    JsonFileType[JsonFileType["Condition"] = 8] = "Condition";
    JsonFileType[JsonFileType["Break"] = 9] = "Break";
})(JsonFileType || (JsonFileType = {}));
/**
 * Utility for server
 */
var ServerUtility = (function () {
    function ServerUtility() {
    }
    ServerUtility.copyFile = function (path_src, path_dst) {
        if (!fs.existsSync(path_src)) {
            return;
        }
        var path_dst_file = path_dst;
        //if target is a directory a new file with the same name will be created
        if (fs.existsSync(path_dst) || fs.lstatSync(path_dst).isDirectory()) {
            path_dst_file = path.join(path_dst, path.basename(path_src));
        }
        if (fs.existsSync(path_dst_file)) {
            fs.unlinkSync(path_dst_file);
        }
        fs.linkSync(path_src, path_dst_file);
    };
    ServerUtility.copyFolder = function (path_src, path_dst) {
        if (!fs.existsSync(path_src)) {
            return;
        }
        if (!fs.existsSync(path_dst)) {
            fs.mkdirSync(path_dst);
        }
        //copy
        if (fs.lstatSync(path_src).isDirectory()) {
            var files = fs.readdirSync(path_src);
            files.forEach(function (name_base) {
                var path_src_child = path.join(path_src, name_base);
                if (fs.lstatSync(path_src_child).isDirectory()) {
                    ServerUtility.copyFolder(path_src_child, path.join(path_dst, name_base));
                }
                else {
                    ServerUtility.copyFile(path_src_child, path_dst);
                }
            });
        }
    };
    /**
     * get all host infomation
     * @param isSucceed execute callback function when process is succeed
     * @param ifError exexute callback function when process is failed
     * @returns none
     */
    ServerUtility.getHostInfo = function (ifSucceed, ifError) {
        fs.readFile(ServerUtility.getHostListPath(), function (err, data) {
            if (err) {
                logger.error(err);
                ifError();
                return;
            }
            try {
                var hostListJson = JSON.parse(data.toString());
                ifSucceed(hostListJson);
            }
            catch (error) {
                logger.error(error);
                ifError();
            }
        });
    };
    /**
     * delete host information
     * @param name delete host label name
     * @param isSucceed execute callback function when process is succeed
     * @param ifError exexute callback function when process is failed
     * @returns none
     */
    ServerUtility.deleteHostInfo = function (name, ifSucceed, ifError) {
        this.getHostInfo(function (remoteHostList) {
            remoteHostList = remoteHostList.filter(function (host) { return host.name != name; });
            var writeData = JSON.stringify(remoteHostList, null, '\t');
            fs.writeFile(ServerUtility.getHostListPath(), writeData, function (err) {
                if (err) {
                    logger.error(err);
                    ifError();
                }
                else {
                    ifSucceed(remoteHostList);
                }
            });
        }, ifError);
    };
    /**
     * add host information
     * @param addHostInfo add host information
     * @param isSucceed execute callback function when process is succeed
     * @param ifError exexute callback function when process is failed
     * @returns none
     */
    ServerUtility.addHostInfo = function (addHostInfo, ifSucceed, ifError) {
        this.getHostInfo(function (remoteHostList) {
            remoteHostList = remoteHostList.filter(function (host) { return host.name !== addHostInfo.name; });
            remoteHostList.push(addHostInfo);
            var writeData = JSON.stringify(remoteHostList, null, '\t');
            fs.writeFile(ServerUtility.getHostListPath(), writeData, function (err) {
                if (err) {
                    logger.error(err);
                    ifError();
                }
                else {
                    ifSucceed(remoteHostList);
                }
            });
        }, ifError);
    };
    /**
     *
     */
    ServerUtility.getHostListPath = function () {
        return path.join(__dirname, this.config.remotehost);
    };
    /**
     *
     */
    ServerUtility.readTemplateProjectJson = function () {
        var filepath = this.getTemplateFilePath(JsonFileType.Project);
        return this.readProjectJson(filepath);
    };
    /**
     *
     */
    ServerUtility.readTemplateWorkflowJson = function () {
        var filepath = this.getTemplateFilePath(JsonFileType.WorkFlow);
        return this.readWorkflowJson(filepath);
    };
    /**
     * read .prj.json file tree
     * @param filepath project json file (.proj.json file)
     * @return swf project json
     */
    ServerUtility.readProjectJson = function (filepath) {
        var regex = new RegExp("(?:" + this.config.extension.project.replace(/\./, '\.') + ")$");
        if (!filepath.match(regex)) {
            logger.error("file extension is not " + this.config.extension.project);
            return null;
        }
        var data = fs.readFileSync(filepath);
        var projectJson = JSON.parse(data.toString());
        return projectJson;
    };
    /**
     * read .wf.json file tree
     * @param path_task_file task json file (.wf.json or .tsk.json file or .lp.json)
     * @return swf task json
     */
    ServerUtility.readWorkflowJson = function (filepath) {
        var data = fs.readFileSync(filepath);
        var json = JSON.parse(data.toString());
        // if (json.type && json.type.match(/^(?:Task|Workflow)$/)) {
        return json;
        // }
        // logger.error(`file extension is not type of json`);
        // return null;
    };
    /**
     * read .wf.json file tree
     * @param workflowJsonFilepath task json file (.wf.json or .tsk.json file)
     * @return task json file
     */
    ServerUtility.createTreeJson = function (workflowJsonFilepath) {
        var _this = this;
        var parent = this.readWorkflowJson(workflowJsonFilepath);
        var parentDirname = path.dirname(workflowJsonFilepath);
        parent.children = [];
        if (parent.children_file) {
            parent.children_file.forEach(function (child, index) {
                var childFilePath = path.resolve(parentDirname, child.path);
                if (path.dirname(childFilePath).length <= parentDirname.length) {
                    logger.error("find circular reference. file=" + workflowJsonFilepath);
                }
                else {
                    var childJson = _this.createTreeJson(childFilePath);
                    if (childJson != null) {
                        parent.children.push(childJson);
                    }
                }
            });
        }
        return parent;
    };
    /**
     * create log node json
     * @param path_taskFile path json file (.wf.json or .tsk.json file)
     * @return swf project json object
     */
    ServerUtility.createLogJson = function (path_taskFile) {
        var _this = this;
        var workflowJson = this.readWorkflowJson(path_taskFile);
        var logJson = {
            name: workflowJson.name,
            path: path.dirname(path_taskFile),
            description: workflowJson.description,
            type: workflowJson.type,
            state: 'Planning',
            execution_start_date: '',
            execution_end_date: '',
            children: []
        };
        var parentDirname = path.dirname(path_taskFile);
        if (workflowJson.children_file) {
            workflowJson.children_file.forEach(function (child) {
                var path_childFile = path.join(parentDirname, child.path);
                if (path.dirname(path_childFile).length <= parentDirname.length) {
                    logger.error("find circular reference. file=" + path_taskFile);
                }
                else {
                    var childJson = _this.createLogJson(path_childFile);
                    if (childJson != null) {
                        logJson.children.push(childJson);
                    }
                }
            });
        }
        return logJson;
    };
    /**
     * read .wf.json file tree
     * @param path_project project json file (.prj.json)
     * @return project json file
     */
    ServerUtility.createProjectJson = function (path_project) {
        var projectJson = this.readProjectJson(path_project);
        var dir_project = path.dirname(path_project);
        var path_workflow = path.resolve(dir_project, projectJson.path_workflow);
        projectJson.log = this.createLogJson(path_workflow);
        return projectJson;
    };
    /**
     *
     * @param filepath
     * @param json
     * @param ifSucceed
     * @param isError
     */
    ServerUtility.writeJson = function (filepath, json, ifSucceed, isError) {
        fs.writeFile(filepath, JSON.stringify(json, null, '\t'), function (err) {
            if (err) {
                logger.error(err);
                if (isError) {
                    isError();
                }
                return;
            }
            if (ifSucceed) {
                ifSucceed();
            }
        });
    };
    /**
     * whether specified hostname is localhost or not
     * @param hostname hostname
     * @returns true(localhost) or false
     */
    ServerUtility.isLocalHost = function (hostname) {
        return (hostname === 'localhost') || (hostname === '127.0.0.1');
    };
    /**
     * whether platform is windows or not
     * @returns true(windows) or false
     */
    ServerUtility.isWindows = function () {
        return process.platform === 'win32';
    };
    /**
     * whether platform is linux or not
     * @returns true(linux) or false
     */
    ServerUtility.isLinux = function () {
        return process.platform === 'linux';
    };
    /**
     * get home directory
     * @returns directory path
     */
    ServerUtility.getHomeDir = function () {
        if (this.isWindows()) {
            return process.env.USERPROFILE;
        }
        else if (this.isLinux()) {
            return process.env.HOME;
        }
        else {
            throw new Error('undefined platform');
        }
    };
    /**
     *
     * @param fileType
     * @returns
     */
    ServerUtility.getTemplateFilePath = function (fileType) {
        return this.getTemplate(fileType).getPath();
    };
    /**
     *
     * @param filepath
     * @param fileType
     */
    ServerUtility.getTemplateFile = function (filepath, fileType) {
        var extension = this.getTemplate(fileType).getExtension();
        if (!filepath.match(new RegExp(extension.replace(/\./, '\.') + "$"))) {
            filepath += extension;
        }
        return filepath;
    };
    /**
     *
     * @param fileType
     */
    ServerUtility.getDefaultName = function (fileType) {
        var template = this.getTemplate(fileType);
        var extension = template.getExtension();
        return "" + this.config.default_filename + extension;
    };
    /**
     *
     * @param fileType
     */
    ServerUtility.getTemplate = function (fileType) {
        if (typeof fileType === 'string') {
            switch (fileType) {
                case this.config.json_types.workflow:
                    return new WorkflowTemplate();
                case this.config.json_types.task:
                    return new TaskTemplate();
                case this.config.json_types.loop:
                    return new LoopTemplate();
                case this.config.json_types.if:
                    return new IfTemplate();
                case this.config.json_types.else:
                    return new ElseTemplate();
                case this.config.json_types.break:
                    return new BreakTemplate();
                case this.config.json_types.remotetask:
                    return new RemoteTaskTemplate();
                case this.config.json_types.job:
                    return new JobTemplate();
                case this.config.json_types.condition:
                    return new ConditionTemplate();
                default:
                    throw new TypeError('file type is undefined');
            }
        }
        else {
            switch (fileType) {
                case JsonFileType.Project:
                    return new ProjectTemplate();
                case JsonFileType.WorkFlow:
                    return new WorkflowTemplate();
                case JsonFileType.Task:
                    return new TaskTemplate();
                case JsonFileType.Loop:
                    return new LoopTemplate();
                case JsonFileType.If:
                    return new IfTemplate();
                case JsonFileType.Else:
                    return new ElseTemplate();
                case JsonFileType.Break:
                    return new BreakTemplate();
                case JsonFileType.RemoteTask:
                    return new RemoteTaskTemplate();
                case JsonFileType.Job:
                    return new JobTemplate();
                case JsonFileType.Condition:
                    return new ConditionTemplate();
                default:
                    throw new TypeError('file type is undefined');
            }
        }
    };
    return ServerUtility;
}());
/**
 * config parameter
 */
ServerUtility.config = serverConfig.getConfig();
var TemplateBase = (function () {
    function TemplateBase() {
        this.config = serverConfig.getConfig();
    }
    TemplateBase.prototype.getExtension = function () {
        return this.extension;
    };
    TemplateBase.prototype.getPath = function () {
        return path.normalize(__dirname + "/" + this.path);
    };
    return TemplateBase;
}());
var ProjectTemplate = (function (_super) {
    __extends(ProjectTemplate, _super);
    function ProjectTemplate() {
        var _this = _super.call(this) || this;
        _this.extension = _this.config.extension.project;
        _this.path = _this.config.template.project;
        return _this;
    }
    return ProjectTemplate;
}(TemplateBase));
var TaskTemplate = (function (_super) {
    __extends(TaskTemplate, _super);
    function TaskTemplate() {
        var _this = _super.call(this) || this;
        _this.extension = _this.config.extension.task;
        _this.path = _this.config.template.task;
        return _this;
    }
    return TaskTemplate;
}(TemplateBase));
var WorkflowTemplate = (function (_super) {
    __extends(WorkflowTemplate, _super);
    function WorkflowTemplate() {
        var _this = _super.call(this) || this;
        _this.extension = _this.config.extension.workflow;
        _this.path = _this.config.template.workflow;
        return _this;
    }
    return WorkflowTemplate;
}(TemplateBase));
var LoopTemplate = (function (_super) {
    __extends(LoopTemplate, _super);
    function LoopTemplate() {
        var _this = _super.call(this) || this;
        _this.extension = _this.config.extension.loop;
        _this.path = _this.config.template.loop;
        return _this;
    }
    return LoopTemplate;
}(TemplateBase));
var IfTemplate = (function (_super) {
    __extends(IfTemplate, _super);
    function IfTemplate() {
        var _this = _super.call(this) || this;
        _this.extension = _this.config.extension.if;
        _this.path = _this.config.template.if;
        return _this;
    }
    return IfTemplate;
}(TemplateBase));
var ElseTemplate = (function (_super) {
    __extends(ElseTemplate, _super);
    function ElseTemplate() {
        var _this = _super.call(this) || this;
        _this.extension = _this.config.extension.else;
        _this.path = _this.config.template.else;
        return _this;
    }
    return ElseTemplate;
}(TemplateBase));
var BreakTemplate = (function (_super) {
    __extends(BreakTemplate, _super);
    function BreakTemplate() {
        var _this = _super.call(this) || this;
        _this.extension = _this.config.extension.break;
        _this.path = _this.config.template.break;
        return _this;
    }
    return BreakTemplate;
}(TemplateBase));
var RemoteTaskTemplate = (function (_super) {
    __extends(RemoteTaskTemplate, _super);
    function RemoteTaskTemplate() {
        var _this = _super.call(this) || this;
        _this.extension = _this.config.extension.remotetask;
        _this.path = _this.config.template.remotetask;
        return _this;
    }
    return RemoteTaskTemplate;
}(TemplateBase));
var JobTemplate = (function (_super) {
    __extends(JobTemplate, _super);
    function JobTemplate() {
        var _this = _super.call(this) || this;
        _this.extension = _this.config.extension.job;
        _this.path = _this.config.template.job;
        return _this;
    }
    return JobTemplate;
}(TemplateBase));
var ConditionTemplate = (function (_super) {
    __extends(ConditionTemplate, _super);
    function ConditionTemplate() {
        var _this = _super.call(this) || this;
        _this.extension = _this.config.extension.condition;
        _this.path = _this.config.template.condition;
        return _this;
    }
    return ConditionTemplate;
}(TemplateBase));
module.exports = ServerUtility;
//# sourceMappingURL=serverUtility.js.map