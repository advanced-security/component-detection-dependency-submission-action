# Deployment Guide

This repository now supports both GitHub Actions and Azure DevOps platforms through a platform abstraction layer.

## GitHub Actions (Original)

The GitHub Actions version continues to work as before:

```bash
npm install
npm run prepare
npm test
```

## Azure DevOps Extension

### Prerequisites

1. Install tfx-cli globally:
```bash
npm install -g tfx-cli
```

2. Install dependencies:
```bash
npm install
```

### Building the ADO Extension

1. Build the ADO-specific bundle:
```bash
npm run ado:build
```

2. Create the extension package:
```bash
npm run ado:package
```

This creates a `.vsix` file that can be uploaded to Azure DevOps.

### Publishing to Azure DevOps Marketplace

1. Get a Personal Access Token from Azure DevOps with Marketplace (Publish) scope
2. Login to tfx:
```bash
tfx login
```

3. Publish the extension:
```bash
tfx extension publish --manifest-globs vss-extension.json
```

### Installing in Azure DevOps

1. Go to Azure DevOps → Organization Settings → Extensions
2. Browse Marketplace or upload the .vsix file
3. Install the extension to your organization

### Usage in Azure Pipelines

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
    filePath: '$(Build.SourcesDirectory)'
```

## Architecture Notes

### Platform Abstraction

The code uses a platform abstraction layer with these interfaces:
- `ILoggerProvider`: Handles logging (core.debug vs console.log)
- `IInputProvider`: Handles input parameters (core.getInput vs process.env)
- `IContextProvider`: Handles repository context (GitHub context vs ADO variables)

### Key Differences

**GitHub Actions**:
- Uses `@actions/core` and `@actions/github`
- Automatically gets repository context
- Uses GitHub token from action context

**Azure DevOps**:
- Uses Azure DevOps task library patterns
- Requires explicit GitHub repository specification
- Requires explicit GitHub token input
- Creates mock GitHub context for dependency submission

### Testing

Tests are designed to work with both platforms by using the platform abstraction layer.

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test -- --watch
```
