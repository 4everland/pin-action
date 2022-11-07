# 4everland-pin-action

# IPFS pin service deploy

This action deploys to IPFS/AR/IC through 4EVERLAND hosting service

## Inputs

### `BUILD_LOCATION`

**Required** Path to directory which should be sent to 4EVERLAND.

### `EVER_TOKEN`

**Required** 4EVERLAND api token created on [Auth Tokens](https://dashboard.4everland.org/hosting/auth-tokens)

### `EVER_PROJECT_NAME`

4EVERLAND hosting project name.

### `EVER_PROJECT_ID`

4EVERLAND hosting project ID.

### `EVER_PROJECT_PLAT`

4EVERLAND hosting project platform. Default `"IPFS"`. And `"AR"`(Arweave) or `"IC"`(Internet Computer) for choice.

## Outputs

### `hash`

Deployed hash value.

### `uri`

IPFS hash link.

### `projLink`

Deployed project link.

## Example usage

```
- name: pin4everland
  id: pin4everland
  uses: 4everland/pin-action@v1.1
  with:
    EVER_TOKEN: ${{secrets.EVER_TOKEN}}
    EVER_PROJECT_NAME: "test-project"
    EVER_PROJECT_PLAT: "AR"
    BUILD_LOCATION: "./dist"
```
