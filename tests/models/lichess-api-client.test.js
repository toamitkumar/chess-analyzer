const { describe, test, expect, beforeEach } = require('@jest/globals');
const LichessAPIClient = require('../../src/models/lichess-api-client');

// Mock fetch globally
global.fetch = jest.fn();

describe('LichessAPIClient', () => {
  let client;

  beforeEach(() => {
    client = new LichessAPIClient();
    jest.clearAllMocks();
    // Reset rate limiting timer
    client.lastRequest = 0;
  });

  describe('constructor', () => {
    test('should initialize with correct defaults', () => {
      expect(client.baseUrl).toBe('https://lichess.org/api');
      expect(client.minInterval).toBe(1000); // 1 second
      expect(client.lastRequest).toBe(0);
    });
  });

  describe('fetchPuzzle', () => {
    test('should fetch puzzle successfully', async () => {
      const mockPuzzle = {
        puzzle: {
          id: '00123',
          solution: ['e2e4', 'e7e5'],
          themes: ['fork', 'middlegame']
        },
        game: {
          pgn: 'mock pgn'
        }
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockPuzzle
      });

      const result = await client.fetchPuzzle('00123');

      expect(global.fetch).toHaveBeenCalledWith('https://lichess.org/api/puzzle/00123');
      expect(result).toEqual(mockPuzzle);
    });

    test('should handle 404 not found', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const result = await client.fetchPuzzle('invalid');

      expect(result.error).toBe(true);
      expect(result.lichessUrl).toBe('https://lichess.org/training/invalid');
    });

    test('should retry on 429 rate limit', async () => {
      // First call: rate limited
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      // Second call: success
      const mockPuzzle = { puzzle: { id: '00123' } };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockPuzzle
      });

      // Mock sleep to avoid actual delay in tests
      client.sleep = jest.fn().mockResolvedValue();

      const result = await client.fetchPuzzle('00123');

      expect(client.sleep).toHaveBeenCalledWith(60000); // 1 minute wait
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockPuzzle);
    });

    test('should handle network errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await client.fetchPuzzle('00123');

      expect(result.error).toBe(true);
      expect(result.id).toBe('00123');
      expect(result.lichessUrl).toBe('https://lichess.org/training/00123');
    });
  });

  describe('throttle', () => {
    test('should throttle requests to 1 per second', async () => {
      const startTime = Date.now();

      // Mock sleep to track if it's called
      client.sleep = jest.fn().mockResolvedValue();

      // First request - no throttle
      client.lastRequest = 0;
      await client.throttle();
      expect(client.sleep).not.toHaveBeenCalled();

      // Second request immediately after - should throttle
      client.lastRequest = Date.now();
      await client.throttle();
      expect(client.sleep).toHaveBeenCalled();
      expect(client.sleep.mock.calls[0][0]).toBeGreaterThan(0);
      expect(client.sleep.mock.calls[0][0]).toBeLessThanOrEqual(1000);
    });

    test('should not throttle if enough time has passed', async () => {
      client.sleep = jest.fn().mockResolvedValue();

      // Set last request to 2 seconds ago
      client.lastRequest = Date.now() - 2000;

      await client.throttle();

      expect(client.sleep).not.toHaveBeenCalled();
    });
  });

  describe('sleep', () => {
    test('should delay execution', async () => {
      const startTime = Date.now();
      await client.sleep(100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('error handling', () => {
    test('should return fallback object on error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Timeout'));

      const result = await client.fetchPuzzle('00123');

      expect(result).toMatchObject({
        id: '00123',
        lichessUrl: 'https://lichess.org/training/00123',
        error: true
      });
    });

    test('should handle malformed JSON response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      const result = await client.fetchPuzzle('00123');

      expect(result.error).toBe(true);
    });
  });

  describe('rate limiting integration', () => {
    test('should enforce rate limit across multiple requests', async () => {
      const mockPuzzle = { puzzle: { id: 'test' } };

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPuzzle
      });

      // Mock sleep to avoid actual delays
      client.sleep = jest.fn().mockResolvedValue();

      // Make 3 requests in quick succession
      await client.fetchPuzzle('001');
      await client.fetchPuzzle('002');
      await client.fetchPuzzle('003');

      // Sleep should be called for 2nd and 3rd requests
      expect(client.sleep).toHaveBeenCalledTimes(2);
    });
  });
});
