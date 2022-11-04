const core = require("@actions/core");
const github = require("@actions/github");
const { context } = require("@actions/github/lib/utils");
const Axios = require("axios");
const fs = require("fs");
const archiver = require("archiver");
const FormData = require("form-data");
const { CID } = require("multiformats/cid");

const EVER_TOKEN = core.getInput("EVER_TOKEN");
const EVER_PROJECT_ID = core.getInput("EVER_PROJECT_ID");
const EVER_PROJECT_NAME = core.getInput("EVER_PROJECT_NAME");
const EVER_PROJECT_PLAT = core.getInput("EVER_PROJECT_PLAT");
const BUILD_LOCATION = core.getInput("BUILD_LOCATION");

if (!EVER_TOKEN) core.setFailed(`EVER_TOKEN is required, but missing`);
if (!EVER_PROJECT_ID && !EVER_PROJECT_NAME)
  core.setFailed(
    `EVER_PROJECT_ID or EVER_PROJECT_NAME is required, but missing`
  );
if (!BUILD_LOCATION) core.setFailed(`BUILD_LOCATION is required, but missing`);

const axios = Axios.create({
  baseURL: "https://cli-api.4everland.org",
  headers: {
    token: EVER_TOKEN,
  },
  maxBodyLength: Infinity,
});

function postApi(url, data, opt) {
  return axios.post(url, data, {
    headers: {
      "Content-Type": `multipart/form-data; boundary=${data._boundary}`,
    },
    ...opt,
  });
}

const pinTo4everland = async () => {
  let pid = EVER_PROJECT_ID;
  if (!pid) {
    let data = new FormData();
    data.append("mode", 1);
    data.append("name", EVER_PROJECT_NAME);
    data.append("platform", EVER_PROJECT_PLAT || "IPFS");
    const res = await postApi("/project", data);
    if (res.data.code != 200) {
      console.log(res.data);
      throw new Error(res.data.message);
    }
    pid = res.data.content.projectId;
  }
  let data = new FormData();
  data.append("projectId", pid);
  console.log("zip...");
  const zipPath = await zipProject(BUILD_LOCATION);
  console.log("zip", zipPath);
  let file = fs.createReadStream(zipPath);
  data.append("file", file);
  console.log("deploy...");
  const res = await postApi(`/deploy`, data, {
    onUploadProgress: (progressEvent) => {
      console.log(progressEvent);
    },
  });
  fs.unlinkSync(zipPath);
  console.log("deploy end", res.data);
  if (res.data.code != 200) {
    throw new Error(res.data.message);
  }
  let hash = res.data.content.fileHash;
  if (/^Qm/i.test(hash)) {
    hash = CID.parse(hash).toV1().toString();
  }

  return {
    hash,
    projLink: `https://dashboard.4everland.org/hosting/project/${
      EVER_PROJECT_NAME || pid
    }/${pid}`,
  };
};

function zipProject(dirPath) {
  if (!fs.existsSync(dirPath)) {
    throw new Error("File path does not exist:" + dirPath);
  }
  return new Promise((resolve, reject) => {
    const zipPath = dirPath + "/4ever-hosting.zip";
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    output.on("close", function () {
      resolve(zipPath);
    });
    archive.on("error", function (error) {
      reject(error);
    });
    archive.pipe(output);
    archive.directory(dirPath, false);
    archive.finalize();
  });
}

pinTo4everland()
  .then(async (result) => {
    const { hash, projLink } = result;
    core.setOutput("hash", hash);
    const uri = `https://${hash}.ipfs.4everland.io/`;
    core.setOutput("uri", uri);
    core.setOutput("projLink", projLink);
    const GITHUB_TOKEN = core.getInput("GITHUB_TOKEN");
    const PR_NUM = Number(core.getInput("PULL_REQUEST_NUMBER"));
    if (GITHUB_TOKEN) {
      const octokit = github.getOctokit(GITHUB_TOKEN);
      if (github.context.eventName == "pull_request") {
        await octokit.rest.issues.createComment({
          ...context.repo,
          issue_number: context.payload.pull_request.number,
          body: `- Ipfs hash: ${hash}\n- Ipfs preview link: ${uri}`,
        });
      } else if (PR_NUM != 0) {
        await octokit.rest.issues.createComment({
          ...context.repo,
          issue_number: PR_NUM,
          body: `- Ipfs hash: ${hash}\n- Ipfs preview link: ${uri}`,
        });
      } else {
        await octokit.rest.repos.createCommitComment({
          ...context.repo,
          commit_sha: github.context.sha,
          body: `This commit was deployed on ipfs\n- ipfs hash: ${hash}\n- ipfs preview link: ${uri}`,
        });
      }
    }
  })
  .catch((e) => {
    console.log("Pinning to 4everland failed with error");
    core.setFailed(e);
  });
