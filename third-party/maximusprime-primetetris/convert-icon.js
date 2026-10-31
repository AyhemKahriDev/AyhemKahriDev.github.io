const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, 'icon.png');
const outputPath = path.join(__dirname, 'icon.ico');

pngToIco(inputPath)
  .then(buf => {
    fs.writeFileSync(outputPath, buf);
    console.log('Icon converted successfully!');
  })
  .catch(error => {
    console.error('Error converting icon:', error);
  });
