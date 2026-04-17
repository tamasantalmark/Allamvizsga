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

// API: csak a még meg nem válaszolt kérdések lekérése
app.get('/api/meg-nem-valaszolt-kerdesek', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, kerdes, valasz_a, valasz_b, valasz_c, valasz_d, valasz_e
      FROM kerdesek
      WHERE COALESCE(megvalaszolva, 0) = 0
      ORDER BY RANDOM()
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

    const helyes = String(result.rows[0].helyes_valasz).trim().toLowerCase();
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

// opcionális reset endpoint teszteléshez
app.post('/api/reset-megvalaszolva', async (req, res) => {
  try {
    await pool.query('UPDATE kerdesek SET megvalaszolva = 0');
    res.json({ ok: true, uzenet: 'Minden kérdés visszaállítva 0-ra.' });
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