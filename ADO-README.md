# Component Detection for Azure DevOps

This Azure DevOps extension allows you to run Microsoft's component detection library in your Azure DevOps pipelines and submit the detected dependencies to GitHub's dependency graph.

## Overview

This task runs component detection against your repository and submits the discovered dependencies to a GitHub repository's dependency graph using the GitHub Dependency Submission API. This enables:

- **Enhanced Security**: Get Dependabot alerts for vulnerabilities in dependencies detected by component detection
- **Supply Chain Visibility**: Comprehensive dependency tracking across multiple package ecosystems
- **Cross-Platform Support**: Works with Azure DevOps while submitting to GitHub

## Key Features

- Supports all package ecosystems that component detection supports (npm, NuGet, Maven, pip, etc.)
- Automatic binary download of the latest component detection CLI
- Flexible configuration options for detection parameters
- Secure submission to GitHub using personal access tokens

## Prerequisites

1. **GitHub Repository**: A GitHub repository where you want to submit dependency information
2. **GitHub Token**: A GitHub Personal Access Token with `Contents` repository permissions (write)
3. **Azure DevOps Pipeline**: An Azure DevOps pipeline with access to your source code

## Usage

### Basic Usage

```yaml
# azure-pipelines.yml
trigger:
- main

pool:
  vmImage: 'ubuntu-latest'

steps:
- task: component-detection-task@0
  displayName: 'Component Detection'
  inputs:
    githubRepository: 'your-org/your-repo'
    token: '$(GITHUB_TOKEN)'
```

### Advanced Configuration

```yaml
steps:
- task: component-detection-task@0
  displayName: 'Component Detection with Custom Settings'
  inputs:
    githubRepository: 'your-org/your-repo'
    token: '$(GITHUB_TOKEN)'
    filePath: '$(Build.SourcesDirectory)/src'
    directoryExclusionList: 'node_modules,test'
    detectorsCategories: 'NuGet,Npm'
    correlator: 'backend-dependencies'
```

## Configuration Options

| Parameter | Description | Required | Default |
|-----------|-------------|----------|---------|
| `githubRepository` | GitHub repository to submit dependencies to (format: owner/repo) | Yes | |
| `token` | GitHub Personal Access Token with Contents write permissions | Yes | |
| `filePath` | Path to scan for dependencies | No | `$(Build.SourcesDirectory)` |
| `directoryExclusionList` | Directories to exclude (minimatch pattern) | No | |
| `detectorArgs` | Comma-separated detector arguments | No | |
| `dockerImagesToScan` | Docker images to scan | No | |
| `detectorsFilter` | Specific detectors to use | No | |
| `detectorsCategories` | Categories of detectors to run | No | |
| `correlator` | Identifier for dependency snapshots | No | Job name |
| `detector-name` | Custom detector name | No | |
| `detector-version` | Custom detector version | No | |
| `detector-url` | Custom detector URL | No | |
| `snapshot-sha` | Override commit SHA | No | |
| `snapshot-ref` | Override Git reference | No | |

## Setting Up GitHub Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Create a new token with `Contents` repository permissions (write)
3. Store the token as a pipeline variable in Azure DevOps:
   - Go to your pipeline → Edit → Variables
   - Add a new variable named `GITHUB_TOKEN`
   - Set the value to your GitHub token
   - Mark it as secret

## Supported Package Ecosystems

Component detection supports:
- **JavaScript**: npm, Yarn
- **.NET**: NuGet, .NET CLI
- **Java**: Maven, Gradle
- **Python**: pip, Poetry, conda
- **Ruby**: RubyGems, Bundler
- **Go**: Go modules
- **Rust**: Cargo
- **PHP**: Composer
- **C/C++**: vcpkg, Conan
- **Container Images**: Docker
- And more...

## How It Works

1. **Download**: The task downloads the latest component detection binary
2. **Scan**: Runs component detection against your specified directory
3. **Process**: Converts the detected components into dependency manifests
4. **Submit**: Submits the dependency snapshot to GitHub's dependency graph via API

## Troubleshooting

### Common Issues

**"githubRepository input is required"**
- Ensure you've specified the `githubRepository` parameter in the correct format: `owner/repo`

**"Failed to download latest release"**
- Check network connectivity and GitHub API access
- Verify the GitHub token has appropriate permissions

**"Failed to submit snapshot"**
- Verify the GitHub token has `Contents` write permissions for the target repository
- Check that the repository exists and is accessible

### Debug Mode

Enable debug logging by setting the system debug variable:

```yaml
variables:
  system.debug: true
```

## Architecture

This extension uses a platform abstraction layer that allows the same core component detection logic to work in both GitHub Actions and Azure DevOps environments. The key differences:

- **GitHub Actions**: Uses native GitHub context and submits to the same repository
- **Azure DevOps**: Requires explicit GitHub repository configuration and token

## Contributing

See the [main repository](https://github.com/advanced-security/component-detection-dependency-submission-action) for contribution guidelines.

## License

This project is licensed under the MIT License.
