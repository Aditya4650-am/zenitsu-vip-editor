const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const zlib = require('zlib');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(cors());
app.use(express.json());
app.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 } })); // 50MB Limit
app.use(express.static(path.join(__dirname, 'public')));

// Helper: Decompress / Decode Save Buffer
function decodeSaveData(buffer) {
    try {
        return zlib.inflateSync(buffer).toString('utf-8');
    } catch (err) {
        // Fallback for raw uncompressed XML
        return buffer.toString('utf-8');
    }
}

// Helper: Compress / Encode XML Payload
function encodeSaveData(xmlString) {
    return zlib.deflateSync(Buffer.from(xmlString, 'utf-8'));
}

// Helper: XML Tag Value Replacer
function updateXmlTag(xml, tag, value) {
    const regex = new RegExp(`(<${tag}>)(.*?)(<\/${tag}>)`, 'g');
    if (regex.test(xml)) {
        return xml.replace(regex, `$1${value}$3`);
    }
    // Inject node before closing root tag if tag does not exist
    return xml.replace('</save>', `  <${tag}>${value}</${tag}>\n</save>`);
}

// API Endpoint: Process & Modify Save File
app.post('/api/process', (req, res) => {
    if (!req.files || !req.files.saveFile) {
        return res.status(400).json({ success: false, message: 'No save file uploaded.' });
    }

    try {
        const file = req.files.saveFile;
        let xmlContent = decodeSaveData(file.data);

        // Extract submitted stats
        const stats = JSON.parse(req.body.stats || '{}');
        const injectRegatta = req.body.injectRegatta === 'true';

        // Apply XML stat modifications
        if (stats.tcash) xmlContent = updateXmlTag(xmlContent, 'tcash', stats.tcash);
        if (stats.coins) xmlContent = updateXmlTag(xmlContent, 'coins', stats.coins);
        if (stats.level) xmlContent = updateXmlTag(xmlContent, 'level', stats.level);
        if (stats.m3lvl) xmlContent = updateXmlTag(xmlContent, 'm3lvl', stats.m3lvl);
        if (stats.lives) xmlContent = updateXmlTag(xmlContent, 'lives', stats.lives);
        if (stats.help) xmlContent = updateXmlTag(xmlContent, 'help', stats.help);

        // Inject Regatta tasks into XML structure if requested
        if (injectRegatta) {
            let regattaPayload = '<regatta_tasks>\n';
            for (let i = 1; i <= 100; i++) {
                regattaPayload += `  <task id="${i}" points="150" status="active" />\n`;
            }
            regattaPayload += '</regatta_tasks>';
            xmlContent = updateXmlTag(xmlContent, 'regatta_tasks', regattaPayload);
        }

        // Re-compress back to target format
        const outputBuffer = encodeSaveData(xmlContent);

        // Send modified save as downloadable file attachment
        res.setHeader('Content-Disposition', 'attachment; filename="player.xml"');
        res.setHeader('Content-Type', 'application/octet-stream');
        return res.send(outputBuffer);

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`ZENITSU VIP Engine running on port ${PORT}`);
});
          
