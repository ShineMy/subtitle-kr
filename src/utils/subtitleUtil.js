// 错误文件处理：
// 1. 乱码的continue
// 2. 行尾序列LF的改成CRLF

import fs from "fs";
import path from "path";
import iconv from "iconv-lite";
import jschardet from "jschardet";

function getAllFilePath(dir) {
  let res = [];
  let res_ass = [];
  let res_txt = [];
  function traverse(dir) {
    fs.readdirSync(dir).forEach((file) => {
      const pathname = path.join(dir, file);
      if (fs.statSync(pathname).isDirectory()) {
        traverse(pathname);
      } else {
        if (path.extname(pathname) === ".srt") {
          res.push(pathname);
        } else if (path.extname(pathname) === ".ass") {
          res_ass.push(pathname);
        } else if (path.extname(pathname) === ".txt") {
          res_txt.push(pathname);
        }
      }
    });
  }
  traverse(dir);

  console.log("共计" + (res.length + res_ass.length) + "个字幕文件:");
  console.log("-------- " + res.length + "个srt文件 --------");
  console.log("-------- " + res_ass.length + "个ass文件 --------");
  console.log("-------- " + res_txt.length + "个txt文件 --------");
  return [...res, ...res_txt];
}

function getSubtitleJson(subtitleFilesPath) {
  let allFilePath = getAllFilePath(subtitleFilesPath);
  let resultJson = {};
  let filenameList = "";
  for (let i = 0; i < allFilePath.length; i++) {
    let movieObj = {};
    let filePath = allFilePath[i];
    let filename = path.basename(filePath).slice(0, -4);
    let filetype = path.extname(filePath);

    resultJson[filename] = movieObj;
    filenameList = filenameList + "\n" + filename;
    let fileData = fs.readFileSync(filePath);
    let encoding = jschardet.detect(fileData).encoding;
    fileData = iconv.decode(fileData, encoding);

    if (filetype === ".txt") {
      let fileDataArr = fileData.split("\r\n");
      for (let j = 0; j < fileDataArr.length; j++) {
        let lineData = fileDataArr[j];
        let index = j + 1;
        let timeline = lineData.slice(0, 10);
        let subtitle = lineData.slice(10);

        subtitle = subtitle.replace(/[\u202d]/g, "");

        if (index && timeline && subtitle) {
          movieObj[index.toString()] = {
            timeline,
            subtitle,
          };
        }
      }
    } else {
      let fileDataArr = fileData.split(/\r?\n\r?\n/);
      for (let j = 0; j < fileDataArr.length; j++) {
        let lineData = fileDataArr[j];
        let lineDataArr = lineData.split(/\r?\n/);
        let index = lineDataArr[0];
        let timeline = lineDataArr[1];
        let subtitle = "";

        // 字幕可能有多行
        for (let k = 2; k < lineDataArr.length; k++) {
          if (k === 2) {
            subtitle += lineDataArr[k];
          } else {
            subtitle += "\n" + lineDataArr[k];
          }
        }

        if (subtitle.length > 1000) {
          continue;
        }

        subtitle = subtitle.replace(/[\u202d]/g, "");

        if (index && timeline && subtitle) {
          movieObj[index.toString()] = {
            timeline,
            subtitle,
          };
        }
      }
    }
  }

  return resultJson;
}

export default getSubtitleJson;
