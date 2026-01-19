const { linkPuzzlesToBlunders, markLinkedBlundersLearned } = require('../../src/models/puzzle-blunder-linker');

describe('PuzzleBlunderLinker', () => {
  let mockDb;

  beforeEach(() => {
    mockDb = {
      run: jest.fn().mockResolvedValue({ changes: 1 })
    };
  });

  describe('linkPuzzlesToBlunders', () => {
    it('creates links for puzzles with matching themes', async () => {
      const puzzles = [{ id: 'puzzle1', themes: 'hangingPiece advantage' }];
      
      const count = await linkPuzzlesToBlunders(mockDb, puzzles, 'user1');
      
      expect(mockDb.run).toHaveBeenCalled();
      expect(count).toBeGreaterThan(0);
    });

    it('skips puzzles without themes', async () => {
      const puzzles = [{ id: 'puzzle1' }];
      
      await linkPuzzlesToBlunders(mockDb, puzzles, 'user1');
      
      expect(mockDb.run).not.toHaveBeenCalled();
    });

    it('calls db for each matching blunder theme', async () => {
      const puzzles = [{ id: 'puzzle1', themes: 'hangingPiece' }]; // maps to bad_piece_placement, hanging_piece, wrong_capture
      
      await linkPuzzlesToBlunders(mockDb, puzzles, 'user1');
      
      // hangingPiece maps to multiple blunder themes
      expect(mockDb.run.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('returns 0 when no links created', async () => {
      mockDb.run.mockResolvedValue({ changes: 0 });
      const puzzles = [{ id: 'puzzle1', themes: 'unknownTheme' }];
      
      const count = await linkPuzzlesToBlunders(mockDb, puzzles, 'user1');
      
      expect(count).toBe(0);
    });

    it('passes correct parameters to db query', async () => {
      const puzzles = [{ id: 'puzzle1', themes: 'advantage' }]; // maps to positional_error
      
      await linkPuzzlesToBlunders(mockDb, puzzles, 'user123');
      
      const call = mockDb.run.mock.calls[0];
      expect(call[1]).toContain('puzzle1');
      expect(call[1]).toContain('user123');
      expect(call[1]).toContain('positional_error');
    });
  });

  describe('markLinkedBlundersLearned', () => {
    it('updates linked blunders', async () => {
      mockDb.run.mockResolvedValue({ changes: 3 });
      
      const count = await markLinkedBlundersLearned(mockDb, 'puzzle1');
      
      expect(count).toBe(3);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE blunder_details'),
        ['puzzle1']
      );
    });

    it('returns 0 when no blunders updated', async () => {
      mockDb.run.mockResolvedValue({ changes: 0 });
      
      const count = await markLinkedBlundersLearned(mockDb, 'puzzle1');
      
      expect(count).toBe(0);
    });

    it('handles undefined changes', async () => {
      mockDb.run.mockResolvedValue({});
      
      const count = await markLinkedBlundersLearned(mockDb, 'puzzle1');
      
      expect(count).toBe(0);
    });
  });
});
