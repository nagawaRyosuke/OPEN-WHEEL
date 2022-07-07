/*
 * Copyright (c) Center for Computational Science, RIKEN All rights reserved.
 * Copyright (c) Research Institute for Information Technology(RIIT), Kyushu University. All rights reserved.
 * See License.txt in the project root for the license information.
 */
"use strict";
const path=require("path");
const PDFMerger = require("pdf-merger-js");
const glob=require("glob")

const merger = new PDFMerger();
const inputDir=path.resolve(__dirname,"../tmp");
const outputFile=path.resolve(__dirname,"../user_guide.pdf");

(async ()=>{
  const PDFs= glob.sync(`${inputDir}/**/*.pdf`)
  let readme;
  const inputFiles=PDFs.filter((e)=>{
    if(e.endsWith("readme.pdf")){
      readme=e;
      return false
    }
    return true
  })
  inputFiles.unshift(readme);
  for(const e of inputFiles){
    console.log(e);
    merger.add(e);
  }
  await merger.save(outputFile);
})();
