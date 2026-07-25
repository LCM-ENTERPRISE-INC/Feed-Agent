module.exports = {
  HttpsProxyAgent: jest.fn().mockImplementation((url) => {
    if (url === 'url-invalida-sem-protocolo') throw new Error('Invalid URL');
    return { _isProxyAgent: true, url };
  })
};
