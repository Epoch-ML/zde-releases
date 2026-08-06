import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const workflow = await readFile(
  new URL("../.github/workflows/release.yml", import.meta.url),
  "utf8",
);

describe("ZDE release workflow contract", () => {
  it("serializes releases and validates one immutable request", () => {
    const triggerBlock = workflow.slice(
      workflow.indexOf("on:"),
      workflow.indexOf("\npermissions:"),
    );
    assert.match(triggerBlock, /workflow_dispatch:/);
    assert.doesNotMatch(triggerBlock, /push:/);
    assert.match(workflow, /group: zde-v2-release/);
    assert.match(workflow, /cancel-in-progress: false/);
    assert.match(workflow, /node scripts\/release-request\.mjs/);
  });

  it("binds manual main dispatch to an immutable request and pre-existing tag", () => {
    assert.match(workflow, /GITHUB_REF.*refs\/heads\/main/);
    assert.match(workflow, /DISPATCH_REQUEST/);
    assert.match(workflow, /git diff --name-status --no-renames -z/);
    assert.match(workflow, /git log --format=%H --diff-filter=A/);
    assert.match(workflow, /request_commit/);
    assert.match(workflow, /cmp --silent/);
    assert.match(workflow, /git ls-remote .*--tags origin/);
    assert.match(workflow, /refs\/tags\/\$RELEASE_TAG\^\{\}/);
    assert.match(workflow, /tag_target.*request_commit/s);
    const tagCheck = workflow.indexOf("Require the pre-existing public release tag");
    const build = workflow.indexOf("\n  build-macos:");
    assert.ok(tagCheck > 0 && tagCheck < build);
  });

  it("installs and verifies locked validator dependencies before reading a request", () => {
    const validateStart = workflow.indexOf("\n  validate:");
    const buildStart = workflow.indexOf("\n  build-macos:");
    const validateJob = workflow.slice(validateStart, buildStart);
    const install = validateJob.indexOf(
      "Install and test the public request validator",
    );
    const requestValidation = validateJob.indexOf(
      "Validate request schema and provenance",
    );

    assert.ok(install > 0 && install < requestValidation);
    assert.match(
      validateJob,
      /npm ci --ignore-scripts --no-audit --no-fund/,
    );
    assert.match(validateJob, /npm audit --audit-level=moderate/);
    assert.match(validateJob, /npm test/);
  });

  it("checks out the exact tagged source through the read-only deploy key", () => {
    assert.match(workflow, /ZERG_SOURCE_DEPLOY_KEY/);
    assert.match(workflow, /api\.github\.com\/meta/);
    assert.match(workflow, /git init source/);
    assert.match(workflow, /source_sha/);
    assert.match(workflow, /source_ref/);
    assert.match(workflow, /\^\{commit\}/);
    assert.match(workflow, /git -C source show -s --format=%ct "\$SOURCE_SHA"/);
    assert.match(workflow, /source_commit_requested_at/);
    assert.match(workflow, /source_commit_requested_at.*ZDE_RELEASE_DATE/s);
    assert.match(workflow, /Delete ephemeral source deploy key/);
  });

  it("fetches only requested refs and never hydrates unrelated source LFS objects", () => {
    const checkoutStart = workflow.indexOf(
      "Check out the exact SHA and matching source tag",
    );
    const cleanupStart = workflow.indexOf(
      "Delete ephemeral source deploy key",
    );
    const checkoutStep = workflow.slice(checkoutStart, cleanupStart);

    assert.equal(
      checkoutStep.match(/git -C source fetch --no-tags/g)?.length,
      2,
    );
    assert.match(
      checkoutStep,
      /GIT_LFS_SKIP_SMUDGE=1 git -C source checkout --detach "\$SOURCE_SHA"/,
    );
  });

  it("separates preview ad-hoc signing from fail-closed stable credentials", () => {
    assert.match(workflow, /identity="-"/);
    for (const name of [
      "ZDE_APPLE_CERTIFICATE",
      "ZDE_APPLE_CERTIFICATE_PASSWORD",
      "ZDE_APPLE_SIGNING_IDENTITY",
      "ZDE_APPLE_API_ISSUER",
      "ZDE_APPLE_API_KEY_ID",
      "ZDE_APPLE_API_PRIVATE_KEY",
      "ZDE_PREVIEW_TAURI_SIGNING_PRIVATE_KEY",
      "ZDE_PREVIEW_TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
      "ZDE_STABLE_TAURI_SIGNING_PRIVATE_KEY",
      "ZDE_STABLE_TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
    ]) {
      assert.match(workflow, new RegExp(name));
    }
    assert.match(workflow, /runs-on: macos-15/);
    assert.match(workflow, /xcrun stapler validate/);
    for (const environment of [
      "zde-preview-build",
      "zde-stable-build",
      "zde-apple-preview",
      "zde-apple-stable",
      "zde-preview-updater",
      "zde-stable-updater",
    ]) {
      assert.match(workflow, new RegExp(environment));
    }
  });

  it("tests, audits, signs, and verifies before publishing", () => {
    assert.match(workflow, /npm audit --omit=dev --audit-level=moderate/);
    assert.match(workflow, /cargo-audit --version 0\.22\.2/);
    assert.match(workflow, /npm test/);
    assert.match(workflow, /npm run build/);
    assert.match(workflow, /cargo clippy/);
    assert.match(workflow, /minisign -Vm/);
    assert.match(workflow, /sha256sum -c checksums\.txt/);
    assert.match(workflow, /scripts\/package-macos\.mjs/);
  });

  it("selects one source app and creates one signed disk image on the Apple host", () => {
    assert.match(workflow, /find "\$bundle_root\/macos" -maxdepth 1 -type d -name '\*\.app'/);
    assert.match(workflow, /"\$\{#apps\[@\]\}" -ne 1/);
    assert.match(workflow, /hdiutil create/);
    assert.match(workflow, /ZDE_\$\{VERSION\}_aarch64\.dmg/);
  });

  it("publishes immutable assets and only channel-scoped v2 Pages feeds", () => {
    assert.match(workflow, /gh release create/);
    assert.match(workflow, /curl --fail --location/);
    assert.match(workflow, /cmp --silent/);
    assert.match(workflow, /ref: release-data/);
    assert.match(workflow, /node release-repository\/scripts\/feed-policy\.mjs/);
    assert.match(workflow, /latest-stable\.json/);
    assert.match(workflow, /latest-canary\.json/);
    assert.match(workflow, /Legacy root feeds changed/);
    assert.match(workflow, /encodeURIComponent\(process\.env\.RELEASE_TAG\)/);
    assert.match(workflow, /encodeURIComponent\(process\.argv\[1\]\)/);
  });

  it("deploys the feed through the official Pages workflow before HTTPS verification", () => {
    assert.match(
      workflow,
      /actions\/configure-pages@983d7736d9b0ae728b81ab479565c72886d7745b/,
    );
    assert.match(
      workflow,
      /actions\/upload-pages-artifact@56afc609e74202658d3ffba0e8f6dda462b719fa/,
    );
    assert.match(
      workflow,
      /actions\/deploy-pages@cd2ce8fcbc39b97be8ca5fce6e763baed58fa128/,
    );
    const deployJob = workflow.indexOf("deploy-pages:");
    const deployAction = workflow.indexOf("actions/deploy-pages@");
    const httpsVerification = workflow.indexOf(
      "Verify the published channel manifest over HTTPS",
    );
    assert.ok(deployJob > 0);
    assert.ok(deployJob < deployAction);
    assert.ok(deployAction < httpsVerification);
  });

  it("resumes after a post-release failure without ever creating a tag", () => {
    assert.match(workflow, /Verify the tag and create or resume the immutable GitHub Release/);
    assert.match(workflow, /expected_prerelease/);
    assert.match(workflow, /remote-asset-names\.txt/);
    assert.match(workflow, /diff --unified/);
    assert.match(workflow, /Existing release metadata does not match/);
    assert.match(workflow, /release\.body/);
    assert.match(workflow, /gh release create "\$\{create_args\[@\]\}"/);
    assert.match(workflow, /--verify-tag/);
    assert.doesNotMatch(workflow, /--target "\$REQUEST_COMMIT"/);
    assert.doesNotMatch(workflow, /git tag(?:\s|$)/);
    assert.doesNotMatch(workflow, /git push[^\n]*refs\/tags/);
    assert.match(workflow, /--draft/);
    assert.match(workflow, /gh release upload/);
    assert.match(workflow, /gh release edit "\$RELEASE_TAG"/);
    assert.match(workflow, /--draft=false/);
    assert.match(workflow, /\.immutable == true/);
    assert.match(workflow, /GitHub did not mark the published release immutable/);
    assert.match(workflow, /refs\/tags\/\$RELEASE_TAG:refs\/tags\/\$RELEASE_TAG/);
    assert.match(workflow, /refs\/tags\/\$\{RELEASE_TAG\}\^\{commit\}/);
    assert.doesNotMatch(workflow, /Release .* already exists; assets are immutable/);

    const create = workflow.indexOf("gh release create");
    const upload = workflow.indexOf("gh release upload");
    const complete = workflow.indexOf("diff --unified");
    const publish = workflow.indexOf("gh release edit");
    const immutable = workflow.indexOf(
      "GitHub did not mark the published release immutable",
    );
    const publicDownload = workflow.indexOf(
      "Download every public asset over HTTPS and compare bytes",
    );
    const feed = workflow.indexOf("Stage only the channel-scoped v2 Pages feed");
    assert.ok(create < upload);
    assert.ok(upload < complete);
    assert.ok(complete < publish);
    assert.ok(publish < immutable);
    assert.ok(immutable < publicDownload);
    assert.ok(publish < publicDownload);
    assert.ok(publicDownload < feed);
  });

  it("isolates updater signing from private source and pins GitHub-owned actions", () => {
    assert.doesNotMatch(workflow, /uses: actions\/[A-Za-z0-9_-]+@v\d/);
    assert.doesNotMatch(workflow, /dtolnay\/rust-toolchain/);
    assert.match(workflow, /rustup toolchain install 1\.88\.0/);
    const signingSecretUses = workflow.match(
      /secrets\.ZDE_(?:PREVIEW|STABLE)_TAURI_SIGNING_PRIVATE_KEY(?:_PASSWORD)?/g,
    ) ?? [];
    assert.equal(signingSecretUses.length, 4);
    const jobEnv = workflow.match(/build-macos:[\s\S]*?steps:/)?.[0] ?? "";
    assert.doesNotMatch(jobEnv, /TAURI_SIGNING_PRIVATE_KEY/);
    const compile = workflow.indexOf(
      "Build the unsigned app without release signing credentials",
    );
    const signJob = workflow.indexOf("sign-updater:");
    const signingSecrets = workflow.indexOf(
      "secrets.ZDE_STABLE_TAURI_SIGNING_PRIVATE_KEY",
    );
    assert.ok(compile < signJob);
    assert.ok(signJob < signingSecrets);
    const signerJob = workflow.slice(signJob, workflow.indexOf("\n  publish:"));
    assert.doesNotMatch(signerJob, /SOURCE_DEPLOY_KEY/);
    assert.doesNotMatch(signerJob, /source\/zde/);
    assert.match(signerJob, /npm exec --offline -- tauri signer sign/);
    assert.match(workflow, /createUpdaterArtifacts, false/);
  });

  it("uses fresh source, Apple, and updater hosts with disjoint credentials", () => {
    const buildStart = workflow.indexOf("\n  build-macos:");
    const appleStart = workflow.indexOf("\n  apple-sign:");
    const updaterStart = workflow.indexOf("\n  sign-updater:");
    const publishStart = workflow.indexOf("\n  publish:");
    assert.ok(buildStart > 0 && appleStart > buildStart);
    assert.ok(updaterStart > appleStart && publishStart > updaterStart);

    const buildJob = workflow.slice(buildStart, appleStart);
    const appleJob = workflow.slice(appleStart, updaterStart);
    const updaterJob = workflow.slice(updaterStart, publishStart);
    assert.match(buildJob, /zde-(stable|preview)-build/);
    assert.match(buildJob, /--no-sign/);
    assert.doesNotMatch(buildJob, /ZDE_APPLE_|TAURI_SIGNING_PRIVATE_KEY|codesign|notarytool/);
    assert.match(appleJob, /zde-apple-/);
    assert.match(appleJob, /scripts\/extract-macos-stage\.mjs/);
    assert.match(appleJob, /ZDE_APPLE_CERTIFICATE/);
    assert.match(appleJob, /codesign/);
    assert.match(appleJob, /notarytool/);
    assert.doesNotMatch(appleJob, /ZERG_SOURCE_DEPLOY_KEY|source\/zde|git init source/);
    assert.match(updaterJob, /ZDE_PREVIEW_TAURI_SIGNING_PRIVATE_KEY/);
    assert.match(updaterJob, /ZDE_STABLE_TAURI_SIGNING_PRIVATE_KEY/);
    assert.doesNotMatch(updaterJob, /ZERG_SOURCE_DEPLOY_KEY|ZDE_APPLE_|source\/zde/);
  });

  it("binds every channel to a distinct embedded and signing trust root", () => {
    assert.match(workflow, /keys\/zde-preview-updater\.pubkey/);
    assert.match(workflow, /keys\/zde-stable-updater\.pubkey/);
    assert.match(workflow, /updater-preview\.pubkey/);
    assert.match(workflow, /updater-stable\.pubkey/);
    assert.doesNotMatch(workflow, /keys\/zde-updater-v2\.pubkey/);
    assert.doesNotMatch(workflow, /src-tauri\/updater-v2\.pubkey/);
  });

  it("treats source archives as hostile before Apple credentials are imported", () => {
    const extract = workflow.indexOf("Verify and extract the hostile source stage");
    const appleSecrets = workflow.indexOf(
      "ZDE_APPLE_CERTIFICATE: ${{ secrets.ZDE_APPLE_CERTIFICATE }}",
    );
    assert.ok(extract > 0 && appleSecrets > extract);
    assert.match(workflow, /aarch64\.source\.app\.tar\.gz/);
    assert.match(workflow, /ZDE_STAGE_MAX_ENTRY_COUNT/);
    assert.match(workflow, /ZDE_STAGE_MAX_UNCOMPRESSED_BYTES/);
    assert.doesNotMatch(
      workflow.slice(extract, appleSecrets),
      /Contents\/MacOS\/ZDE(?:\s|"|'|$)/,
    );
  });

  it("isolates release publication from release-data authority on a fresh runner", () => {
    const publishStart = workflow.indexOf("\n  publish:");
    const feedStart = workflow.indexOf("\n  promote-feed:");
    const pagesStart = workflow.indexOf("\n  deploy-pages:");
    assert.ok(
      publishStart > 0 && feedStart > publishStart && pagesStart > feedStart,
      "feed promotion must be a separate job between release publication and Pages deployment",
    );

    const publishJob = workflow.slice(publishStart, feedStart);
    const feedJob = workflow.slice(feedStart, pagesStart);
    assert.match(publishJob, /permissions:\n      contents: write/);
    assert.doesNotMatch(
      publishJob,
      /ZDE_FEED_DEPLOY_KEY|name: zde-feed|ref: release-data|git push/,
    );
    assert.match(feedJob, /needs:[\s\S]*- publish/);
    assert.match(feedJob, /permissions:\n      contents: read/);
    assert.match(feedJob, /name: zde-feed/);
    assert.match(
      feedJob,
      /ssh-key: \$\{\{ secrets\.ZDE_FEED_DEPLOY_KEY \}\}/,
    );
    assert.match(feedJob, /actions\/download-artifact@/);
    assert.match(feedJob, /actions\/upload-pages-artifact@/);
    assert.doesNotMatch(
      feedJob,
      /GH_TOKEN|github\.token|contents: write|gh release/,
    );

    const pagesHeader = workflow.slice(
      pagesStart,
      workflow.indexOf("\n    steps:", pagesStart),
    );
    assert.match(pagesHeader, /needs:[\s\S]*- promote-feed/);
  });

  it("pins runner toolchains and avoids floating package-manager installs", () => {
    assert.doesNotMatch(workflow, /ubuntu-latest/);
    assert.match(workflow, /runs-on: ubuntu-24\.04/);
    assert.doesNotMatch(workflow, /node-version: "22"/);
    assert.match(workflow, /node-version: "22\.23\.2"/);
    assert.doesNotMatch(workflow, /brew install/);
    assert.doesNotMatch(workflow, /apt-get install/);
    assert.match(workflow, /minisign\/releases\/download\/0\.12/);
    assert.match(
      workflow,
      /9a599b48ba6eb7b1e80f12f36b94ceca7c00b7a5173c95c3efc88d9822957e73/,
    );
    assert.doesNotMatch(workflow, /cargo install minisign/);
    assert.doesNotMatch(workflow, /npm audit --omit=dev --audit-level=high/);
    assert.match(workflow, /npm audit --omit=dev --audit-level=moderate/);
    assert.equal(
      workflow.match(/npm audit --audit-level=moderate/g)?.length,
      5,
    );
  });
});
