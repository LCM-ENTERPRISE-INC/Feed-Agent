module.exports = {
  __esModule: true,
  default: jest.fn(() => ({
    ev: { on: jest.fn() },
    end: jest.fn(),
    presenceSubscribe: jest.fn(),
    sendPresenceUpdate: jest.fn(),
    readMessages: jest.fn(),
    sendMessage: jest.fn(),
    updateProfilePicture: jest.fn(),
    updateProfileStatus: jest.fn()
  })),
  makeWASocket: jest.fn(() => ({
    ev: { on: jest.fn() },
    end: jest.fn(),
    presenceSubscribe: jest.fn(),
    sendPresenceUpdate: jest.fn(),
    readMessages: jest.fn(),
    sendMessage: jest.fn(),
    updateProfilePicture: jest.fn(),
    updateProfileStatus: jest.fn()
  })),
  useMultiFileAuthState: jest.fn().mockResolvedValue({
    state: {},
    saveCreds: jest.fn()
  }),
  fetchLatestBaileysVersion: jest.fn().mockResolvedValue({ version: [2, 2300, 1] }),
  delay: jest.fn().mockResolvedValue(undefined),
  Browsers: {
    macOS: jest.fn().mockReturnValue(['Mac OS', 'Desktop', ''])
  }
};
