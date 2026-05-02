const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL kapcsolat
const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://kerdesek_user:SRRJfkOnBW2O2Sq5qRdU91Ds700sMc7V@dpg-d7bq0phr0fns739daat0-a.oregon-postgres.render.com/kerdesek',
  ssl: {
    rejectUnauthorized: false
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


// API: random kerdesek
app.get('/api/random-kerdesek', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, kerdes, valasz_a, valasz_b, valasz_c, valasz_d, valasz_e
      FROM kerdesek
      WHERE tobbszoros = 0
      ORDER BY RANDOM()
    `);

    res.json({ kerdesek: result.rows });
  } catch (err) {
    res.status(500).json({ hiba: 'Adatbázis hiba: ' + err.message });
  }
});


// API: csak a még meg nem válaszolt kérdések lekérése
app.get('/api/meg-nem-valaszolt-kerdesek', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, kerdes, valasz_a, valasz_b, valasz_c, valasz_d, valasz_e
      FROM kerdesek
      WHERE COALESCE(megvalaszolva, 0) = 0 AND tobbszoros = 0
      ORDER BY RANDOM()
    `);

    res.json({ kerdesek: result.rows });
  } catch (err) {
    console.error('DB hiba:', err.message);
    res.status(500).json({ hiba: 'Adatbázis hiba: ' + err.message });
  }
});

// API: 100 random kérdés
app.get('/api/100-kerdes', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, kerdes, valasz_a, valasz_b, valasz_c, valasz_d, valasz_e
      FROM kerdesek
      WHERE tobbszoros = 0
      ORDER BY RANDOM()
      LIMIT 100
    `);

    res.json({ kerdesek: result.rows });
  } catch (err) {
    console.error('DB hiba:', err.message);
    res.status(500).json({ hiba: 'Adatbázis hiba: ' + err.message });
  }
});

// API: válasz ellenőrzése + helyes válasz esetén megvalaszolva = 1
app.post('/api/ellenor-megvalaszolas', async (req, res) => {
  const { id, valasz } = req.body;

  if (!id || !valasz) {
    return res.status(400).json({ hiba: 'Hiányzó id vagy válasz.' });
  }

  try {
    const result = await pool.query(
      'SELECT helyes_valasz FROM kerdesek WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ hiba: 'Kérdés nem található.' });
    }

    const map = {
      igaz: 'a',
      hamis: 'b'
    };

    const helyesRaw = String(result.rows[0].helyes_valasz).trim().toLowerCase();
    const helyes = map[helyesRaw] || helyesRaw;
    const adott = String(valasz).trim().toLowerCase();

    const jo = helyes === adott;

    if (jo) {
      await pool.query(
        'UPDATE kerdesek SET megvalaszolva = 1 WHERE id = $1',
        [id]
      );
    }

    res.json({
      helyes: jo,
      helyes_valasz: helyes
    });
  } catch (err) {
    console.error('DB hiba:', err.message);
    res.status(500).json({ hiba: 'Adatbázis hiba: ' + err.message });
  }
});

//API: ellenőr
app.post('/api/ellenor', async (req, res) => {
  const { id, valasz } = req.body;

  if (!id || !valasz) {
    return res.status(400).json({ hiba: 'Hiányzó id vagy válasz.' });
  }

  try {
    const result = await pool.query(
      'SELECT helyes_valasz FROM kerdesek WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ hiba: 'Kérdés nem található.' });
    }

    const map = {
      igaz: 'a',
      hamis: 'b'
    };

    const helyesRaw = String(result.rows[0].helyes_valasz).trim().toLowerCase();
    const helyes = map[helyesRaw] || helyesRaw;
    const adott = String(valasz).trim().toLowerCase();

    const jo = helyes === adott;

    res.json({
      helyes: jo,
      helyes_valasz: helyes
    });
  } catch (err) {
    console.error('DB hiba:', err.message);
    res.status(500).json({ hiba: 'Adatbázis hiba: ' + err.message });
  }
});

// API: többszörös kérdések lekérése
app.get('/api/tobbszoros-kerdesek', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, kerdes, valasz_a, valasz_b, valasz_c, valasz_d, valasz_e
      FROM kerdesek
      WHERE tobbszoros = 1
      ORDER BY RANDOM()
    `);

    res.json({ kerdesek: result.rows });
  } catch (err) {
    console.error('DB hiba:', err.message);
    res.status(500).json({ hiba: 'Adatbázis hiba: ' + err.message });
  }
});

// API: többszörös meg nem válaszolt kérdések lekérése
app.get('/api/tobbszoros-kerdesek-nemvalaszolt', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, kerdes, valasz_a, valasz_b, valasz_c, valasz_d, valasz_e
      FROM kerdesek
      WHERE tobbszoros = 1 AND megvalaszolva = 0
      ORDER BY RANDOM()
    `);

    res.json({ kerdesek: result.rows });
  } catch (err) {
    console.error('DB hiba:', err.message);
    res.status(500).json({ hiba: 'Adatbázis hiba: ' + err.message });
  }
});

// TÖBBSZÖRÖS VÁLASZ ELLENŐRZÉS
app.post('/api/tobbszoros-ellenor', async (req, res) => {
  const { id, valaszok } = req.body;

  if (!id || !Array.isArray(valaszok)) {
    return res.status(400).json({ hiba: 'Hiányzó adatok.' });
  }

  try {
    const result = await pool.query(
      'SELECT helyes_valasz FROM kerdesek WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ hiba: 'Nincs ilyen kérdés.' });
    }

    const helyesRaw = String(result.rows[0].helyes_valasz)
      .toLowerCase()
      .trim();

    // pl: "a,c,d"
    const helyes = helyesRaw.split(/[;,]/).map(v => v.trim()).sort();
    const adott = valaszok.map(v => v.toLowerCase()).sort();

    const jo =
      helyes.length === adott.length &&
      helyes.every((v, i) => v === adott[i]);

    res.json({
      helyes: jo,
      helyes_valaszok: helyes
    });

  } catch (err) {
    res.status(500).json({ hiba: err.message });
  }
});

// API: többszörös kérdések ellenőrzése és update
app.post('/api/tobbszoros-ellenor-megvalaszolva', async (req, res) => {
    const { id, valaszok } = req.body;

  if (!id || !Array.isArray(valaszok)) {
    return res.status(400).json({ hiba: 'Hiányzó adatok.' });
  }

  try {
    const result = await pool.query(
      'SELECT helyes_valasz FROM kerdesek WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ hiba: 'Nincs ilyen kérdés.' });
    }

    const helyesRaw = String(result.rows[0].helyes_valasz)
      .toLowerCase()
      .trim();

    // pl: "a,c,d"
    const helyes = helyesRaw.split(/[;,]/).map(v => v.trim()).sort();
    const adott = valaszok.map(v => v.toLowerCase()).sort();

    const jo =
      helyes.length === adott.length &&
      helyes.every((v, i) => v === adott[i]);

    if (jo) {
      await pool.query(
        'UPDATE kerdesek SET megvalaszolva = 1 WHERE id = $1',
        [id]
      );
    }

    res.json({
      helyes: jo,
      helyes_valasz: helyes
    });
  } catch (err) {
    console.error('DB hiba:', err.message);
    res.status(500).json({ hiba: 'Adatbázis hiba: ' + err.message });
  }
});

//reset endpoint
app.post('/api/reset-megvalaszolva', async (req, res) => {
  try {
    await pool.query('UPDATE kerdesek SET megvalaszolva = 0 WHERE tobbszoros = 0');
    res.json({ ok: true, uzenet: 'Minden kérdés visszaállítva 0-ra.' });
  } catch (err) {
    console.error('DB hiba:', err.message);
    res.status(500).json({ hiba: 'Adatbázis hiba: ' + err.message });
  }
});

app.post('/api/reset-megvalaszolva-tobbszoros', async (req, res) => {
  try {
    await pool.query('UPDATE kerdesek SET megvalaszolva = 0 WHERE tobbszoros = 1');
    res.json({ ok: true, uzenet: 'Minden kérdés visszaállítva 0-ra.' });
  } catch (err) {
    console.error('DB hiba:', err.message);
    res.status(500).json({ hiba: 'Adatbázis hiba: ' + err.message });
  }
});

//teszteredmény mentése
app.post('/api/teszt-mentes', async (req, res) => {
  const { eredmeny } = req.body;

  if (eredmeny == null) {
    return res.status(400).json({ hiba: 'Hiányzó eredmény.' });
  }

  try {
    await pool.query(
      'INSERT INTO teszt_eredmenyek (eredmeny) VALUES ($1)',
      [eredmeny]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('DB hiba:', err.message);
    res.status(500).json({ hiba: err.message });
  }
});

// API: összes teszteredmény listázása
app.get('/api/teszt-eredmenyek', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, datum, eredmeny
      FROM teszt_eredmenyek
      ORDER BY datum DESC
    `);

    res.json({ eredmenyek: result.rows });
  } catch (err) {
    console.error('DB hiba:', err.message);
    res.status(500).json({ hiba: 'Adatbázis hiba: ' + err.message });
  }
});

// API: statisztikai összesítés
app.get('/api/teszt-statisztika', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) AS tesztek_szama,
        COALESCE(ROUND(AVG(eredmeny)), 0) AS atlag_eredmeny,
        COALESCE(MAX(eredmeny), 0) AS legjobb_eredmeny,
        COALESCE(
          (
            SELECT eredmeny
            FROM teszt_eredmenyek
            ORDER BY datum DESC
            LIMIT 1
          ), 0
        ) AS utolso_eredmeny
      FROM teszt_eredmenyek
    `);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('DB hiba:', err.message);
    res.status(500).json({ hiba: 'Adatbázis hiba: ' + err.message });
  }
});





// Minden más útvonal az index.html-t adja vissza
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Szerver fut: http://localhost:${PORT}`);
});

