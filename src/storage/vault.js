// A consent wrapper is not encryption. This adapter accepts only a repository
// that explicitly proves encrypted-at-rest capability; generic storage gateways
// must use createVersionedRepository and must never be presented as a Vault.
export function createPrivacyVault({ secureRepository = null, consent = () => false } = {}) {
  const encryptedAtRest = secureRepository?.capabilities?.encryptedAtRest === true;
  function read(fallback = null) {
    return consent() && encryptedAtRest ? secureRepository.read(fallback) : fallback;
  }
  function write(value) {
    return consent() && encryptedAtRest ? secureRepository.write(value) : false;
  }
  function remove() {
    return encryptedAtRest && typeof secureRepository.remove === 'function' ? secureRepository.remove() : false;
  }
  return Object.freeze({
    read,
    write,
    remove,
    migrateStored: encryptedAtRest && typeof secureRepository.migrateStored === 'function' ? secureRepository.migrateStored : () => null,
    status: encryptedAtRest ? 'encrypted-repository-ready' : 'disabled-no-encrypted-repository',
    encryptedAtRest
  });
}
