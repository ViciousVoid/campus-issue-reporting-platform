const ADJECTIVES = ['Swift', 'Quiet', 'Bright', 'Curious', 'Lucky', 'Brave', 'Clever', 'Sunny', 'Calm', 'Bold', 'Witty', 'Mellow', 'Rapid', 'Cosmic', 'Gentle', 'Nimble']
const ANIMALS = ['Falcon', 'Otter', 'Panda', 'Tiger', 'Koala', 'Fox', 'Heron', 'Lynx', 'Dolphin', 'Owl', 'Badger', 'Gecko', 'Raven', 'Bison', 'Sparrow', 'Wolf']

function pick<T>(items: T[]) {
  const index = crypto.getRandomValues(new Uint32Array(1))[0] % items.length
  return items[index]
}

export function createGuestName() {
  const suffix = (crypto.getRandomValues(new Uint16Array(1))[0] % 900) + 100
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)} ${suffix}`
}
