const core = require("@actions/core");
const github = require("@actions/github");
const { context } = require("@actions/github/lib/utils");
const PinApi = require("./api");

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

const api = new PinApi(EVER_TOKEN);

api
  .deploy({
    pid: EVER_PROJECT_ID,
    name: EVER_PROJECT_NAME,
    plat: EVER_PROJECT_PLAT,
    path: BUILD_LOCATION,
  })
  .then(async (result) => {
    const { plat, hash, projLink } = result;
    core.setOutput("hash", hash);
    const uri = `https://${hash}.ipfs.4everland.io/`;
    core.setOutput("uri", uri);
    core.setOutput("projLink", projLink);
    console.log("project link", projLink);
    const GITHUB_TOKEN = core.getInput("GITHUB_TOKEN");
    const PR_NUM = Number(core.getInput("PULL_REQUEST_NUMBER"));
    if (GITHUB_TOKEN) {
      const body = `- ${plat} hash: ${hash}\n- ${plat} preview link: ${uri} \n - 4EVERLAND project link: ${projLink}`;
      const octokit = github.getOctokit(GITHUB_TOKEN);
      if (github.context.eventName == "pull_request") {
        await octokit.rest.issues.createComment({
          ...context.repo,
          issue_number: context.payload.pull_request.number,
          body,
        });
      } else if (PR_NUM != 0) {
        await octokit.rest.issues.createComment({
          ...context.repo,
          issue_number: PR_NUM,
          body,
        });
      } else {
        await octokit.rest.repos.createCommitComment({
          ...context.repo,
          commit_sha: github.context.sha,
          body: "This commit was deployed on 4EVERLAND.\n" + body,
        });
      }
    }
  })
  .catch((e) => {
    console.log("Pinning to 4everland failed with error");
    core.setFailed(e);
  });
