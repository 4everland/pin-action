const Axios = require("axios");
const FormData = require("form-data");
const archiver = require("archiver");
const fs = require("fs");
const { CID } = require("multiformats/cid");

class PinApi {
  constructor(token) {
    this.axios = Axios.create({
      baseURL: "https://cli-api.4everland.org",
      headers: {
        token,
      },
      maxBodyLength: Infinity,
    });
  }

  async deploy(body) {
    let { pid } = body;
    const plat = body.plat || "IPFS";
    if (!pid) {
      let data = new FormData();
      data.append("mode", 1);
      data.append("name", body.name);
      data.append("platform", plat);
      const con = await this.postApi("/project", data);
      pid = con.projectId;
    }
    let data = new FormData();
    data.append("projectId", pid);
    const zipPath = await this.zipProject(body.path);
    let file = fs.createReadStream(zipPath);
    data.append("file", file);
    console.log("deploy...");
    const con = await this.postApi(`/deploy`, data);
    fs.unlinkSync(zipPath);
    console.log("deployd", con);
    let hash = con.fileHash;
    if (/^Qm/i.test(hash)) {
      hash = CID.parse(hash).toV1().toString();
    }
    return {
      plat,
      hash,
      uri: this.getHashLink(hash, plat),
      projLink: `https://dashboard.4everland.org/hosting/project/${
        body.name || "project"
      }/${pid}`,
    };
  }

  getHashLink(cid, plat) {
    if (!cid) return "";
    if (plat == "IC") return `https://${cid}.raw.ic0.app/`;
    if (plat == "AR") return `https://arweave.net/${cid}`;
    return `https://${cid}.ipfs.4everland.io`;
  }

  async postApi(url, body, opt) {
    const { data } = await this.axios.post(url, body, {
      headers: {
        "Content-Type": `multipart/form-data; boundary=${body._boundary}`,
      },
      ...opt,
    });
    if (data.code != 200) {
      throw new Error(data.message);
    }
    return data.content;
  }

  zipProject(dirPath) {
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
}

module.exports = PinApi;
