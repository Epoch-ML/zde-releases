import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

export function validateReleaseAssetUrl({
  assetUrl,
  assetName,
  repository,
  releaseTag,
  releaseIsDraft,
}) {
  assert.equal(typeof releaseIsDraft, "boolean");
  const [owner, repositoryName, ...extraRepositoryParts] = repository.split("/");
  assert.ok(owner.length > 0);
  assert.ok(repositoryName.length > 0);
  assert.deepEqual(extraRepositoryParts, []);

  const url = new URL(assetUrl);
  assert.equal(url.origin, "https://github.com");
  assert.equal(url.username, "");
  assert.equal(url.password, "");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");

  const segments = url.pathname.slice(1).split("/").map(decodeURIComponent);
  assert.deepEqual(segments, [
    owner,
    repositoryName,
    "releases",
    "download",
    releaseTag,
    assetName,
  ]);

  return {
    owner,
    repository: repositoryName,
    release: segments[4],
    asset: segments[5],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [assetUrl, assetName, repository, releaseTag, draftValue, ...extraArguments] =
    process.argv.slice(2);
  assert.deepEqual(extraArguments, []);
  assert.ok(draftValue === "true" || draftValue === "false");
  validateReleaseAssetUrl({
    assetUrl,
    assetName,
    repository,
    releaseTag,
    releaseIsDraft: draftValue === "true",
  });
}
