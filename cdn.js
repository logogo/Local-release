/* eslint-disable @typescript-eslint/no-require-imports */
const AWS = require("aws-sdk"); // from AWS SDK
const fs = require("fs"); // from node.js
const path = require("path"); // from node.js
const sd = require("silly-datetime");

const {
  PATH_PREFIX,
  BUCKET_NAME,
  FOLDER_PATH,
  DRY_RUN,
  STORE_PREFIX
} = process.env;
const mime = require("mime-types");
let pkgVersion = require("./package.json").version || "0.0.0";

pkgVersion = pkgVersion.replace(/\./g, "");
const timeStr = sd.format(new Date(), "MMDD_HHmmss");
let filePrefix = `${pkgVersion}_${timeStr}`;
let rootFileName = "latest.html";
const ignoreFilePattern = [".DS_Store"];
if (!PATH_PREFIX) {
  console.error("need PATH_PREFIX");
  return;
}
if (!BUCKET_NAME) {
  console.error("need BUCKET_NAME");
  return;
}
if (BUCKET_NAME === "eepaas-public-pre1") {
  AWS.config.update({
    region: "cn-north-1",
    accessKeyId: "9D9A6D17DC18972578BE421198BC2352",
    secretAccessKey: "77F302EABE948BD6DFA4035C7F665DBA"
  });
} else {
  AWS.config.update({
    region: "cn-north-1",
    accessKeyId: "AD1320A2AB3EF05CE460E01928E3DC8F",
    secretAccessKey: "90D635CFB715E5E71E7495B25E3A645F"
  });
}
const pathPrefix = path.normalize(PATH_PREFIX); // path.normalize(`webapp/${PATH_PREFIX}/${COMMIT_ID}`);
const storePrefix = path.normalize(STORE_PREFIX);
// const latestPathPrefix = `webapp/${PATH_PREFIX}`;
// configuration
const config = {
  s3BucketName: BUCKET_NAME,
  folderPath: FOLDER_PATH || "./build" // path relative script's location
};
// initialize S3 client
const s3 = new AWS.S3({
  signatureVersion: "v4",
  endpoint: "https://s3.cn-north-1.jdcloud-oss.com"
});
// resolve full folder path
const buildFolderPath = path.join(__dirname, config.folderPath);
function uploadDir(distFolderPath) {
  // get of list of files from 'dist' directory
  fs.readdir(distFolderPath, (err, files) => {
    if (!files || files.length === 0) {
      console.log(
        `provided folder '${distFolderPath}' is empty or does not exist.`
      );
      console.log("Make sure your project was compiled!");
      return;
    }
    // for each file in the directory
    for (const fileName of files) {
      // get the full path of the file
      const filePath = path.join(distFolderPath, fileName);
      // ignore if directory
      if (fs.lstatSync(filePath).isDirectory()) {
        uploadDir(filePath);
        continue;
      }
      if (ignoreFilePattern.indexOf(fileName) >= 0) {
        continue;
      }
      // read file contents
      fs.readFile(filePath, (error, fileContent) => {
        // if unable to read file contents, throw exception
        if (error) {
          throw error;
        }
        const relPath = path.relative(buildFolderPath, filePath);
        const Key = path
          .normalize(`${pathPrefix}/${relPath}`)
          .replace(/\\/g, "/");
        const extName = path.extname(Key);
        const ContentType = mime.contentType(extName);
        if (DRY_RUN === "true") {
          console.log("->", Key, ContentType);
        } else {
          s3.putObject(
            {
              Bucket: config.s3BucketName,
              Key,
              Body: fileContent,
              ContentType
            },
            err => {
              if (err) {
                console.error("uploaded", Key, "error", err);
              } else {
                console.log(`Successfully uploaded '${Key}'!`);
              }
            }
          );
        }
        if (/index.html$/g.test(fileName)) {
          const latestHtmlPath = path
            .join(path.dirname(Key), "..", rootFileName)
            .replace(/\\/g, "/");
          console.log("latestHtmlPath~~~", latestHtmlPath);
          // const latestHtmlPath = latestPathPrefix + '/latest.html';
          if (DRY_RUN === "true") {
            console.log("-->", latestHtmlPath);
          } else {
            s3.putObject(
              {
                Bucket: config.s3BucketName,
                Key: latestHtmlPath,
                Body: fileContent,
                ContentType: "text/html; charset=utf-8"
              },
              err => {
                if (err) {
                  console.error("uploaded", latestHtmlPath, "error", err);
                } else {
                  // console.log(`Successfully uploaded '${latestHtmlPath}'!`);
                }
              }
            );
          }
        }
      });
    }
  });
}
// 获取html文件名
function getFilePrefix() {
  s3.listObjectsV2(
    {
      Bucket: config.s3BucketName,
      Delimiter: "/",
      Prefix: path.normalize(`${storePrefix}/`)
    },
    (err, data) => {
      if (err) {
        console.error("列出所有文件出错", "error", err);
      } else {
        console.log("列出所有文件", data);
        let { Contents: contentsArray } = data;
        contentsArray = contentsArray || [];
        // 原有目录中是否含有html文件
        let oldHasHtml = false;
        for (let i = 0; i < contentsArray.length; i++) {
          let itemKey = contentsArray[i].Key;
          if (itemKey.endsWith("html")) {
            oldHasHtml = true;
            rootFileName = itemKey.replace(
              path.normalize(`${storePrefix}/`),
              ""
            );
            bakFile(path.join(BUCKET_NAME, storePrefix, rootFileName));
            break;
          }
        }
        if (!oldHasHtml) {
          uploadDir(buildFolderPath);
        }
      }
    }
  );
}
// 备份原始文件
function bakFile(historyHtml) {
  console.log("historyHtml", historyHtml);
  s3.copyObject(
    {
      Bucket: config.s3BucketName,
      CopySource: historyHtml,
      Key: path.join(storePrefix, "./bak", filePrefix, rootFileName)
    },
    (err, data) => {
      if (err) {
        console.error("备份文件", "error", `${filePrefix}/rootFileName`, err);
      } else {
        console.log("备份文件完成");
        uploadDir(buildFolderPath);
      }
    }
  );
}
getFilePrefix();
