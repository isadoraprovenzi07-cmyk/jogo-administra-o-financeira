const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const os = require('os');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*"
    }
});

// Render usa process.env.PORT.
// No computador, usa 8080.
const PORT = process.env.PORT || 8080;

// Pega o IP local automaticamente para usar no computador.
// No Render, usa a variável BASE_URL.
function getLocalIP() {
    const interfaces = os.networkInterfaces();

    for (const interfaceName in interfaces) {
        for (const iface of interfaces[interfaceName]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }

    return 'localhost';
}

const LOCAL_IP = getLocalIP();

const BASE_URL =
    process.env.BASE_URL || `http://${LOCAL_IP}:${PORT}`;

// Serve a pasta public
app.use(express.static('public'));

// Gera PIN da sala
function generateRoomId() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

io.on('connection', (socket) => {
    console.log(`Cliente conectado: ${socket.id}`);

    // Host cria sala
    socket.on('criar_sala', async () => {
        try {
            const roomId = generateRoomId();

            socket.join(roomId);

            const joinUrl =
                `${BASE_URL}/player.html?sala=${roomId}`;

            const qrDataUrl =
                await QRCode.toDataURL(joinUrl, {
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
        socket.join(roomId);

        console.log(`${playerName} entrou na sala ${roomId}`);

        io.to(roomId).emit('novo_jogador', {
            id: socket.id,
            name: playerName
        });
    });

    // Jogador vota
    socket.on('enviar_voto', (roomId, vote) => {
        io.to(roomId).emit('voto_recebido', {
            id: socket.id,
            vote
        });
    });

    // Feedback individual
    socket.on('enviar_feedback_individual', (data) => {
        io.to(data.playerId).emit('feedback_recebido', {
            feedback: data.feedback,
            impacto: data.impacto
        });
    });

    // Nova rodada
    socket.on('nova_rodada', (roomId) => {
        io.to(roomId).emit('nova_rodada_iniciada');
    });

    socket.on('disconnect', () => {
        console.log(`Cliente desconectado: ${socket.id}`);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('\n========================================');
    console.log('SERVIDOR ONLINE');
    console.log(`Link do Host: ${BASE_URL}`);
    console.log(`Porta: ${PORT}`);
    console.log('========================================\n');
});