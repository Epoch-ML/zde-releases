import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { validateReleaseAssetUrl } from "./validate-release-asset-url.mjs";

const validInput = {
  assetUrl:
    "https://github.com/Epoch-ML/zde-releases/releases/download/zde-v0.2.0/ZDE_0.2.0_aarch64.app.tar.gz",
  assetName: "ZDE_0.2.0_aarch64.app.tar.gz",
  repository: "Epoch-ML/zde-releases",
  releaseTag: "zde-v0.2.0",
  releaseIsDraft: false,
};

describe("release asset URL validation", () => {
  it("accepts only the canonical protected-tag URL shape", () => {
    assert.deepEqual(validateReleaseAssetUrl(validInput), {
      owner: "Epoch-ML",
      repository: "zde-releases",
      release: "zde-v0.2.0",
      asset: "ZDE_0.2.0_aarch64.app.tar.gz",
    });
    assert.deepEqual(
      validateReleaseAssetUrl({ ...validInput, releaseIsDraft: true }),
      {
        owner: "Epoch-ML",
        repository: "zde-releases",
        release: "zde-v0.2.0",
        asset: "ZDE_0.2.0_aarch64.app.tar.gz",
      },
    );
  });

  it("rejects credentials, metadata, and path substitutions", () => {
    const invalidInputs = [
      { assetUrl: validInput.assetUrl.replace("https://", "http://") },
      { assetUrl: validInput.assetUrl.replace("github.com", "user:pass@github.com") },
      { assetUrl: `${validInput.assetUrl}?download=1` },
      { assetUrl: `${validInput.assetUrl}#fragment` },
      { assetUrl: validInput.assetUrl.replace("Epoch-ML", "Other") },
      { assetUrl: validInput.assetUrl.replace("zde-v0.2.0", "untagged-deadbeef") },
      { assetUrl: `${validInput.assetUrl}/extra` },
      { repository: "Epoch-ML/zde-releases/extra" },
      { assetName: "different.tar.gz" },
      { releaseTag: "zde-v9.9.9" },
      { releaseIsDraft: "false" },
    ];

    for (const invalidInput of invalidInputs) {
      assert.throws(
        () => validateReleaseAssetUrl({ ...validInput, ...invalidInput }),
        { code: "ERR_ASSERTION" },
      );
    }
  });
});
