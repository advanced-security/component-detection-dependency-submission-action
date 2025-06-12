# Component detection dependency submission action

This GitHub Action runs the [microsoft/component-detection](https://github.com/microsoft/component-detection) library to automate dependency extraction at build time. It uses a combination of static and dynamic scanning to build a dependency tree and then uploads that to GitHub's dependency graph via the dependency submission API. This gives you more accurate Dependabot alerts, and support for a bunch of additional ecosystems.

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

### Configuration options

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

# License
This project is licensed under the terms of the MIT open source license. Please refer to [MIT](LICENSE.md) for the full terms.
