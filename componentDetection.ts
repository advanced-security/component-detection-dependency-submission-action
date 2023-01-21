import * as github from '@actions/github'
import * as core from '@actions/core'
import fetch from 'cross-fetch'
import tar from 'tar'
import fs from 'fs'
import dotenv from 'dotenv'
dotenv.config();

import * as exec from '@actions/exec';

export const componentDetectionPath = './component-detection';
// Get the latest release from the component-detection repo, download the tarball, and extract it
export async function downloadLatestRelease() {
  try {
    const downloadURL = await getLatestReleaseURL();
    const blob = await (await fetch(new URL(downloadURL))).blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Write the blob to a file
    await fs.writeFile(componentDetectionPath, buffer, {mode: 0o777, flag: 'w'}, 
    (err: any) => {
      if (err) {  
        core.error(err);
      }
    });
  } catch (error: any) {
    core.error(error);
  } 
}

// Run the component-detection CLI on the path specified
export async function runComponentDetection(path: string) {
  try {
    await exec.exec(`${componentDetectionPath} ${path}`);
  } catch (error: any) {
    core.error(error);
  }
}

async function getLatestReleaseURL(): Promise<string> {
  const githubToken  = core.getInput('token') || process.env.GITHUB_TOKEN2 || "";  
  const octokit = github.getOctokit(githubToken);
  const owner = "microsoft";
  const repo = "component-detection";

  const latestRelease = await octokit.rest.repos.getLatestRelease({
    owner, repo
  });

  var downloadURL: string = "";
  latestRelease.data.assets.forEach((asset: any) => {
    if (asset.name === "component-detection-linux-x64") {
      downloadURL = asset.browser_download_url;
    }
  });

  return downloadURL;
}