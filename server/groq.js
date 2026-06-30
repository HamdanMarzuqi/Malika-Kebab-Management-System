const Groq = require('groq-sdk');
const database = require('./database');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Conversation history per session
let conversationHistory = [];

function getSystemPrompt() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Jakarta' };
    const tanggalHariIni = now.toLocaleDateString('id-ID', options);
    const jamSekarang = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });

    // Calculate yesterday's date
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const tanggalKemarin = yesterday.toLocaleDateString('id-ID', options);

    // Calculate tomorrow's date
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tanggalBesok = tomorrow.toLocaleDateString('id-ID', options);

    return `Kamu adalah "Asisten Malika", asisten bisnis cerdas untuk booth FnB "Malika Kebab & Burger".

📅 INFORMASI WAKTU SAAT INI:
- Hari & Tanggal HARI INI: ${tanggalHariIni}
- Jam sekarang: ${jamSekarang} WIB
- Tanggal KEMARIN: ${tanggalKemarin}
- Tanggal BESOK: ${tanggalBesok}

Gunakan informasi waktu di atas untuk memahami konteks waktu dari pertanyaan user. Misalnya:
- "rekapan kemarin" = data tanggal ${tanggalKemarin} → gunakan periode "yesterday"
- "rekapan hari ini" = data tanggal ${tanggalHariIni} → gunakan periode "today"
- "minggu ini" = 7 hari terakhir → gunakan periode "week"

Tugasmu:
1. Mencatat pengeluaran harian (bahan baku, operasional, gaji, dll)
2. Menjawab pertanyaan tentang data penjualan dan keuangan
3. Memberikan insight bisnis sederhana
4. Rekapan sederhana yang berisi Total Transaksi, omzet Tunai, omzet Qris, omzet ShopeeFood, Total omzet, total potongan, dan total bersih

Aturan:
- Jawab dalam Bahasa Indonesia yang santai, friendly dan attention to detail, berikan jawaban sesuai dengan data dan akurat, jangan mengada ada
- Panggil owner dengan "Bos Ganteng"
- Gunakan emoji secukupnya (jangan berlebihan)
- Format angka uang: "Rp 150.000" (dengan titik pemisah ribuan)
- Untuk pengeluaran, selalu konfirmasi apa yang dicatat
- Jika user mengirim angka dengan "rb" atau "ribu", konversi ke ribuan (200rb = 200000)
- Jika user mengirim angka dengan "k", konversi ke ribuan (50k = 50000)  
- Jika tidak yakin dengan maksud user, tanya kembali
- Jangan menjawab pertanyaan di luar konteks bisnis Malika
- Jawab dengan ringkas tapi informatif
- Jika token sudah habis, jawab saja Token yang digunakan telah habis, jangan menjawab mengada ada

Kategori pengeluaran yang valid:
- Bahan Baku (daging, roti, tortilla, saus, keju, mayones, sayur, bumbu, dll)
- Operasional (gas/LPG, listrik, air, sewa, perlengkapan, packaging, dll)
- Gaji (upah karyawan, bonus)
- Lainnya (yang tidak masuk kategori di atas)

Menu Malika: Kebab (4 varian), Burger (4 varian), Maryam (2 varian), Takoyaki, Sosis Ori, plus extras
Channel: Langsung (harga normal), ShopeeFood (dipotong 25%)
Pembayaran Langsung: Tunai atau QRIS`;
}

const tools = [
    {
        type: 'function',
        function: {
            name: 'catat_pengeluaran',
            description: 'Mencatat pengeluaran baru ke database',
            parameters: {
                type: 'object',
                properties: {
                    deskripsi: { type: 'string', description: 'Deskripsi pengeluaran, contoh: "Beli daging sapi"' },
                    jumlah: { type: 'number', description: 'Jumlah uang dalam Rupiah (angka bulat, tanpa titik). Contoh: 200000' },
                    kategori: { type: 'string', enum: ['Bahan Baku', 'Operasional', 'Gaji', 'Lainnya'], description: 'Kategori pengeluaran' }
                },
                required: ['deskripsi', 'jumlah', 'kategori']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'hapus_pengeluaran_terakhir',
            description: 'Menghapus pengeluaran terakhir yang baru saja dicatat',
            parameters: { type: 'object', properties: {} }
        }
    },
    {
        type: 'function',
        function: {
            name: 'lihat_penjualan',
            description: 'Melihat data penjualan berdasarkan periode',
            parameters: {
                type: 'object',
                properties: {
                    periode: { type: 'string', enum: ['today', 'yesterday', 'week', 'month'], description: 'Periode data: today (hari ini), yesterday (kemarin), week (7 hari), month (30 hari)' }
                },
                required: ['periode']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'lihat_pengeluaran',
            description: 'Melihat data pengeluaran berdasarkan periode',
            parameters: {
                type: 'object',
                properties: {
                    periode: { type: 'string', enum: ['today', 'yesterday', 'week', 'month'], description: 'Periode data: today (hari ini), yesterday (kemarin), week (7 hari), month (30 hari)' }
                },
                required: ['periode']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'lihat_ringkasan_keuangan',
            description: 'Melihat ringkasan keuangan: omzet, pengeluaran, laba bersih',
            parameters: {
                type: 'object',
                properties: {
                    periode: { type: 'string', enum: ['today', 'yesterday', 'week', 'month'], description: 'Periode data: today (hari ini), yesterday (kemarin), week (7 hari), month (30 hari)' }
                },
                required: ['periode']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'lihat_menu_terlaris',
            description: 'Melihat menu yang paling laris berdasarkan jumlah terjual',
            parameters: {
                type: 'object',
                properties: {
                    periode: { type: 'string', enum: ['today', 'yesterday', 'week', 'month'], description: 'Periode data: today (hari ini), yesterday (kemarin), week (7 hari), month (30 hari)' },
                    limit: { type: 'number', description: 'Jumlah menu yang ditampilkan (default 5)' }
                },
                required: ['periode']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'lihat_perbandingan_channel',
            description: 'Melihat perbandingan penjualan antara Langsung dan ShopeeFood',
            parameters: {
                type: 'object',
                properties: {
                    periode: { type: 'string', enum: ['today', 'yesterday', 'week', 'month'], description: 'Periode data: today (hari ini), yesterday (kemarin), week (7 hari), month (30 hari)' }
                },
                required: ['periode']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'lihat_metode_pembayaran',
            description: 'Melihat breakdown pembayaran: Tunai vs QRIS vs ShopeeFood',
            parameters: {
                type: 'object',
                properties: {
                    periode: { type: 'string', enum: ['today', 'yesterday', 'week', 'month'], description: 'Periode data: today (hari ini), yesterday (kemarin), week (7 hari), month (30 hari)' }
                },
                required: ['periode']
            }
        }
    }
];

// Execute tool calls
function executeTool(name, args) {
    switch (name) {
        case 'catat_pengeluaran':
            return database.insertExpense({
                description: args.deskripsi,
                amount: args.jumlah,
                category: args.kategori
            });

        case 'hapus_pengeluaran_terakhir': {
            const last = database.getLastExpense();
            if (last) {
                database.deleteExpense(last.id);
                return { deleted: true, item: last };
            }
            return { deleted: false, message: 'Tidak ada pengeluaran untuk dihapus' };
        }

        case 'lihat_penjualan':
            return {
                summary: database.getSalesSummary(args.periode),
                top_items: database.getTopMenuItems(args.periode, 5)
            };

        case 'lihat_pengeluaran':
            return database.getExpensesSummary(args.periode);

        case 'lihat_ringkasan_keuangan': {
            const sales = database.getSalesSummary(args.periode);
            const expenses = database.getExpensesSummary(args.periode);
            return {
                omzet: sales.total_omzet,
                potongan_channel: sales.total_potongan,
                pendapatan_bersih: sales.total_bersih,
                total_pengeluaran: expenses.total_amount,
                laba_bersih: sales.total_bersih - expenses.total_amount,
                jumlah_transaksi: sales.total_transactions,
                pengeluaran_per_kategori: expenses.by_category
            };
        }

        case 'lihat_menu_terlaris':
            return database.getTopMenuItems(args.periode, args.limit || 5);

        case 'lihat_perbandingan_channel':
            return database.getChannelComparison(args.periode);

        case 'lihat_metode_pembayaran':
            return database.getPaymentMethodSummary(args.periode);

        default:
            return { error: 'Unknown function' };
    }
}

async function chat(userMessage) {
    conversationHistory.push({ role: 'user', content: userMessage });

    try {
        let response = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                { role: 'system', content: getSystemPrompt() },
                ...conversationHistory
            ],
            tools,
            tool_choice: 'auto',
            temperature: 0.7,
            max_tokens: 1024,
        });

        let assistantMessage = response.choices[0].message;

        // Handle tool calls (may be multiple rounds)
        while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
            conversationHistory.push(assistantMessage);

            for (const toolCall of assistantMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const functionArgs = JSON.parse(toolCall.function.arguments);

                console.log(`🔧 Tool call: ${functionName}`, functionArgs);
                const result = executeTool(functionName, functionArgs);
                console.log(`📊 Tool result:`, JSON.stringify(result).substring(0, 200));

                conversationHistory.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: JSON.stringify(result)
                });
            }

            // Get next response
            response = await groq.chat.completions.create({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    { role: 'system', content: getSystemPrompt() },
                    ...conversationHistory
                ],
                tools,
                tool_choice: 'auto',
                temperature: 0.7,
                max_tokens: 1024,
            });

            assistantMessage = response.choices[0].message;
        }

        const reply = assistantMessage.content || 'Maaf Boss, saya tidak bisa memproses permintaan itu.';
        conversationHistory.push({ role: 'assistant', content: reply });

        // Keep history manageable (last 20 messages)
        if (conversationHistory.length > 20) {
            conversationHistory = conversationHistory.slice(-20);
        }

        return reply;
    } catch (error) {
        console.error('Groq error:', error.message);

        // If rate limited, inform user honestly instead of using fallback model
        if (error.status === 429) {
            return '⚠️ Maaf Boss, kuota token harian sudah habis. Asisten tidak bisa memproses permintaan saat ini. Coba lagi nanti ya (biasanya reset dalam beberapa menit atau maksimal besok). 🙏';
        }

        return '⚠️ Maaf Boss, ada gangguan teknis. Coba lagi ya.';
    }
}

function resetConversation() {
    conversationHistory = [];
}

module.exports = { chat, resetConversation };
