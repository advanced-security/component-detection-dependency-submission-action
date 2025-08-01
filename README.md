# Component detection dependency submission action

This project provides component detection and dependency submission for both **GitHub Actions** and **Azure DevOps** platforms. It runs the [microsoft/component-detection](https://github.com/microsoft/component-detection) library to automate dependency extraction at build time and uploads the results to GitHub's dependency graph via the dependency submission API.

## Platform Support

- **GitHub Actions**: Run component detection and submit to the same repository's dependency graph
- **Azure DevOps**: Run component detection in ADO pipelines and submit to a specified GitHub repository

Both platforms provide enhanced Dependabot alerts and support for numerous package ecosystems.

## Configuration Options

All the following configuration options are available for both GitHub Actions and Azure DevOps platforms:

| Parameter | Description | Example |
| --- | --- | --- |
filePath | The path to the directory containing the environment files to upload. Defaults to Actions working directory. | `'.'`
directoryExclusionList | Filters out specific directories following a minimatch pattern. | `test`
detectorArgs | Comma separated list of properties that can affect the detectors execution, like EnableIfDefaultOff that allows a specific detector that is in beta to run, the format for this property is DetectorId=EnableIfDefaultOff, for example Pip=EnableIfDefaultOff. | `Pip=EnableIfDefaultOff`
dockerImagesToScan |Comma separated list of docker image names or hashes to execute container scanning on |  ubuntu:16.04,56bab49eef2ef07505f6a1b0d5bd3a601dfc3c76ad4460f24c91d6fa298369ab |
detectorsFilter | A comma separated list with the identifiers of the specific detectors to be used. | `Pip, RustCrateDetector`
detectorsCategories | A comma separated list with the categories of components that are going to be scanned. The detectors that are going to run are the ones that belongs to the categories. | `NuGet,Npm`
correlator | An optional identifier to distinguish between multiple dependency snapshots of the same type. Defaults to the [job_id](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_id) of the current job | `csharp-backend`

For more information: https://github.com/microsoft/component-detection

## GitHub Actions Usage

### Example workflow

```yaml
name: Component Detection

on:
  workflow_dispatch:
  push:

permissions:
  id-token: write
  contents: write

jobs:
  dependency-submission:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Component detection
        uses: advanced-security/component-detection-dependency-submission-action@v0.0.3
```

## Azure DevOps Usage

### Quick Start

```yaml
# azure-pipelines.yml
steps:
- task: component-detection-task@0
  displayName: 'Component Detection'
  inputs:
    githubRepository: 'your-org/your-repo'
    token: '$(GITHUB_TOKEN)'
```

### Azure DevOps Requirements

The Azure DevOps version requires:
- A GitHub repository where dependencies will be submitted
- A GitHub Personal Access Token with Contents write permissions

For detailed setup and usage instructions, see the [Azure DevOps README](ADO-README.md).

## Development

See [DEPLOYMENT.md](DEPLOYMENT.md) for information about building and deploying both versions.

# License
This project is licensed under the terms of the MIT open source license. Please refer to [MIT](LICENSE.md) for the full terms.
