const WebSocket = require('ws');
const crypto = require('crypto');

// GANTI DENGAN API KEY GEMINI ANDA
const GEMINI_API_KEY = "AQ.Ab8RN6LCQ1zlYij4ZFdYLKlHMlri1vJ8yYWJ-O_uIinZ0kIZUA"; 

const PORT = 3000;
const wss = new WebSocket.Server({ port: PORT });

console.log(`[Gemini Master] Server berjalan di port ${PORT}...`);
console.log(`Silakan masuk ke Minecraft dan ketik: /connect localhost:${PORT}`);

wss.on('connection', (ws) => {
    console.log('[Gemini Master] Minecraft berhasil terhubung!');
    
    // Tampilkan pesan selamat datang di Minecraft
    sendChat(ws, "§a[Gemini Master] Berhasil terhubung! Gunakan awalan 'gemini' untuk berbicara denganku.");
    
    // Subscribe ke event chat di Minecraft
    subscribeToEvent(ws, "PlayerMessage");

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            
            // Filter jika yang dideteksi adalah event chat dari player
            if (data.header && data.header.eventName === "PlayerMessage") {
                const eventData = data.body;
                
                // Pastikan pesan bukan dari sistem/external server sendiri
                if (eventData.type === "chat" && eventData.sender !== "External") {
                    const player = eventData.sender;
                    const msgText = eventData.message;

                    // Gemini hanya merespons jika diawali kata "gemini" (case insensitive)
                    if (msgText.toLowerCase().startsWith("gemini")) {
                        const playerPrompt = msgText.replace(/^gemini/i, "").trim();
                        console.log(`[Player] ${player}: ${playerPrompt}`);
                        
                        sendChat(ws, `§e[Gemini] Sedang berpikir...`);
                        
                        // Hubungi Gemini API
                        const result = await askGemini(player, playerPrompt);
                        
                        // Kirim balasan chat ke Minecraft
                        if (result.reply) {
                            sendChat(ws, `§b[Gemini] §f${result.reply}`);
                        }
                        
                        // Eksekusi commands kreatif dari Gemini
                        if (result.commands && Array.isArray(result.commands)) {
                            result.commands.forEach(cmd => {
                                console.log(`[Executing Command] ${cmd}`);
                                sendCommand(ws, cmd);
                            });
                        }
                    }
                }
            }
        } catch (err) {
            console.error("Gagal memproses pesan:", err);
        }
    });

    ws.on('close', () => {
        console.log('[Gemini Master] Koneksi terputus.');
    });
});

// Fungsi memanggil API Gemini
async function askGemini(playerName, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    // System Instruction untuk membentuk kepribadian Gemini sebagai Game Master kreatif
    const systemInstruction = `Kamu adalah Dewa Game Master yang hidup di dunia Minecraft. 
Kamu merespons pesan dari player bernama "${playerName}". 
Tugasmu adalah membalas chatnya dan (jika relevan) membantunya atau menjahilinya menggunakan command Minecraft.

Kamu HARUS selalu membalas dengan format JSON murni tanpa markdown (tanpa \`\`\`json).
Format JSON yang wajib kamu kirim:
{
  "reply": "Pesan chat ramah/lucu/misterius untuk player",
  "commands": ["command_minecraft_1", "command_minecraft_2"]
}

Aturan Command:
- Gunakan target "@p" atau "${playerName}".
- Jika player minta bantuan makanan/darah, beri makanan atau efek instant_health.
- Jika player minta tantangan, spawn monster di sekitar mereka atau ubah cuaca menjadi badai (thunderstorm).
- Jika obrolan biasa tanpa permintaan khusus, kosongkan array "commands" (misal: "commands": []).
- Selalu gunakan command Minecraft Bedrock yang valid (misal: "give @p apple 5", "summon zombie", "time set night").`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: {
                    responseMimeType: "application/json"
                }
            })
        });

        const data = await response.json();
        const rawText = data.candidates[0].content.parts[0].text;
        return JSON.parse(rawText.trim());
    } catch (error) {
        console.error("Error Gemini API:", error);
        return { 
            reply: "Maaf kekuatanku sedang tidak stabil saat ini...", 
            commands: [] 
        };
    }
}

// Helper untuk mengirim Command ke Minecraft
function sendCommand(ws, command) {
    const msg = {
        header: {
            version: 1,
            requestId: crypto.randomUUID(),
            messageType: "commandRequest",
            purpose: "commandRequest"
        },
        body: {
            commandLine: command,
            version: 1
        }
    };
    ws.send(JSON.stringify(msg));
}

// Helper untuk menampilkan teks chat di Minecraft
function sendChat(ws, text) {
    sendCommand(ws, `tellraw @a {"rawtext":[{"text":"${text}"}]}`);
}

// Helper untuk subscribe ke event Minecraft
function subscribeToEvent(ws, eventName) {
    const msg = {
        header: {
            version: 1,
            requestId: crypto.randomUUID(),
            messageType: "commandRequest",
            purpose: "subscribe"
        },
        body: {
            eventName: eventName
        }
    };
    ws.send(JSON.stringify(msg));
}
