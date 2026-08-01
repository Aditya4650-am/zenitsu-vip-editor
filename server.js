const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const zlib = require('zlib');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(fileUpload({ limits: { fileSize: 50 * 1024 * 1024 } }));
app.use(express.static(path.join(__dirname, 'public')));

// XML Helpers
function decodeSaveData(buffer) {
    try {
        return zlib.inflateSync(buffer).toString('utf-8');
    } catch (err) {
        return buffer.toString('utf-8');
    }
}

function encodeSaveData(xmlString) {
    return zlib.deflateSync(Buffer.from(xmlString, 'utf-8'));
}

function updateXmlTag(xml, tag, value) {
    const regex = new RegExp(`(<${tag}>)(.*?)(<\/${tag}>)`, 'g');
    if (regex.test(xml)) {
        return xml.replace(regex, `$1${value}$3`);
    }
    return xml.replace('</save>', `  <${tag}>${value}</${tag}>\n</save>`);
}

// API Processing Route
app.post('/api/process', (req, res) => {
    if (!req.files || !req.files.saveFile) {
        return res.status(400).json({ success: false, message: 'No save file provided.' });
    }

    try {
        const file = req.files.saveFile;
        let xmlContent = decodeSaveData(file.data);

        const payload = JSON.parse(req.body.payload || '{}');
        const activeTab = req.body.activeTab || 'stats';

        // 1. STATS TAB MODIFICATIONS
        if (activeTab === 'stats' && payload.stats) {
            const s = payload.stats;
            if (s.tcash_active && s.tcash) xmlContent = updateXmlTag(xmlContent, 'tcash', s.tcash);
            if (s.coins_active && s.coins) xmlContent = updateXmlTag(xmlContent, 'coins', s.coins);
            if (s.level_active && s.level) xmlContent = updateXmlTag(xmlContent, 'level', s.level);
            if (s.m3lvl_active && s.m3lvl) xmlContent = updateXmlTag(xmlContent, 'm3lvl', s.m3lvl);
            if (s.firstwin_active && s.firstwin) xmlContent = updateXmlTag(xmlContent, 'firstwin', s.firstwin);
            if (s.lives_active && s.lives) xmlContent = updateXmlTag(xmlContent, 'lives', s.lives);
            if (s.help_active && s.help) xmlContent = updateXmlTag(xmlContent, 'help', s.help);
            if (s.cards_active && s.cards) xmlContent = updateXmlTag(xmlContent, 'cards', s.cards);
        }

        // 2. UNLOCKS TAB MODIFICATIONS
        if (activeTab === 'unlocks' && payload.unlocks) {
            if (payload.unlocks.allBuildings) xmlContent = updateXmlTag(xmlContent, 'unlock_buildings', '1');
            if (payload.unlocks.allExpansions) xmlContent = updateXmlTag(xmlContent, 'unlock_expansions', '1');
            if (payload.unlocks.allSkins) xmlContent = updateXmlTag(xmlContent, 'unlock_skins', '1');
        }

        // 3. TOOLS TAB MODIFICATIONS
        if (activeTab === 'tools' && payload.tools) {
            if (payload.tools.antiBan) xmlContent = updateXmlTag(xmlContent, 'ban_flag', '0');
            if (payload.tools.instantProduce) xmlContent = updateXmlTag(xmlContent, 'instant_produce', '1');
        }

        // 4. REGATTA TAB MODIFICATIONS
        if (activeTab === 'regatta' || payload.injectRegatta) {
            let regattaPayload = '<regatta_tasks>\n';
            for (let i = 1; i <= 100; i++) {
                regattaPayload += `  <task id="${i}" points="150" status="active" />\n`;
            }
            regattaPayload += '</regatta_tasks>';
            xmlContent = updateXmlTag(xmlContent, 'regatta_tasks', regattaPayload);
        }

        // 5. VIP TAB MODIFICATIONS
        if (activeTab === 'vip' && payload.vip) {
            xmlContent = updateXmlTag(xmlContent, 'vip_membership', '1');
            xmlContent = updateXmlTag(xmlContent, 'golden_ticket', '1');
        }

        const outputBuffer = encodeSaveData(xmlContent);

        res.setHeader('Content-Disposition', 'attachment; filename="player.xml"');
        res.setHeader('Content-Type', 'application/octet-stream');
        return res.send(outputBuffer);

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`ZENITSU VIP Engine running on port ${PORT}`);
});
