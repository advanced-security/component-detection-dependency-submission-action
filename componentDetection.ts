import * as github from '@actions/github'
import * as core from '@actions/core'
import fetch from 'node-fetch'
import tar from 'tar'

  // Get the latest release from the component-detection repo, download the tarball, and extract it
    export async function downloadLatestRelease() {
    const githubToken = core.getInput('token') || (await core.getIDToken());  
    const octokit = github.getOctokit(githubToken);
    const owner = "microsoft";
    const repo = "component-detection";

    try {
      octokit.rest.repos.getLatestRelease({
        owner, repo
      }).then((response) => {
        fetch(response.data.assets[0].browser_download_url).then((response) => {
          response.json().then((data) => {
            // Write the tarball to a file
            fs.writeFile('component-detection.tar.gz', data, (err: any) => {
              if (err) {  
                core.error(err);
              }
            });

            // Extract the tarball
            tar.x({ 
              file: 'component-detection.tar.gz',
              C: './'
            }).then(() => {
              core.info('Extracted tarball');
            } 
          })
        })
      });
    } catch (error: any) {
      core.error(error);
    } 


  }

}