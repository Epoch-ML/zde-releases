# ZDE Releases

This repository is the public distribution and updater trust boundary for the
Zerg Development Environment (ZDE). Private source remains in
**Epoch-ML/zerg**; this repository holds validated release requests, public
artifacts, the independent updater public key, and GitHub Pages feeds.

## Release flow

1. A protected **zde-v\*** or **zde-preview-v\*** source tag emits one
   deterministic JSON request artifact. Its timestamp is the canonical UTC
   rendering of the source commit timestamp. The source workflow has no public
   checkout, environment, secret, or cross-repository write authority.
2. A human submits and merges a pull request that adds only
   **requests/&lt;tag&gt;.json** as a single-parent commit, then creates the
   protected public tag at that exact request-addition commit. The public
   workflow is manually dispatched from **main** with the request path. It
   requires the remote tag to exist and peel to the request commit before it
   enters a build environment, then checks out the exact private source SHA and
   matching source tag and compares both channel updater keys byte for byte
   with the independent roots under [keys](keys/).
3. Source tests and audits run before any signing credentials are exposed. The
   macOS app is compiled with no updater or Apple secrets and packaged as a
   bounded, link-free source stage.
4. A fresh macOS job checks out only this public repository, validates and
   extracts the source archive with path, type, entry-count, compressed-size,
   and uncompressed-size limits, and never executes its payload. Preview apps
   are ad-hoc signed. Stable apps receive Developer ID signing, notarization,
   and stapling only after hostile-input validation; temporary credentials are
   deleted even after failure.
5. A separate Ubuntu job checks out only this public repository, downloads the
   finished app archive, and exposes the updater private key to a single Tauri
   signer command. Private source and the updater key never coexist.
6. The publisher creates a draft GitHub Release, uploads only missing assets,
   verifies exact names and bytes, and publishes it. A retry resumes only when
   release metadata, tag target, asset set, and every existing byte match. This
   job has release-write authority but no feed deploy credential.
7. After public release bytes compare exactly, a fresh read-only job enters the
   **zde-feed** environment. It revalidates the immutable request, tag, and
   signed feed inputs before committing only the channel feed to
   **release-data**. The official Pages deployment action publishes that exact
   tree, then the workflow compares the live HTTPS manifest. The feed is
   published last and cannot move to an older semantic version.

Updater feeds:

- Stable: https://epoch-ml.github.io/zde-releases/stable/latest.json
- Preview: https://epoch-ml.github.io/zde-releases/preview/latest.json
- Immutable metadata: CHANNEL/releases/VERSION.json

The legacy root **latest-stable.json** and **latest-canary.json** files are
preserved byte-for-byte. The old private updater key is unavailable, so
existing 0.1.2 clients need one manual installation of a v2 release before
channel updates can continue.

## Repository configuration

Repository-wide Actions secrets: **none**.

Build and Apple environments:

- **zde-preview-build** contains only **ZERG_SOURCE_DEPLOY_KEY**, the read-only
  deploy key for Epoch-ML/zerg.
- **zde-stable-build** contains only **ZERG_SOURCE_DEPLOY_KEY**.
- **zde-apple-preview** contains no secrets.
- **zde-apple-stable** contains:
  - **ZDE_APPLE_CERTIFICATE**
  - **ZDE_APPLE_CERTIFICATE_PASSWORD**
  - **ZDE_APPLE_SIGNING_IDENTITY**
  - **ZDE_APPLE_API_ISSUER**
  - **ZDE_APPLE_API_KEY_ID**
  - **ZDE_APPLE_API_PRIVATE_KEY**

Updater environments:

- **zde-preview-updater** contains:
  - **ZDE_PREVIEW_TAURI_SIGNING_PRIVATE_KEY**
  - **ZDE_PREVIEW_TAURI_SIGNING_PRIVATE_KEY_PASSWORD**
- **zde-stable-updater** contains:
  - **ZDE_STABLE_TAURI_SIGNING_PRIVATE_KEY**
  - **ZDE_STABLE_TAURI_SIGNING_PRIVATE_KEY_PASSWORD**
- **zde-feed** contains only **ZDE_FEED_DEPLOY_KEY**, scoped to publishing the
  protected **release-data** branch.

No build environment contains Apple or updater private keys. No Apple or
updater environment contains a source key, and neither signer can write the
feed. The GitHub Release publisher and feed promoter also run on separate
hosts: the publisher never enters **zde-feed**, and the feed promoter has only
`contents: read` plus the branch-scoped deploy key.

Preview and stable applications embed distinct updater roots:

- [keys/zde-preview-updater.pubkey](keys/zde-preview-updater.pubkey), key ID
  **F4EAB02A90B7A200**
- [keys/zde-stable-updater.pubkey](keys/zde-stable-updater.pubkey), key ID
  **4EF2F352888FE49B**

The stable feed can therefore never accept an archive signed by the preview
identity, even if an ad-hoc preview app is otherwise valid.

The private source repository has no desktop-release environment, public
repository deploy key, or repository-wide release secret. Its tag workflow
only uploads the deterministic request artifact for human review.

The stable Apple and updater environments require a human reviewer. Keep these controls enabled:

- Actions may write release contents only from the trusted workflow.
- Stable build and updater environments have required reviewers.
- Release and source tags cannot be updated or deleted.
- Only the owning humans may create **zde-v\*** and **zde-preview-v\*** public
  tags; Actions and deploy keys cannot bypass those tag rules.
- Immutable Releases is enabled.
- Main requires a pull request; only the owning human may bypass that rule.
- Main and release-data reject force pushes and deletion.
- GitHub Pages deploys through the pinned official Pages actions.

The public release request commit is itself immutable: its entire change is one
added request file. Manual retries resolve that original addition commit,
recheck the file bytes, and repeatedly verify the pre-existing public tag at
that commit. `gh release create --verify-tag` may create only the GitHub Release
record; the workflow never creates, moves, or pushes the tag.

Apple Developer ID, notarization API, and updater private keys must come from
the owning human/team accounts. Never commit, print, or transfer private key
material through release artifacts.

## Local verification

    npm ci
    npm audit --audit-level=moderate
    npm test
    npm run test:mutation:request
    actionlint .github/workflows/release.yml

Generated mutation and dependency directories are ignored.
