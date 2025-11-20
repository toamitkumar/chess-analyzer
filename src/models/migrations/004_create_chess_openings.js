class Migration004 {
  constructor(database) {
    this.db = database;
    this.version = 4;
    this.name = 'create_chess_openings';
  }

  async up() {
    console.log('🔄 Running migration: Create chess_openings table');
    
    // Create table
    await this.db.run(`
      CREATE TABLE IF NOT EXISTS chess_openings (
        eco_code VARCHAR(3) PRIMARY KEY,
        opening_name VARCHAR(255) NOT NULL
      )
    `);

    // Insert all ECO mappings
    const openings = [
      ['A00', 'Uncommon Opening'], ['A01', 'Nimzo-Larsen Attack'], ['A02', 'Bird\'s Opening'],
      ['A03', 'Bird\'s Opening'], ['A04', 'Reti Opening'], ['A05', 'Reti Opening'],
      ['A06', 'Reti Opening'], ['A07', 'King\'s Indian Attack'], ['A08', 'King\'s Indian Attack'],
      ['A09', 'Reti Opening'], ['A10', 'English Opening'], ['A11', 'English Opening'],
      ['A12', 'English Opening'], ['A13', 'English Opening'], ['A14', 'English Opening'],
      ['A15', 'English Opening'], ['A16', 'English Opening'], ['A17', 'English Opening'],
      ['A18', 'English Opening'], ['A19', 'English Opening'], ['A20', 'English Opening'],
      ['A21', 'English Opening'], ['A22', 'English Opening'], ['A23', 'English Opening'],
      ['A24', 'English Opening'], ['A25', 'English Opening'], ['A26', 'English Opening'],
      ['A27', 'English Opening'], ['A28', 'English Opening'], ['A29', 'English Opening'],
      ['A30', 'English Opening'], ['B00', 'King\'s Pawn Game'], ['B01', 'Scandinavian Defense'],
      ['B02', 'Alekhine\'s Defense'], ['B03', 'Alekhine\'s Defense'], ['B04', 'Alekhine\'s Defense'],
      ['B05', 'Alekhine\'s Defense'], ['B06', 'Modern Defense'], ['B07', 'Pirc Defense'],
      ['B08', 'Pirc Defense'], ['B09', 'Pirc Defense'], ['B10', 'Caro-Kann Defense'],
      ['B11', 'Caro-Kann Defense'], ['B12', 'Caro-Kann Defense'], ['B13', 'Caro-Kann Defense'],
      ['B14', 'Caro-Kann Defense'], ['B15', 'Caro-Kann Defense'], ['B16', 'Caro-Kann Defense'],
      ['B17', 'Caro-Kann Defense'], ['B18', 'Caro-Kann Defense'], ['B19', 'Caro-Kann Defense'],
      ['B20', 'Sicilian Defense'], ['B21', 'Sicilian Defense'], ['B22', 'Sicilian Defense'],
      ['B23', 'Sicilian Defense'], ['B24', 'Sicilian Defense'], ['B25', 'Sicilian Defense'],
      ['B26', 'Sicilian Defense'], ['B27', 'Sicilian Defense'], ['B28', 'Sicilian Defense'],
      ['B29', 'Sicilian Defense'], ['B30', 'Sicilian Defense'], ['B31', 'Sicilian Defense'],
      ['B32', 'Sicilian Defense'], ['B33', 'Sicilian Defense'], ['B34', 'Sicilian Defense'],
      ['B35', 'Sicilian Defense'], ['B36', 'Sicilian Defense'], ['B37', 'Sicilian Defense'],
      ['B38', 'Sicilian Defense'], ['B39', 'Sicilian Defense'], ['B40', 'Sicilian Defense'],
      ['B41', 'Sicilian Defense'], ['B42', 'Sicilian Defense'], ['B43', 'Sicilian Defense'],
      ['B44', 'Sicilian Defense'], ['B45', 'Sicilian Defense'], ['B46', 'Sicilian Defense'],
      ['B47', 'Sicilian Defense'], ['B48', 'Sicilian Defense'], ['B49', 'Sicilian Defense'],
      ['B50', 'Sicilian Defense'], ['B51', 'Sicilian Defense'], ['B52', 'Sicilian Defense'],
      ['B53', 'Sicilian Defense'], ['B54', 'Sicilian Defense'], ['B55', 'Sicilian Defense'],
      ['B56', 'Sicilian Defense'], ['B57', 'Sicilian Defense'], ['B58', 'Sicilian Defense'],
      ['B59', 'Sicilian Defense'], ['B60', 'Sicilian Defense, Najdorf'], ['B61', 'Sicilian Defense, Najdorf'],
      ['B62', 'Sicilian Defense, Najdorf'], ['B63', 'Sicilian Defense, Najdorf'], ['B64', 'Sicilian Defense, Najdorf'],
      ['B65', 'Sicilian Defense, Najdorf'], ['B66', 'Sicilian Defense, Najdorf'], ['B67', 'Sicilian Defense, Najdorf'],
      ['B68', 'Sicilian Defense, Najdorf'], ['B69', 'Sicilian Defense, Najdorf'], ['B70', 'Sicilian Defense, Dragon'],
      ['B71', 'Sicilian Defense, Dragon'], ['B72', 'Sicilian Defense, Dragon'], ['B73', 'Sicilian Defense, Dragon'],
      ['B74', 'Sicilian Defense, Dragon'], ['B75', 'Sicilian Defense, Dragon'], ['B76', 'Sicilian Defense, Dragon'],
      ['B77', 'Sicilian Defense, Dragon'], ['B78', 'Sicilian Defense, Dragon'], ['B79', 'Sicilian Defense, Dragon'],
      ['B80', 'Sicilian Defense'], ['B81', 'Sicilian Defense'], ['B82', 'Sicilian Defense'],
      ['B83', 'Sicilian Defense'], ['B84', 'Sicilian Defense'], ['B85', 'Sicilian Defense'],
      ['B86', 'Sicilian Defense'], ['B87', 'Sicilian Defense'], ['B88', 'Sicilian Defense'],
      ['B89', 'Sicilian Defense'], ['B90', 'Sicilian Defense, Najdorf'], ['B91', 'Sicilian Defense, Najdorf'],
      ['B92', 'Sicilian Defense, Najdorf'], ['B93', 'Sicilian Defense, Najdorf'], ['B94', 'Sicilian Defense, Najdorf'],
      ['B95', 'Sicilian Defense, Najdorf'], ['B96', 'Sicilian Defense, Najdorf'], ['B97', 'Sicilian Defense, Najdorf'],
      ['B98', 'Sicilian Defense, Najdorf'], ['B99', 'Sicilian Defense, Najdorf'], ['C00', 'French Defense'],
      ['C01', 'French Defense'], ['C02', 'French Defense'], ['C03', 'French Defense'],
      ['C04', 'French Defense'], ['C05', 'French Defense'], ['C06', 'French Defense'],
      ['C07', 'French Defense'], ['C08', 'French Defense'], ['C09', 'French Defense'],
      ['C10', 'French Defense'], ['C11', 'French Defense'], ['C12', 'French Defense'],
      ['C13', 'French Defense'], ['C14', 'French Defense'], ['C15', 'French Defense'],
      ['C16', 'French Defense'], ['C17', 'French Defense'], ['C18', 'French Defense'],
      ['C19', 'French Defense'], ['C20', 'King\'s Pawn Game'], ['C21', 'Center Game'],
      ['C22', 'Center Game'], ['C23', 'Bishop\'s Opening'], ['C24', 'Bishop\'s Opening'],
      ['C25', 'Vienna Game'], ['C26', 'Vienna Game'], ['C27', 'Vienna Game'],
      ['C28', 'Vienna Game'], ['C29', 'Vienna Game'], ['C30', 'King\'s Gambit'],
      ['C31', 'King\'s Gambit'], ['C32', 'King\'s Gambit'], ['C33', 'King\'s Gambit'],
      ['C34', 'King\'s Gambit'], ['C35', 'King\'s Gambit'], ['C36', 'King\'s Gambit'],
      ['C37', 'King\'s Gambit'], ['C38', 'King\'s Gambit'], ['C39', 'King\'s Gambit'],
      ['C40', 'King\'s Knight Opening'], ['C41', 'Philidor Defense'], ['C42', 'Petrov Defense'],
      ['C43', 'Petrov Defense'], ['C44', 'King\'s Pawn Game'], ['C45', 'Scotch Game'],
      ['C46', 'Three Knights Opening'], ['C47', 'Four Knights Game'], ['C48', 'Four Knights Game'],
      ['C49', 'Four Knights Game'], ['C50', 'Italian Game'], ['C51', 'Italian Game'],
      ['C52', 'Italian Game'], ['C53', 'Italian Game'], ['C54', 'Italian Game'],
      ['C55', 'Italian Game'], ['C56', 'Italian Game'], ['C57', 'Italian Game'],
      ['C58', 'Italian Game'], ['C59', 'Italian Game'], ['C60', 'Ruy Lopez'],
      ['C61', 'Ruy Lopez'], ['C62', 'Ruy Lopez'], ['C63', 'Ruy Lopez'],
      ['C64', 'Ruy Lopez'], ['C65', 'Ruy Lopez'], ['C66', 'Ruy Lopez'],
      ['C67', 'Ruy Lopez'], ['C68', 'Ruy Lopez'], ['C69', 'Ruy Lopez'],
      ['C70', 'Ruy Lopez'], ['C71', 'Ruy Lopez'], ['C72', 'Ruy Lopez'],
      ['C73', 'Ruy Lopez'], ['C74', 'Ruy Lopez'], ['C75', 'Ruy Lopez'],
      ['C76', 'Ruy Lopez'], ['C77', 'Ruy Lopez'], ['C78', 'Ruy Lopez'],
      ['C79', 'Ruy Lopez'], ['C80', 'Ruy Lopez'], ['C81', 'Ruy Lopez'],
      ['C82', 'Ruy Lopez'], ['C83', 'Ruy Lopez'], ['C84', 'Ruy Lopez'],
      ['C85', 'Ruy Lopez'], ['C86', 'Ruy Lopez'], ['C87', 'Ruy Lopez'],
      ['C88', 'Ruy Lopez'], ['C89', 'Ruy Lopez'], ['C90', 'Ruy Lopez'],
      ['C91', 'Ruy Lopez'], ['C92', 'Ruy Lopez'], ['C93', 'Ruy Lopez'],
      ['C94', 'Ruy Lopez'], ['C95', 'Ruy Lopez'], ['C96', 'Ruy Lopez'],
      ['C97', 'Ruy Lopez'], ['C98', 'Ruy Lopez'], ['C99', 'Ruy Lopez'],
      ['D00', 'Queen\'s Pawn Game'], ['D01', 'Richter-Veresov Attack'], ['D02', 'Queen\'s Pawn Game'],
      ['D03', 'Torre Attack'], ['D04', 'Queen\'s Pawn Game'], ['D05', 'Queen\'s Pawn Game'],
      ['D06', 'Queen\'s Gambit'], ['D07', 'Queen\'s Gambit'], ['D08', 'Queen\'s Gambit'],
      ['D09', 'Queen\'s Gambit'], ['D10', 'Queen\'s Gambit'], ['D11', 'Queen\'s Gambit'],
      ['D12', 'Queen\'s Gambit'], ['D13', 'Queen\'s Gambit'], ['D14', 'Queen\'s Gambit'],
      ['D15', 'Queen\'s Gambit'], ['D16', 'Queen\'s Gambit'], ['D17', 'Queen\'s Gambit'],
      ['D18', 'Queen\'s Gambit'], ['D19', 'Queen\'s Gambit'], ['D20', 'Queen\'s Gambit Accepted'],
      ['D21', 'Queen\'s Gambit Accepted'], ['D22', 'Queen\'s Gambit Accepted'], ['D23', 'Queen\'s Gambit Accepted'],
      ['D24', 'Queen\'s Gambit Accepted'], ['D25', 'Queen\'s Gambit Accepted'], ['D26', 'Queen\'s Gambit Accepted'],
      ['D27', 'Queen\'s Gambit Accepted'], ['D28', 'Queen\'s Gambit Accepted'], ['D29', 'Queen\'s Gambit Accepted'],
      ['D30', 'Queen\'s Gambit Declined'], ['D31', 'Queen\'s Gambit Declined'], ['D32', 'Queen\'s Gambit Declined'],
      ['D33', 'Queen\'s Gambit Declined'], ['D34', 'Queen\'s Gambit Declined'], ['D35', 'Queen\'s Gambit Declined'],
      ['D36', 'Queen\'s Gambit Declined'], ['D37', 'Queen\'s Gambit Declined'], ['D38', 'Queen\'s Gambit Declined'],
      ['D39', 'Queen\'s Gambit Declined'], ['D40', 'Queen\'s Gambit Declined'], ['D41', 'Queen\'s Gambit Declined'],
      ['D42', 'Queen\'s Gambit Declined'], ['D43', 'Queen\'s Gambit Declined'], ['D44', 'Queen\'s Gambit Declined'],
      ['D45', 'Queen\'s Gambit Declined'], ['D46', 'Queen\'s Gambit Declined'], ['D47', 'Queen\'s Gambit Declined'],
      ['D48', 'Queen\'s Gambit Declined'], ['D49', 'Queen\'s Gambit Declined'], ['D50', 'Queen\'s Gambit Declined'],
      ['D51', 'Queen\'s Gambit Declined'], ['D52', 'Queen\'s Gambit Declined'], ['D53', 'Queen\'s Gambit Declined'],
      ['D54', 'Queen\'s Gambit Declined'], ['D55', 'Queen\'s Gambit Declined'], ['D56', 'Queen\'s Gambit Declined'],
      ['D57', 'Queen\'s Gambit Declined'], ['D58', 'Queen\'s Gambit Declined'], ['D59', 'Queen\'s Gambit Declined'],
      ['D60', 'Queen\'s Gambit Declined'], ['D61', 'Queen\'s Gambit Declined'], ['D62', 'Queen\'s Gambit Declined'],
      ['D63', 'Queen\'s Gambit Declined'], ['D64', 'Queen\'s Gambit Declined'], ['D65', 'Queen\'s Gambit Declined'],
      ['D66', 'Queen\'s Gambit Declined'], ['D67', 'Queen\'s Gambit Declined'], ['D68', 'Queen\'s Gambit Declined'],
      ['D69', 'Queen\'s Gambit Declined'], ['D70', 'Grünfeld Defense'], ['D71', 'Grünfeld Defense'],
      ['D72', 'Grünfeld Defense'], ['D73', 'Grünfeld Defense'], ['D74', 'Grünfeld Defense'],
      ['D75', 'Grünfeld Defense'], ['D76', 'Grünfeld Defense'], ['D77', 'Grünfeld Defense'],
      ['D78', 'Grünfeld Defense'], ['D79', 'Grünfeld Defense'], ['D80', 'Grünfeld Defense'],
      ['D81', 'Grünfeld Defense'], ['D82', 'Grünfeld Defense'], ['D83', 'Grünfeld Defense'],
      ['D84', 'Grünfeld Defense'], ['D85', 'Grünfeld Defense'], ['D86', 'Grünfeld Defense'],
      ['D87', 'Grünfeld Defense'], ['D88', 'Grünfeld Defense'], ['D89', 'Grünfeld Defense'],
      ['D90', 'Grünfeld Defense'], ['D91', 'Grünfeld Defense'], ['D92', 'Grünfeld Defense'],
      ['D93', 'Grünfeld Defense'], ['D94', 'Grünfeld Defense'], ['D95', 'Grünfeld Defense'],
      ['D96', 'Grünfeld Defense'], ['D97', 'Grünfeld Defense'], ['D98', 'Grünfeld Defense'],
      ['D99', 'Grünfeld Defense'], ['E00', 'Queen\'s Pawn Game'], ['E01', 'Catalan Opening'],
      ['E02', 'Catalan Opening'], ['E03', 'Catalan Opening'], ['E04', 'Catalan Opening'],
      ['E05', 'Catalan Opening'], ['E06', 'Catalan Opening'], ['E07', 'Catalan Opening'],
      ['E08', 'Catalan Opening'], ['E09', 'Catalan Opening'], ['E10', 'Queen\'s Pawn Game'],
      ['E11', 'Bogo-Indian Defense'], ['E12', 'Queen\'s Indian Defense'], ['E13', 'Queen\'s Indian Defense'],
      ['E14', 'Queen\'s Indian Defense'], ['E15', 'Queen\'s Indian Defense'], ['E16', 'Queen\'s Indian Defense'],
      ['E17', 'Queen\'s Indian Defense'], ['E18', 'Queen\'s Indian Defense'], ['E19', 'Queen\'s Indian Defense'],
      ['E20', 'Nimzo-Indian Defense'], ['E21', 'Nimzo-Indian Defense'], ['E22', 'Nimzo-Indian Defense'],
      ['E23', 'Nimzo-Indian Defense'], ['E24', 'Nimzo-Indian Defense'], ['E25', 'Nimzo-Indian Defense'],
      ['E26', 'Nimzo-Indian Defense'], ['E27', 'Nimzo-Indian Defense'], ['E28', 'Nimzo-Indian Defense'],
      ['E29', 'Nimzo-Indian Defense'], ['E30', 'Nimzo-Indian Defense'], ['E31', 'Nimzo-Indian Defense'],
      ['E32', 'Nimzo-Indian Defense'], ['E33', 'Nimzo-Indian Defense'], ['E34', 'Nimzo-Indian Defense'],
      ['E35', 'Nimzo-Indian Defense'], ['E36', 'Nimzo-Indian Defense'], ['E37', 'Nimzo-Indian Defense'],
      ['E38', 'Nimzo-Indian Defense'], ['E39', 'Nimzo-Indian Defense'], ['E40', 'Nimzo-Indian Defense'],
      ['E41', 'Nimzo-Indian Defense'], ['E42', 'Nimzo-Indian Defense'], ['E43', 'Nimzo-Indian Defense'],
      ['E44', 'Nimzo-Indian Defense'], ['E45', 'Nimzo-Indian Defense'], ['E46', 'Nimzo-Indian Defense'],
      ['E47', 'Nimzo-Indian Defense'], ['E48', 'Nimzo-Indian Defense'], ['E49', 'Nimzo-Indian Defense'],
      ['E50', 'Nimzo-Indian Defense'], ['E51', 'Nimzo-Indian Defense'], ['E52', 'Nimzo-Indian Defense'],
      ['E53', 'Nimzo-Indian Defense'], ['E54', 'Nimzo-Indian Defense'], ['E55', 'Nimzo-Indian Defense'],
      ['E56', 'Nimzo-Indian Defense'], ['E57', 'Nimzo-Indian Defense'], ['E58', 'Nimzo-Indian Defense'],
      ['E59', 'Nimzo-Indian Defense'], ['E60', 'King\'s Indian Defense'], ['E61', 'King\'s Indian Defense'],
      ['E62', 'King\'s Indian Defense'], ['E63', 'King\'s Indian Defense'], ['E64', 'King\'s Indian Defense'],
      ['E65', 'King\'s Indian Defense'], ['E66', 'King\'s Indian Defense'], ['E67', 'King\'s Indian Defense'],
      ['E68', 'King\'s Indian Defense'], ['E69', 'King\'s Indian Defense'], ['E70', 'King\'s Indian Defense'],
      ['E71', 'King\'s Indian Defense'], ['E72', 'King\'s Indian Defense'], ['E73', 'King\'s Indian Defense'],
      ['E74', 'King\'s Indian Defense'], ['E75', 'King\'s Indian Defense'], ['E76', 'King\'s Indian Defense'],
      ['E77', 'King\'s Indian Defense'], ['E78', 'King\'s Indian Defense'], ['E79', 'King\'s Indian Defense'],
      ['E80', 'King\'s Indian Defense'], ['E81', 'King\'s Indian Defense'], ['E82', 'King\'s Indian Defense'],
      ['E83', 'King\'s Indian Defense'], ['E84', 'King\'s Indian Defense'], ['E85', 'King\'s Indian Defense'],
      ['E86', 'King\'s Indian Defense'], ['E87', 'King\'s Indian Defense'], ['E88', 'King\'s Indian Defense'],
      ['E89', 'King\'s Indian Defense'], ['E90', 'King\'s Indian Defense'], ['E91', 'King\'s Indian Defense'],
      ['E92', 'King\'s Indian Defense'], ['E93', 'King\'s Indian Defense'], ['E94', 'King\'s Indian Defense'],
      ['E95', 'King\'s Indian Defense'], ['E96', 'King\'s Indian Defense'], ['E97', 'King\'s Indian Defense'],
      ['E98', 'King\'s Indian Defense'], ['E99', 'King\'s Indian Defense']
    ];

    // Insert all openings using individual run statements
    // Use database-agnostic upsert syntax
    const usePostgres = !!process.env.DATABASE_URL;

    for (const [eco, name] of openings) {
      if (usePostgres) {
        // PostgreSQL: INSERT ... ON CONFLICT
        await this.db.run(
          'INSERT INTO chess_openings (eco_code, opening_name) VALUES ($1, $2) ON CONFLICT (eco_code) DO UPDATE SET opening_name = $2',
          [eco, name]
        );
      } else {
        // SQLite: INSERT OR REPLACE
        await this.db.run('INSERT OR REPLACE INTO chess_openings (eco_code, opening_name) VALUES (?, ?)', [eco, name]);
      }
    }

    console.log(`✅ Inserted ${openings.length} chess opening mappings`);
  }

  async down() {
    console.log('Dropping chess_openings table...');
    await this.db.run('DROP TABLE IF EXISTS chess_openings');
  }
}

module.exports = Migration004;
