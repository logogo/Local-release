// eslint-disable-next-line import/no-commonjs
const execSync = require("child_process").execSync;

console.info(process.argv.slice(2), 222);

const [STORE_PREFIX, BUCKET_NAME, BUILD_ENV] = process.argv.slice(2);
const { UPLOADED_HOST, UPLOADED_FOLDER } = process.env;

console.info("STORE_PREFIX", STORE_PREFIX, UPLOADED_HOST, UPLOADED_FOLDER);
if (
  execSync("git status --porcelain")
    .toString()
    .trim()
) {
  // console.error("项目没提交干净");
  // throw new Error("项目没提交干净");
}
const COMMIT_ID = execSync("git rev-parse --short HEAD")
  .toString()
  .trim();

console.info(
  `build for ${STORE_PREFIX}, commit id: ${COMMIT_ID}, BUCKET_NAME is: ${BUCKET_NAME}`
);

const PUBLIC_URL = `https://${BUCKET_NAME}.s3.cn-north-1.jdcloud-oss.com/${STORE_PREFIX}/${COMMIT_ID}/`;
const PREFIX = `https://${BUCKET_NAME}.s3.cn-north-1.jdcloud-oss.com/${STORE_PREFIX}/`;

if (BUILD_ENV) {
  console.info(
    `PUBLIC_URL=${PUBLIC_URL} PREFIX=${PREFIX} ENV=${STORE_PREFIX} yarn build:${BUILD_ENV}`
  );
  execSync(
    `npx cross-env PUBLIC_URL=${PUBLIC_URL} PREFIX=${PREFIX} ENV=${STORE_PREFIX} yarn build:${BUILD_ENV}`
  );
} else {
  console.info(
    `PUBLIC_URL=${PUBLIC_URL} PREFIX=${PREFIX} ENV=${STORE_PREFIX} yarn build`
  );
  execSync(
    `npx cross-env PUBLIC_URL=${PUBLIC_URL} PREFIX=${PREFIX} ENV=${STORE_PREFIX} yarn build`
  );
}

console.info(`build webapp successfully PUBLIC_URL=${PUBLIC_URL}`);

execSync(
  `npx cross-env BUCKET_NAME=${BUCKET_NAME} STORE_PREFIX=${STORE_PREFIX} PATH_PREFIX=${STORE_PREFIX}/${COMMIT_ID} FOLDER_PATH=./${UPLOADED_FOLDER} node ./cdn.js`
);
console.info("upload to s3 successfully");
