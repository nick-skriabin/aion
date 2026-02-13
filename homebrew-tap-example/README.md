# Homebrew Tap Example

This directory contains example files for setting up your Homebrew tap repository.

## Setup

1. **Create a new repository** named `homebrew-tap` (e.g., `semos-labs/homebrew-tap`)

2. **Copy these files** to your new repository:
   ```
   homebrew-tap/
   ├── .github/workflows/update-formula.yml
   ├── Formula/aion.rb
   └── README.md  (optional, for your tap)
   ```

3. **Create a Personal Access Token (PAT)** in GitHub:
   - Go to Settings → Developer settings → Personal access tokens → Fine-grained tokens
   - Create a token with access to your `homebrew-tap` repository
   - Required permissions: **Contents** (Read and Write)

4. **Add the token to your aion repository**:
   - Go to `aion` repo → Settings → Secrets and variables → Actions
   - Create a new secret: `HOMEBREW_TAP_TOKEN` with your PAT

## How it works

When you push a tag like `v0.1.0` to the aion repository:

1. The release workflow builds binaries for all platforms
2. Creates a GitHub release with the binaries
3. Calculates SHA256 checksums for each binary
4. Triggers the `update-formula` workflow in your homebrew-tap repo
5. The tap workflow updates `Formula/aion.rb` with the new version and checksums
6. Commits and pushes the updated formula

## Users can then install with:

```bash
brew tap semos-labs/tap
brew install aion
```

## Manual Testing

You can manually trigger the update-formula workflow from the Actions tab in your homebrew-tap repo to test the setup.
