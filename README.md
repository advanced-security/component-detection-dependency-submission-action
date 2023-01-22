# Component detection action

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
        uses: jhutchings1/component-detection-action@v0.0.1
```        