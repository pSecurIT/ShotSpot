# ShotSpot Release Guide

Use this guide when you want to publish a new ShotSpot version in GitHub and let the automation build and ship the release image.

## What happens in a release

When you publish a GitHub Release or push a tag that starts with `v`, the release workflow in [`.github/workflows/release.yml`](../.github/workflows/release.yml) builds the Docker image, pushes it to GitHub Container Registry, and tags it with the version plus `latest` where appropriate.

## Before you start

Make sure you are on the latest `main` branch and that the code you want to ship is already merged.

```bash
git checkout main
git pull origin main
```

## The simplest release flow

### 1. Prepare the release locally

Run the release helper script from the repository root:

```bash
node scripts/create-release.js
```

The script will ask you for:

1. Release type: major, minor, patch, or custom version.
2. Confirmation before changing files.
3. Whether you want to push the tag and commit after it prepares the release.

### 2. Choose the version

Pick the version that matches the change:

1. Major: breaking changes.
2. Minor: new features.
3. Patch: bug fixes or small safe updates.
4. Custom version: only if you already know the exact version number.

If you are unsure, choose patch.

### 3. Review what the script changes

The script updates all three version files together:

- `package.json`
- `frontend/package.json`
- `backend/package.json`
- `CHANGELOG.md`

It also creates a tag like `v1.2.3` and commits the release prep changes.

### 4. Push the release commit and tag

If the script asks to push now, answer `y`.

If you prefer to do it manually, push both the commit and the tag:

```bash
git push origin main
git push origin v1.2.3
```

Replace `v1.2.3` with your actual version.

### 5. Create the GitHub Release

In GitHub:

1. Open the repository.
2. Click **Releases**.
3. Click **Draft a new release**.
4. Choose the tag you just pushed, for example `v1.2.3`.
5. Set the release title to the same version.
6. Paste or generate release notes.
7. Click **Publish release**.

Screenshot callout: add a screenshot here showing the **Releases** page with **Draft a new release** highlighted.

Screenshot callout: add a screenshot here showing the **Choose a tag** dropdown with `v1.2.3` selected.

## What to expect after publishing

After the release is published, GitHub Actions starts the workflow automatically. The workflow:

1. Builds the Docker image.
2. Pushes the image to GitHub Container Registry.
3. Publishes release tags such as `v1.2.3`, `v1.2`, `v1`, and `latest` where applicable.
4. Verifies the pushed image.

If the workflow does not start, check that:

1. The release was actually published, not left as a draft.
2. The tag starts with `v`.
3. The workflow file in [`.github/workflows/release.yml`](../.github/workflows/release.yml) still has the `release` and `push.tags` triggers.

## If you only want to rebuild the release image

You do not need to cut a new version every time you want a rebuild. You can manually run the workflow from GitHub:

1. Open **Actions**.
2. Select **Build and Push Docker Image**.
3. Click **Run workflow**.
4. Optional: type a tag such as `latest`.

Screenshot callout: add a screenshot here showing the **Actions** page and the **Run workflow** button.

## Common mistakes

1. Forgetting to push the tag. If the tag is only local, GitHub will not build the release.
2. Publishing a draft release and expecting Actions to run. Drafts do not trigger the release event.
3. Using a version tag without the `v` prefix. This repo expects release tags like `v1.2.3`.
4. Skipping the changelog review. The script creates an automatic draft, but you should still check the notes before publishing.

## Rollback

If you published the wrong version:

1. Delete the GitHub Release.
2. Delete the bad tag from GitHub and locally.
3. Recreate the release with the corrected version.

## Related deployment docs

If your goal is not to publish a new version but to deploy an already published image, use these documents instead:

- [Full Docker Guide](../DOCKER.md)
- [Deployment Guide](../DEPLOYMENT.md)
- [Main README](../README.md)

## Support

- GitHub Issues: https://github.com/pSecurIT/ShotSpot/issues
- Security: security@shotspot.example.com (private disclosure)
