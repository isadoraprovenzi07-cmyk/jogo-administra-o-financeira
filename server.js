const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

// O Render define a porta automaticamente.
// No computador, usa 8080.
const PORT = process.env.PORT || 8080;

// Serve os arquivos da pasta public
app.use(express.static(path.join(__dirname, 'public')));

// Gera PIN da sala
function generateRoomId() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Pega automaticamente o link real usado no navegador.
// No Render, isso vira https://jogo-dm-financeira.onrender.com
function getBaseUrl(socket) {
    const host = socket.handshake.headers.host;

    const forwardedProto =
        socket.handshake.headers['x-forwarded-proto'];

    let protocol = 'http';

    if (forwardedProto) {
        protocol = forwardedProto.split(',')[0];
    } else if (host && host.includes('onrender.com')) {
        protocol = 'https';
    }

    return `${protocol}://${host}`;
}

io.on('connection', (socket) => {
    console.log(`Cliente conectado: ${socket.id}`);

    // Host cria sala
    socket.on('criar_sala', async () => {
        try {
            const roomId = generateRoomId();

            socket.join(roomId);

            const baseUrl = getBaseUrl(socket);

            // QR CODE FIXO:
            // ele abre a página do jogador, e a pessoa digita o PIN que aparece no telão.
            const joinUrl = `${baseUrl}/player.html`;

            // Se tu quiser que o QR já preencha a sala automaticamente,
            // troca a linha de cima por esta:
            // const joinUrl = `${baseUrl}/player.html?sala=${roomId}`;

            const qrDataUrl = await QRCode.toDataURL(joinUrl, {
                width: 350,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });

            socket.emit('sala_criada', {
                roomId,
                joinUrl,
                qrDataUrl
            });

            console.log('\n==============================');
            console.log(`Sala criada: ${roomId}`);
            console.log(`QR URL: ${joinUrl}`);
            console.log('==============================\n');

        } catch (err) {
            console.error('Erro ao gerar QR Code:', err);

            socket.emit(
                'qr_erro',
                'Erro ao gerar QR Code.'
            );
        }
    });

    // Jogador entra
    socket.on('entrar_sala', (roomId, playerName) => {
        const sala = String(roomId || '').trim();
        const nome = String(playerName || '').trim();

        if (!sala || !nome) {
            return;
        }

        socket.join(sala);

        console.log(`${nome} entrou na sala ${sala}`);

        io.to(sala).emit('novo_jogador', {
            id: socket.id,
            name: nome
        });
    });

    // Jogador vota
    socket.on('enviar_voto', (roomId, vote) => {
        const sala = String(roomId || '').trim();

        if (!sala || !vote) {
            return;
        }

        io.to(sala).emit('voto_recebido', {
            id: socket.id,
            vote
        });
    });

    // Feedback individual
    socket.on('enviar_feedback_individual', (data) => {
        if (!data || !data.playerId) {
            return;
        }

        io.to(data.playerId).emit('feedback_recebido', {
            feedback: data.feedback,
            impacto: data.impacto
        });
    });

    // Nova rodada
    socket.on('nova_rodada', (roomId) => {
        const sala = String(roomId || '').trim();

        if (!sala) {
            return;
        }

        io.to(sala).emit('nova_rodada_iniciada');
    });

    socket.on('disconnect', () => {
        console.log(`Cliente desconectado: ${socket.id}`);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('\n========================================');
    console.log('SERVIDOR ONLINE');
    console.log(`Porta: ${PORT}`);
    console.log('========================================\n');
});
