# Tests (node, no install needed)

Run from the project folder, passing the `assets` folder:

```bash
node tests/nepali-numbers.test.js assets     # सय, हजार, डेढ, साढे, दशमलव …
node tests/nepali-sentences.test.js assets   # Nepali voice sentences for chicken, kheti, shop, mill, udharo
node tests/kheti.test.js assets              # kheti costs, wages, parma, household work, own machine, voice
node tests/panchang.test.js assets           # tithi and festival dates checked against known days
```
Each prints `ALL OK` / `ALL PASS` / `ALL MATCH` when everything passes.
