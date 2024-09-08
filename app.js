const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const bip39 = require('bip39');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' }); // Configuração para upload de arquivos

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Route for the HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Function to generate SHA-256 hash from a string
function generateSHA256Hash(inputString) {
  return crypto.createHash('sha256').update(inputString).digest('hex');
}

// POST route to generate seed phrase
app.post('/generate-seed', upload.single('fileInput'), (req, res) => {
  const { inputString, hashPoem, numWords, language } = req.body;
  let hash;

  // Check if a hash or string was provided
  if (hashPoem) {
    hash = hashPoem;
  } else if (inputString) {
    hash = generateSHA256Hash(inputString);
  } else if (req.file) {
    // Handle file upload
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    hash = generateSHA256Hash(fileContent);

    // Delete the uploaded file after reading its content
    fs.unlink(req.file.path, (err) => {
      if (err) {
        console.error('Error deleting the file:', err);
        return res.status(500).json({ error: 'Error deleting file' });
      }
      console.log('Uploaded file deleted successfully');
    });
  } else {
    return res.status(400).json({ error: 'No input provided' });
  }

  // Ensure the hash has enough length (64 hex characters = 256 bits)
  const entropyLength = parseInt(numWords) === 12 ? 128 : 256; // 128 bits for 12 words, 256 bits for 24 words
  if (hash.length < entropyLength / 4) {
    return res.status(400).json({ error: 'Hash too short to generate entropy' });
  }

  const entropy = hash.slice(0, entropyLength / 4); // Take the first N characters of the hash

  // Map language to bip39 wordlists
  const languageMap = {
    'english': bip39.wordlists.english,
    'japanese': bip39.wordlists.japanese,
    'korean': bip39.wordlists.korean,
    'spanish': bip39.wordlists.spanish,
    'chinese': bip39.wordlists.chinese_simplified,
    'french': bip39.wordlists.french,
    'italian': bip39.wordlists.italian,
    'czech': bip39.wordlists.czech,
    'portuguese': bip39.wordlists.portuguese
  };

  const wordlist = languageMap[language] || bip39.wordlists.english;

  try {
    const seedPhrase = bip39.entropyToMnemonic(entropy, wordlist);
    res.json({ seedPhrase });
  } catch (error) {
    console.error('Error generating seed phrase:', error);
    res.status(500).json({ error: 'Error generating seed phrase' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
